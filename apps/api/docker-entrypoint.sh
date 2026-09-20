#!/bin/sh
set -eu

export INFISICAL_TOKEN="$(
  infisical login \
    --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --silent \
    --plain
)"

exec infisical run \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env=staging \
  --path=/api \
  -- node apps/api/dist/index.js