# ==============================================================================
# Larekmart - Nginx Reverse Proxy Dockerfile
# ==============================================================================

FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf

RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
