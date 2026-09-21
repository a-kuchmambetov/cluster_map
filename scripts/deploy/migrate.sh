#!/bin/sh
# Run on the deployment host; never on the build runner.
set -eu
: "${API_IMAGE:?Set the published API image including @sha256 digest}"
: "${DEPLOY_NETWORK:?Set the private database Docker network}"
: "${INFISICAL_CLIENT_ID:?Set the migration identity}"
: "${INFISICAL_CLIENT_SECRET:?Set the migration identity secret}"
: "${INFISICAL_PROJECT_ID:?Required}"
: "${INFISICAL_ENV:?Required}"
case "$API_IMAGE" in ghcr.io/*@sha256:*) ;; *) echo 'Digest image required' >&2; exit 1;; esac
docker run --rm --network "$DEPLOY_NETWORK" \
  -e INFISICAL_CLIENT_ID -e INFISICAL_CLIENT_SECRET -e INFISICAL_PROJECT_ID \
  -e INFISICAL_ENV -e INFISICAL_DOMAIN -e INFISICAL_SECRET_PATH=/database \
  "$API_IMAGE" pnpm --dir /app/packages/db db:migrate
