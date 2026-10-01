# ==============================================================================
# Larekmart - OpenSearch 2.17 Search Node Dockerfile
# Hardened search engine adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=opensearchproject/opensearch:2.17.1
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/opensearch:2.17 .

FROM ${BASE_IMAGE}

# Expose standard OpenSearch REST API (9200) and Performance Analyzer (9600) ports
EXPOSE 9200 9600
