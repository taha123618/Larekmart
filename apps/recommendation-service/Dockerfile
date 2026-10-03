# ==============================================================================
# Larekmart - Recommendation Service (Python + uv) Dockerfile
# Hardened build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm-slim
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/python:3.12 .

FROM ${BASE_IMAGE} AS runner

WORKDIR /app

# Enable bytecode compilation and unbuffered logging
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1
ENV UV_HTTP_TIMEOUT=120

# Security: Create unprivileged application user
RUN groupadd -g 1001 pygroup && \
    useradd -u 1001 -g pygroup -m -s /bin/bash appuser

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source code and adjust ownership
COPY . .
RUN chown -R appuser:pygroup /app

# Sync project
RUN uv sync --frozen --no-dev

USER appuser

EXPOSE 8008

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]
