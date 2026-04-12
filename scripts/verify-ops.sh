#!/bin/sh
set -eu

api_base_url="${API_BASE_URL:-http://localhost:4000}"

curl --fail --silent --show-error "$api_base_url/health" | grep '"status":"ok"' >/dev/null
curl --fail --silent --show-error "$api_base_url/health/live" | grep '"status":"ok"' >/dev/null
curl --fail --silent --show-error "$api_base_url/health/startup" | grep '"status":"started"' >/dev/null
curl --fail --silent --show-error "$api_base_url/health/ready" | grep '"status":"ready"' >/dev/null
curl --fail --silent --show-error "$api_base_url/health/metrics" | grep '"service":"api"' >/dev/null
curl --fail --silent --show-error "$api_base_url/platform/queues" | grep '"queues"' >/dev/null
