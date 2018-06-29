#!/bin/sh

set -euo pipefail
IFS=$'\n\t'

if [[ -n "${DATABASE_USERNAME:-}" ]]; then
  export DATABASE_URL="postgres://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@localhost:5432/postgres"
fi

node tools/run-schema.js

echo "Running VoteBot API server on port ${PORT}"

if [[ -z ${1:-} ]]; then
  if [[ "${APP_ENVIRONMENT}" == "production" ]]; then
    exec npm start
  else
    exec node server.js
  fi
elif [[ ${1:-} == "notifier" ]]; then
  exec node --optimize_for_size --max_old_space_size=13192 --gc_interval=100 notifier.js
fi
