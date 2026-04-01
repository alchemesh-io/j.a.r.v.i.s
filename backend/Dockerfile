# Stage 1: build dependencies
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Stage 2: runtime
FROM python:3.12-slim AS runtime

# Create non-root user (UID 1000)
RUN useradd --uid 1000 --no-create-home --shell /bin/false appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app/ ./app/
COPY --from=builder /app/alembic/ ./alembic/
COPY --from=builder /app/alembic.ini ./

# Data directory for SQLite (must be writable by appuser)
RUN mkdir -p /data && chown appuser:appuser /data

USER appuser

ENV PATH="/app/.venv/bin:$PATH"
ENV DATABASE_URL=sqlite:////data/jarvis.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
