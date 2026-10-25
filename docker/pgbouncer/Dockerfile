# ==============================================================================
# Larekmart - PgBouncer Dockerfile
# Production-ready PostgreSQL connection pooler for Daraz-scale concurrency
# ==============================================================================

FROM edoburu/pgbouncer:latest

USER root
COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY userlist.txt /etc/pgbouncer/userlist.txt
RUN chmod 0600 /etc/pgbouncer/userlist.txt && chown -R pgbouncer:pgbouncer /etc/pgbouncer

USER pgbouncer
EXPOSE 6432
ENTRYPOINT ["/usr/bin/pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
