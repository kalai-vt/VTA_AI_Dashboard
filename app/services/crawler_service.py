import asyncio
import uuid
from datetime import datetime
from typing import List, Set, Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.models import WebsitePage, KnowledgeChunk, SourceType
from app.config.settings import settings


class CrawlerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def crawl_website(self, company_id: str, start_url: str, max_pages: int = 50) -> dict:
        visited: Set[str] = set()
        queue: List[str] = [start_url]
        pages_crawled = 0
        chunks_created = 0

        parsed_start = urlparse(start_url)
        base_domain = parsed_start.netloc

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            while queue and pages_crawled < max_pages:
                url = queue.pop(0)
                if url in visited:
                    continue
                visited.add(url)

                try:
                    response = await client.get(url)
                    if response.status_code != 200:
                        continue
                    if "text/html" not in response.headers.get("content-type", ""):
                        continue

                    soup = BeautifulSoup(response.text, "html.parser")
                    title = soup.title.string.strip() if soup.title and soup.title.string else url
                    content = self._extract_content(soup)

                    if not content.strip():
                        continue

                    # Save page
                    page = WebsitePage(
                        company_id=company_id,
                        url=url,
                        title=title,
                        content=content,
                        status="crawled",
                        crawled_at=datetime.utcnow(),
                    )
                    self.db.add(page)
                    await self.db.flush()
                    pages_crawled += 1

                    # Chunk and store
                    chunks = self._chunk_text(content)
                    for i, chunk in enumerate(chunks):
                        kc = KnowledgeChunk(
                            company_id=company_id,
                            source_type=SourceType.webpage,
                            source_id=page.id,
                            chunk_text=chunk,
                            chunk_index=i,
                        )
                        self.db.add(kc)
                        chunks_created += 1

                    await self.db.flush()

                    # Try to generate embeddings
                    try:
                        from app.services.embedding_service import EmbeddingService
                        embedding_svc = EmbeddingService(self.db)
                        vectors = await embedding_svc.embed_batch(chunks)
                        await embedding_svc.store_chunks(
                            company_id=company_id,
                            chunks=chunks,
                            source_type="webpage",
                            source_id=str(page.id),
                            vectors=vectors,
                        )
                    except Exception:
                        pass  # Embedding is optional, don't fail crawl

                    # Find links
                    for a_tag in soup.find_all("a", href=True):
                        href = a_tag["href"]
                        full_url = urljoin(url, href)
                        parsed = urlparse(full_url)
                        if parsed.netloc == base_domain and full_url not in visited:
                            # Remove fragments
                            clean_url = parsed._replace(fragment="").geturl()
                            if clean_url not in visited and clean_url not in queue:
                                queue.append(clean_url)

                except Exception:
                    continue

        return {"pages_crawled": pages_crawled, "chunks_created": chunks_created}

    def _extract_content(self, soup: BeautifulSoup) -> str:
        # Remove unwanted tags
        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        # Try to find main content area
        main = soup.find("main") or soup.find("article") or soup.find("div", class_="content") or soup.find("body")
        if not main:
            main = soup

        # Extract text from relevant tags
        content_parts = []
        for tag in main.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th"]):
            text = tag.get_text(separator=" ", strip=True)
            if text and len(text) > 10:
                content_parts.append(text)

        return "\n".join(content_parts)

    def _chunk_text(self, text: str) -> List[str]:
        max_size = settings.MAX_CHUNK_SIZE
        overlap = settings.CHUNK_OVERLAP
        chunks = []

        if len(text) <= max_size:
            return [text] if text.strip() else []

        start = 0
        while start < len(text):
            end = start + max_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk)
            start = end - overlap
            if start >= len(text):
                break

        return chunks
