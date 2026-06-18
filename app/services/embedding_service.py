import asyncio
import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.settings import settings
from app.database.models import KnowledgeChunk, SourceType


class EmbeddingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def embed_text(self, text: str) -> List[float]:
        response = await self.client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=text
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        batch_size = 20
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = await self.client.embeddings.create(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    input=batch
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                # Return zeros for failed batch
                for _ in batch:
                    all_embeddings.append([0.0] * 1536)
            await asyncio.sleep(0.1)  # Rate limit protection

        return all_embeddings

    async def store_chunks(
        self,
        company_id: str,
        chunks: List[str],
        source_type: str,
        source_id: str,
        vectors: List[List[float]]
    ):
        from app.services.qdrant_service import QdrantService
        qdrant = QdrantService()

        # Ensure collection exists
        try:
            qdrant.create_collection(company_id)
        except Exception:
            pass

        collection_name = qdrant.get_collection_name(company_id)
        chunk_ids = []

        # Store in DB
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            chunk_id = str(uuid.uuid4())
            kc = KnowledgeChunk(
                id=chunk_id,
                company_id=company_id,
                source_type=SourceType(source_type),
                source_id=source_id,
                chunk_text=chunk,
                chunk_index=i,
                embedding_id=chunk_id,
            )
            self.db.add(kc)
            chunk_ids.append(chunk_id)

        await self.db.flush()

        # Store in Qdrant
        payloads = [
            {
                "chunk_text": chunk,
                "source_type": source_type,
                "source_id": source_id,
                "company_id": company_id,
                "chunk_index": i,
            }
            for i, chunk in enumerate(chunks)
        ]

        try:
            qdrant.upsert_vectors(collection_name, vectors, payloads, chunk_ids)
        except Exception:
            pass  # DB chunks already saved

    async def search_similar(self, company_id: str, query: str, top_k: int = 5) -> List[dict]:
        try:
            query_vector = await self.embed_text(query)
            from app.services.qdrant_service import QdrantService
            qdrant = QdrantService()
            collection_name = qdrant.get_collection_name(company_id)
            results = qdrant.search(collection_name, query_vector, top_k=top_k, company_id=company_id)
            return results
        except Exception:
            # Fallback: search DB directly
            result = await self.db.execute(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.company_id == company_id)
                .limit(top_k)
            )
            chunks = result.scalars().all()
            return [
                {
                    "text": c.chunk_text,
                    "score": 0.5,
                    "source_type": c.source_type.value if c.source_type else "unknown",
                    "source_id": str(c.source_id),
                }
                for c in chunks
            ]
