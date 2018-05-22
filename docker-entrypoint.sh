#!/bin/sh

set -e

node tools/run-schema.js

echo "Running VoteBot API server on port ${PORT}"

exec node server.js
