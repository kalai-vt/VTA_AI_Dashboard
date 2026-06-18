import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database.connection import get_db
from app.database.models import User, WebsitePage
from app.utils.security import get_current_active_user

router = APIRouter()

# In-memory job tracking
crawler_jobs: dict = {}


class CrawlRequest(BaseModel):
    website_url: str
    max_pages: int = 50


@router.post("/start")
async def start_crawl(
    request: CrawlRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    job_id = str(uuid.uuid4())
    crawler_jobs[job_id] = {
        "status": "started",
        "pages_crawled": 0,
        "total_pages": 0,
        "company_id": str(current_user.company_id),
    }

    async def run_crawl():
        from app.services.crawler_service import CrawlerService
        from app.database.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            try:
                crawler_jobs[job_id]["status"] = "running"
                service = CrawlerService(session)
                result = await service.crawl_website(
                    str(current_user.company_id),
                    request.website_url,
                    request.max_pages
                )
                crawler_jobs[job_id]["status"] = "completed"
                crawler_jobs[job_id]["pages_crawled"] = result.get("pages_crawled", 0)
                crawler_jobs[job_id]["total_pages"] = result.get("pages_crawled", 0)
            except Exception as e:
                crawler_jobs[job_id]["status"] = "failed"
                crawler_jobs[job_id]["error"] = str(e)

    asyncio.create_task(run_crawl())

    return {"job_id": job_id, "status": "started"}


@router.get("/status/{job_id}")
async def get_crawl_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if job_id not in crawler_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = crawler_jobs[job_id]
    if job.get("company_id") != str(current_user.company_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "job_id": job_id,
        "status": job["status"],
        "pages_crawled": job.get("pages_crawled", 0),
        "total_pages": job.get("total_pages", 0),
        "error": job.get("error"),
    }


@router.get("/pages")
async def list_pages(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WebsitePage)
        .where(WebsitePage.company_id == current_user.company_id)
        .offset(skip)
        .limit(limit)
    )
    pages = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "url": p.url,
            "title": p.title,
            "status": p.status,
            "crawled_at": p.crawled_at.isoformat() if p.crawled_at else None,
        }
        for p in pages
    ]
