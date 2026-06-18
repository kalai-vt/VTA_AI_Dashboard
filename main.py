import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database.connection import init_db
from app.config.settings import settings
from app.routes import auth, company, crawler, documents, chat, leads, analytics, agent_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown


app = FastAPI(
    title="AI Sales & Support Agent API",
    description="SaaS backend for AI-powered sales and support agents",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(company.router)
app.include_router(crawler.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(leads.router)
app.include_router(analytics.router)
app.include_router(agent_settings.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "AI Sales Agent API"}
