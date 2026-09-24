# Start from the official PostgreSQL base image
FROM postgres:17

# Optional: Copy a custom SQL script to initialize tables or users
COPY init.sql /docker-entrypoint-initdb.d/

# Expose the default PostgreSQL port
EXPOSE 5432
