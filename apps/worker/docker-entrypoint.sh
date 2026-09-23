#!/bin/sh
set -eu
: "${INFISICAL_CLIENT_ID:?Required}"
: "${INFISICAL_CLIENT_SECRET:?Required}"
: "${INFISICAL_PROJECT_ID:?Required}"
: "${INFISICAL_ENV:?Required}"
# Keep assignment separate from export so authentication failure stops startup.
INFISICAL_TOKEN=$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)
[ -n "$INFISICAL_TOKEN" ] || exit 1
export INFISICAL_TOKEN
unset INFISICAL_CLIENT_SECRET
exec infisical run --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" --path="${INFISICAL_SECRET_PATH:-/worker}" -- "$@"
