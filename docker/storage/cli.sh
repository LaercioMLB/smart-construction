#!/bin/sh
set -eu

export AWS_ACCESS_KEY_ID="$(cat /run/secrets/storage_access_key)"
export AWS_SECRET_ACCESS_KEY="$(cat /run/secrets/storage_secret_key)"

if [ "${1:-}" = 'index' ]; then
  aws --endpoint-url http://storage:8333 s3api list-objects-v2 \
    --bucket "$S3_BUCKET" --query 'Contents[].Key' --output json > /tmp/assets-index.json
  aws --endpoint-url http://storage:8333 s3 cp /tmp/assets-index.json \
    "s3://$S3_BUCKET/__assets.json" --content-type application/json \
    --cache-control no-store --only-show-errors
  echo 'Indice de imagens atualizado.'
else
  exec aws --endpoint-url http://storage:8333 "$@"
fi
