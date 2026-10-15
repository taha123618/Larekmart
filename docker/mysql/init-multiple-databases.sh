#!/bin/bash
set -e
set -u

function create_database() {
    local database=$1
    echo "Checking / creating MySQL database '$database'..."
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
        CREATE DATABASE IF NOT EXISTS \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOSQL
}

if [ -n "${MYSQL_MULTIPLE_DATABASES:-}" ]; then
    echo "Multiple MySQL databases requested: $MYSQL_MULTIPLE_DATABASES"
    for db in $(echo $MYSQL_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database "$db"
    done
    echo "All requested MySQL databases ensured."
fi
