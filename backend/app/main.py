from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI

from app.routes import (
    blockers,
    dailies,
    daily_tasks,
    gcal,
    jira,
    key_focuses,
    task_blockers,
    task_key_focuses,
    task_notes,
    tasks,
    weeklies,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
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


@app.get("/")
def root():
    return {"message": "J.A.R.V.I.S is online"}


@app.get("/health")
def health():
    return {"status": "ok"}
