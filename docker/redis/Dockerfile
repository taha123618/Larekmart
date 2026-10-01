# ==============================================================================
# Larekmart - Redis 7.4 Alpine Dockerfile
# Hardened in-memory cache adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=redis:7.4-alpine
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/redis:7.4 .

FROM ${BASE_IMAGE}

# Custom hardened Redis configuration (AOF persistence, LRU memory eviction)
COPY redis.conf /usr/local/etc/redis/redis.conf

EXPOSE 6379

CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
