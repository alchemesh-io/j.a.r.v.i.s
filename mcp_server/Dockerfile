FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

FROM python:3.12-slim

RUN useradd --create-home --uid 1000 mcp
WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/api_client.py /app/server.py ./

USER mcp

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8080

CMD ["python", "server.py"]
