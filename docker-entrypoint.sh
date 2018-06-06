#!/bin/sh

set -euo pipefail
IFS=$'\n\t'

if [[ -n "${DATABASE_USERNAME}" ]]; then
  export DATABASE_URL="postgres://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@localhost:5432/postgres"
fi

node tools/run-schema.js

echo "Running VoteBot API server on port ${PORT}"

if [[ "${APP_ENVIRONMENT}" == "production" ]]; then
  exec npm start
else
  exec node server.js
fi
