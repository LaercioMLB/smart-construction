#!/bin/sh
set -eu

export AWS_ACCESS_KEY_ID="$(cat /run/secrets/storage_access_key)"
export AWS_SECRET_ACCESS_KEY="$(cat /run/secrets/storage_secret_key)"
export WEED_ADMIN_PASSWORD="$(cat /run/secrets/storage_admin_password)"

exec weed mini -dir=/data -ip=storage -ip.bind=0.0.0.0 \
  -master.port=9333 -volume.port=9340 -filer.port=8888 -s3.port=8333 \
  -admin.port=23646 -admin.dataDir=/data/admin -webdav=false \
  -s3.port.iceberg=0 -s3.port.lance=0 -master.telemetry=false
