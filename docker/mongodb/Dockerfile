# ==============================================================================
# Larekmart - MongoDB 7.0 Dockerfile
# Hardened document store adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=mongo:7.0-jammy
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/mongodb:7.0 .

FROM ${BASE_IMAGE}

# Automated initialization script for databases and collections
COPY init-db.js /docker-entrypoint-initdb.d/

EXPOSE 27017
