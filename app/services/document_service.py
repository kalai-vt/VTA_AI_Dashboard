import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.models import Document, KnowledgeChunk
from app.services.crawler_service import chunk_text
from app.services.embedding_service import embed_batch
from app.services.qdrant_service import qdrant_service


async def process_pdf(file_path: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n".join(text_parts)


async def process_docx(file_path: str) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


async def process_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def process_document(
    company_id: str,
    document_id: str,
    file_path: str,
    file_type: str,
    db: AsyncSession,
):
    # Extract text
    if file_type == "pdf":
        text = await process_pdf(file_path)
    elif file_type == "docx":
        text = await process_docx(file_path)
    else:
        text = await process_txt(file_path)

    if not text.strip():
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if doc:
            doc.status = "error"
        return

    # Chunk text
    chunks = chunk_text(text)
    if not chunks:
        return

    # Embed chunks
    embeddings = await embed_batch(chunks)

    vectors = []
    payloads = []
    ids = []

    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_id = str(uuid.uuid4())
        knowledge_chunk = KnowledgeChunk(
            id=chunk_id,
            company_id=company_id,
            source_type="document",
            source_id=document_id,
            chunk_text=chunk,
            chunk_index=idx,
            embedding_id=chunk_id,
        )
        db.add(knowledge_chunk)
        vectors.append(embedding)
        payloads.append({
            "source_type": "document",
            "source_id": document_id,
            "chunk_text": chunk[:500],
        })
        ids.append(chunk_id)

    qdrant_service.upsert(company_id, vectors, payloads, ids)

    # Update document status
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if doc:
        doc.status = "done"
        doc.chunk_count = len(chunks)

    await db.flush()
