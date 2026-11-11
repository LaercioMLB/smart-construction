# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv
WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/opt/venv UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

FROM dependencies AS test
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project
ENV PATH="/opt/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
COPY tests ./tests
COPY alembic.ini ./
CMD ["pytest"]

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN groupadd --gid 10001 api \
    && useradd --uid 10001 --gid 10001 --no-log-init --home-dir /app --shell /usr/sbin/nologin api
COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=api:api app ./app
COPY --chown=api:api migrations ./migrations
COPY --chown=api:api alembic.ini ./
USER api
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/api/v1/health/ready', timeout=4).close()"
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
