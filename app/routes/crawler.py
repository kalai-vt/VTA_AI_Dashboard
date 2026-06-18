import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db, AsyncSessionLocal
from app.database.models import User, WebsitePage, KnowledgeChunk
from app.utils.security import get_current_user

router = APIRouter(prefix="/crawler", tags=["crawler"])


class CrawlRequest(BaseModel):
    website_url: str
    max_pages: int = 20


async def run_crawl_background(company_id: str, website_url: str, max_pages: int):
    from app.services.crawler_service import crawl_website
    async with AsyncSessionLocal() as db:
        try:
            await crawl_website(company_id, website_url, max_pages, db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Crawl error: {e}")


@router.post("/start")
async def start_crawl(
    req: CrawlRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    job_id = str(uuid.uuid4())
    background_tasks.add_task(
        run_crawl_background,
        str(current_user.company_id),
        req.website_url,
        req.max_pages,
    )
    return {"job_id": job_id, "status": "started", "message": f"Crawling {req.website_url}"}


@router.get("/pages")
async def list_pages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebsitePage).where(WebsitePage.company_id == current_user.company_id)
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


@router.get("/pages/{page_id}")
async def get_page(
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebsitePage).where(
            WebsitePage.id == page_id,
            WebsitePage.company_id == current_user.company_id,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return {
        "id": str(page.id),
        "url": page.url,
        "title": page.title,
        "content": page.content,
        "status": page.status,
        "crawled_at": page.crawled_at.isoformat() if page.crawled_at else None,
    }


@router.delete("/pages/{page_id}")
async def delete_page(
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebsitePage).where(
            WebsitePage.id == page_id,
            WebsitePage.company_id == current_user.company_id,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Delete associated chunks
    await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.source_type == "webpage",
            KnowledgeChunk.source_id == str(page.id),
        )
    )
    await db.delete(page)
    return {"message": "Page deleted successfully"}
