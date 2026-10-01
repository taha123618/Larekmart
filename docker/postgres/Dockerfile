# ==============================================================================
# Larekmart - PostgreSQL with pgvector Dockerfile
# Hardened database engine adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=pgvector/pgvector:pg16
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/postgres:16 .

FROM ${BASE_IMAGE}

# Provision multiple databases for all microservices on first startup
COPY init-multiple-databases.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-multiple-databases.sh

EXPOSE 5432
