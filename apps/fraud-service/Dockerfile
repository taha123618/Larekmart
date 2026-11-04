# ==============================================================================
# Larekmart - Fraud Detection Service (Python + uv) Dockerfile
# Hardened multi-stage container adhering to Docker Hardened Images standards.
# ==============================================================================

ARG BASE_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm-slim

FROM ${BASE_IMAGE} AS runner

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1
ENV UV_HTTP_TIMEOUT=120
ENV PORT=8024

RUN groupadd -g 1001 pygroup && \
    useradd -u 1001 -g pygroup -m -s /bin/bash appuser

COPY pyproject.toml uv.lock* ./

RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -f uv.lock ]; then \
      uv sync --frozen --no-dev --no-install-project; \
    else \
      uv sync --no-dev --no-install-project; \
    fi

COPY --chown=appuser:pygroup . .

RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -f uv.lock ]; then \
      uv sync --frozen --no-dev; \
    else \
      uv sync --no-dev; \
    fi

USER appuser

EXPOSE 8024

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8024"]

