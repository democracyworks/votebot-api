#!/bin/sh

set -e

node tools/run-schema.js

echo "Running VoteBot API server on port ${PORT}"

if [[ "${APP_ENVIRONMENT}" == "production" ]]; then
  exec npm start
else
  exec node server.js
fi
