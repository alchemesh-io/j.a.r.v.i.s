import os

from sqlalchemy import create_engine, event

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/jarvis.db")

_is_sqlite = DATABASE_URL.startswith("sqlite")

# check_same_thread is a SQLite-only pysqlite arg; other drivers (e.g. psycopg
# for Postgres) reject it. Non-SQLite backends also benefit from pre-ping to
# survive dropped connections through the Cloud SQL proxy.
if _is_sqlite:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)


@event.listens_for(engine, "connect")
def _set_sqlite_wal(dbapi_connection, connection_record):
    if _is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
