# Start from the official MongoDB base image
# Reference: https://hub.docker.com/_/mongo
FROM mongo:latest

# Copy initialization script (automatically executed on first container startup)
COPY init-db.js /docker-entrypoint-initdb.d/

# Expose the default MongoDB port
EXPOSE 27017
