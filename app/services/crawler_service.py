import uuid
import asyncio
from datetime import datetime
from typing import List, Set
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.models import WebsitePage, KnowledgeChunk
from app.services.embedding_service import embed_batch
from app.services.qdrant_service import qdrant_service


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
        if start >= len(text):
            break
    return [c for c in chunks if c.strip()]


def extract_main_content(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    # Remove non-content tags
    for tag in soup(["nav", "header", "footer", "script", "style", "noscript", "aside", "iframe"]):
        tag.decompose()
    # Get text
    text = soup.get_text(separator=" ", strip=True)
    # Clean whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return " ".join(lines)


async def crawl_website(
    company_id: str,
    start_url: str,
    max_pages: int = 20,
    db: AsyncSession = None,
) -> dict:
    visited: Set[str] = set()
    queue: List[str] = [start_url]
    pages_crawled = 0
    chunks_created = 0

    parsed_start = urlparse(start_url)
    base_domain = parsed_start.netloc

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        while queue and pages_crawled < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                response = await client.get(url)
                if response.status_code != 200:
                    continue
                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type:
                    continue

                html = response.text
                soup = BeautifulSoup(html, "lxml")
                title = soup.title.string.strip() if soup.title and soup.title.string else url
                content = extract_main_content(html)

                if not content:
                    continue

                # Save page
                page = WebsitePage(
                    company_id=company_id,
                    url=url,
                    title=title,
                    content=content,
                    status="done",
                    crawled_at=datetime.utcnow(),
                )
                db.add(page)
                await db.flush()

                # Chunk and embed
                chunks = chunk_text(content)
                if chunks:
                    embeddings = await embed_batch(chunks)
                    vectors = []
                    payloads = []
                    ids = []
                    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                        chunk_id = str(uuid.uuid4())
                        knowledge_chunk = KnowledgeChunk(
                            id=chunk_id,
                            company_id=company_id,
                            source_type="webpage",
                            source_id=str(page.id),
                            chunk_text=chunk,
                            chunk_index=idx,
                            embedding_id=chunk_id,
                        )
                        db.add(knowledge_chunk)
                        vectors.append(embedding)
                        payloads.append({
                            "source_type": "webpage",
                            "source_id": str(page.id),
                            "chunk_text": chunk[:500],
                            "url": url,
                            "title": title,
                        })
                        ids.append(chunk_id)
                        chunks_created += 1

                    qdrant_service.upsert(company_id, vectors, payloads, ids)

                pages_crawled += 1

                # Collect links (BFS)
                if pages_crawled < max_pages:
                    for link in soup.find_all("a", href=True):
                        href = link["href"]
                        full_url = urljoin(url, href)
                        parsed = urlparse(full_url)
                        if parsed.netloc == base_domain and full_url not in visited:
                            # Remove fragment
                            clean_url = parsed._replace(fragment="").geturl()
                            if clean_url not in visited and clean_url not in queue:
                                queue.append(clean_url)

            except Exception as e:
                print(f"Error crawling {url}: {e}")
                continue

    return {
        "pages_crawled": pages_crawled,
        "chunks_created": chunks_created,
        "status": "done",
    }
