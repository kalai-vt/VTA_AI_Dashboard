from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database.connection import create_tables as init_db
from app.routes import auth, company, crawler, documents, chat, leads, analytics, agent_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs("uploads", exist_ok=True)
    yield


app = FastAPI(title="AI Sales Agent API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(company.router)
app.include_router(crawler.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(leads.router)
app.include_router(analytics.router)
app.include_router(agent_settings.router)

# Serve widget
if os.path.exists("widget"):
    app.mount("/widget", StaticFiles(directory="widget"), name="widget")


@app.get("/health")
async def health():
    return {"status": "ok"}
