#!/bin/sh
set -eu

SMART_RUNTIME_PASSWORD=$(tr -d '\r\n' < /run/secrets/runtime_password)
export SMART_RUNTIME_PASSWORD

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv runtime_password SMART_RUNTIME_PASSWORD
\getenv database_name POSTGRES_DB
CREATE ROLE smart_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'runtime_password';
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO smart_api;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

unset SMART_RUNTIME_PASSWORD
