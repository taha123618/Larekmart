# Start from the official Redis base image
FROM redis:7.4

# Copy a custom configuration file into the container
COPY redis.conf /usr/local/etc/redis/redis.conf

# Run Redis using the custom configuration
CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]
