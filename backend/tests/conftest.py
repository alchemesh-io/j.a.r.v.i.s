import datetime
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import *  # noqa: F401,F403 — import all models for metadata


@pytest.fixture(autouse=True)
def db_session():
    engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_sqlite_wal(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestSession()

    def override_get_db():
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    app.dependency_overrides.clear()
    if os.path.exists("test.db"):
        os.remove("test.db")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_date():
    return datetime.date(2026, 3, 30)
