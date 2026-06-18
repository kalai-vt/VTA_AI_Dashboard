import os
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.models import Document, DocumentStatus, KnowledgeChunk, SourceType
from app.config.settings import settings


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_document(self, company_id: str, document_id: str, file_path: str, file_type: str):
        # Get document
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            return

        # Update status to processing
        doc.status = DocumentStatus.processing
        await self.db.flush()

        try:
            text = self._extract_text(file_path, file_type)
            chunks = self._chunk_text(text)

            # Store chunks
            chunk_count = 0
            vectors = []

            try:
                from app.services.embedding_service import EmbeddingService
                embedding_svc = EmbeddingService(self.db)
                vectors = await embedding_svc.embed_batch(chunks)
                await embedding_svc.store_chunks(
                    company_id=company_id,
                    chunks=chunks,
                    source_type="document",
                    source_id=document_id,
                    vectors=vectors,
                )
            except Exception:
                # Store chunks without embeddings
                for i, chunk in enumerate(chunks):
                    kc = KnowledgeChunk(
                        company_id=company_id,
                        source_type=SourceType.document,
                        source_id=document_id,
                        chunk_text=chunk,
                        chunk_index=i,
                    )
                    self.db.add(kc)
                    chunk_count += 1
                await self.db.flush()

            doc.chunk_count = len(chunks)
            doc.status = DocumentStatus.done
            await self.db.flush()

        except Exception as e:
            doc.status = DocumentStatus.failed
            await self.db.flush()
            raise e

    def _extract_text(self, file_path: str, file_type: str) -> str:
        if file_type == "pdf":
            return self._extract_pdf(file_path)
        elif file_type == "docx":
            return self._extract_docx(file_path)
        elif file_type == "txt":
            return self._extract_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _extract_pdf(self, file_path: str) -> str:
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"Failed to extract PDF: {str(e)}")

    def _extract_docx(self, file_path: str) -> str:
        try:
            from docx import Document
            doc = Document(file_path)
            text_parts = []
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)
            return "\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"Failed to extract DOCX: {str(e)}")

    def _extract_txt(self, file_path: str) -> str:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            raise ValueError(f"Failed to read TXT: {str(e)}")

    def _chunk_text(self, text: str) -> List[str]:
        max_size = settings.MAX_CHUNK_SIZE
        overlap = settings.CHUNK_OVERLAP
        chunks = []

        if not text.strip():
            return []

        if len(text) <= max_size:
            return [text]

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
