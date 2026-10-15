# ==============================================================================
# Larekmart - MySQL 8.4 LTS Dockerfile
# Hardened database engine adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=mysql:8.4
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/mysql:8.4 .

FROM ${BASE_IMAGE}

# Provision databases for microservices on first startup
COPY init-multiple-databases.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-multiple-databases.sh

EXPOSE 3306
