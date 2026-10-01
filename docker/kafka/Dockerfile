# ==============================================================================
# Larekmart - Apache Kafka 3.8 KRaft Broker Dockerfile
# Hardened event bus adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=apache/kafka:3.8.0
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/kafka:3.8 .

FROM ${BASE_IMAGE}

# Expose internal (9092), controller (9093), and external listener (9094) ports
EXPOSE 9092 9093 9094
