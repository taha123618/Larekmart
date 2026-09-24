# Start from the official MongoDB base image
FROM mongo:8.0

# Optional: Copy a custom initialization script (runs on first startup)
COPY init-db.js /docker-entrypoint-initdb.d/

# Expose the default MongoDB port
EXPOSE 27017
