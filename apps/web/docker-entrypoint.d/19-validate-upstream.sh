#!/bin/sh
set -eu
: "${API_UPSTREAM:?Set API_UPSTREAM to the private API hostname:port}"
printf '%s' "$API_UPSTREAM" | grep -Eq '^[a-zA-Z0-9][a-zA-Z0-9.-]*:[0-9]{1,5}$' || {
  echo 'API_UPSTREAM must be hostname:port' >&2
  exit 1
}
