# ==============================================================================
# Larekmart - Nginx Reverse Proxy Dockerfile
# Provides high-performance reverse proxying for Dozzle live container logs.
# ==============================================================================

ARG BASE_IMAGE=nginx:alpine

FROM ${BASE_IMAGE}

# Custom Nginx configuration with SSE / WebSocket streaming support
COPY nginx.conf /etc/nginx/nginx.conf

# Verify Nginx configuration syntax
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
