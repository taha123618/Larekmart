FROM pgvector/pgvector:pg16

COPY init-multiple-databases.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-multiple-databases.sh

EXPOSE 5432
