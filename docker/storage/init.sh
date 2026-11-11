#!/bin/sh
set -eu

export AWS_ACCESS_KEY_ID="$(cat /run/secrets/storage_access_key)"
export AWS_SECRET_ACCESS_KEY="$(cat /run/secrets/storage_secret_key)"

attempt=0
until aws --endpoint-url http://storage:8333 s3api list-buckets >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo 'O endpoint S3 nao ficou disponivel.' >&2
    exit 1
  fi
  sleep 2
done

if ! aws --endpoint-url http://storage:8333 s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
  aws --endpoint-url http://storage:8333 s3api create-bucket --bucket "$S3_BUCKET" >/dev/null
fi

cat > /tmp/public-read.json <<EOF
{"Version":"2012-10-17","Statement":[{"Sid":"PublicImages","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::$S3_BUCKET/*"}]}
EOF

aws --endpoint-url http://storage:8333 s3api put-bucket-policy \
  --bucket "$S3_BUCKET" --policy file:///tmp/public-read.json

aws --endpoint-url http://storage:8333 s3 sync /seed "s3://$S3_BUCKET" \
  --no-overwrite --no-follow-symlinks --cache-control 'public,max-age=300' --only-show-errors

/bin/sh /opt/storage/cli.sh index
echo 'Bucket pronto. Carga inicial concluida sem sobrescrever arquivos existentes.'
