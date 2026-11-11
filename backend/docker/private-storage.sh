#!/bin/sh
set -eu
export WEED_ADMIN_PASSWORD="$(tr -d '\r\n' < /run/secrets/private_admin_password)"
exec weed mini -dir=/data -ip=private-storage -ip.bind=0.0.0.0 \
  -master.port=9333 -volume.port=9340 -filer.port=8888 -s3.port=8333 \
  -s3.config=/run/secrets/private_identities \
  -admin.port=23646 -admin.dataDir=/data/admin -webdav=false \
  -s3.port.iceberg=0 -s3.port.lance=0 -master.telemetry=false
