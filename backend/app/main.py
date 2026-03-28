import os

from fastapi import FastAPI
from sqlalchemy import create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/jarvis.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI(title="J.A.R.V.I.S", description="Just A Rather Very Intelligent System")


@app.get("/")
def root():
    return {"message": "J.A.R.V.I.S is online"}


@app.get("/health")
def health():
    return {"status": "ok"}
