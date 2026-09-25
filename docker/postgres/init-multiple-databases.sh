#!/bin/bash
set -e
set -u

function create_database() {
    local database=$1
    echo "Checking / creating database '$database'..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "Multiple databases requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database "$db"
    done
    echo "All requested databases ensured."
fi

# Enable pgvector extension on recommendation_db
echo "Ensuring vector extension on recommendation_db..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "recommendation_db" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
echo "pgvector enabled on recommendation_db."
