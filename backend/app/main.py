from contextlib import asynccontextmanager

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi import FastAPI

from app.db.base import Base
from app.db.engine import engine
from app.routes import (
    blockers,
    dailies,
    daily_tasks,
    gcal,
    jira,
    key_focuses,
    repositories,
    skills,
    task_blockers,
    task_key_focuses,
    task_notes,
    tasks,
    weeklies,
    workers,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401 — register all models on the metadata

    alembic_cfg = Config("alembic.ini")
    # A fresh database has no alembic_version. The historical migrations were
    # authored against SQLite (native enums etc. that don't replay on
    # PostgreSQL), so on a greenfield DB build the schema from the current
    # models and stamp head; on an existing DB, apply incremental migrations.
    with engine.connect() as conn:
        has_history = sa.inspect(conn).has_table("alembic_version")
    if has_history:
        command.upgrade(alembic_cfg, "head")
    else:
        Base.metadata.create_all(bind=engine)
        command.stamp(alembic_cfg, "head")
    yield


app = FastAPI(
    title="J.A.R.V.I.S",
    description="Just A Rather Very Intelligent System",
    lifespan=lifespan,
)

app.include_router(tasks.router, prefix="/api/v1")
app.include_router(task_notes.router, prefix="/api/v1")
app.include_router(weeklies.router, prefix="/api/v1")
app.include_router(dailies.router, prefix="/api/v1")
app.include_router(daily_tasks.router, prefix="/api/v1")
app.include_router(jira.router, prefix="/api/v1")
app.include_router(gcal.router, prefix="/api/v1")
app.include_router(key_focuses.router, prefix="/api/v1")
app.include_router(blockers.router, prefix="/api/v1")
app.include_router(task_blockers.router, prefix="/api/v1")
app.include_router(task_key_focuses.router, prefix="/api/v1")
app.include_router(repositories.router, prefix="/api/v1")
app.include_router(skills.router, prefix="/api/v1")
app.include_router(workers.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "J.A.R.V.I.S is online"}


@app.get("/health")
def health():
    return {"status": "ok"}
