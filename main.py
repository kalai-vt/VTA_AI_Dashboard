import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import auth, company, crawler, documents, chat, leads, analytics, agent_settings
from app.database.connection import create_tables
from app.config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create uploads directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Create DB tables
    try:
        await create_tables()
    except Exception as e:
        print(f"Warning: Could not create tables: {e}")

    # Init Qdrant (optional - may not be running in dev)
    try:
        from app.services.qdrant_service import QdrantService
        qdrant = QdrantService()
        # Just test connection
        qdrant.client.get_collections()
        print("Qdrant connected successfully")
    except Exception as e:
        print(f"Warning: Qdrant not available: {e}")

    yield


app = FastAPI(
    title="AI Sales & Support Agent",
    version="1.0.0",
    description="Production-ready AI Sales & Support Agent API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(company.router, prefix="/company", tags=["company"])
app.include_router(crawler.router, prefix="/crawler", tags=["crawler"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(leads.router, prefix="/leads", tags=["leads"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(agent_settings.router, prefix="/agent", tags=["agent"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "AI Sales & Support Agent API", "docs": "/docs"}
