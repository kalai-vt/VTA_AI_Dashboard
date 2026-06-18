import uuid
from typing import List, Optional
from app.config.settings import settings


class QdrantService:
    def __init__(self):
        self._client = None
        self.vector_size = 1536  # ada-002

    @property
    def client(self):
        if self._client is None:
            from qdrant_client import QdrantClient
            self._client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        return self._client

    def get_collection_name(self, company_id: str) -> str:
        return f"company_{company_id.replace('-', '_')}"

    def create_collection(self, company_id: str):
        from qdrant_client.models import Distance, VectorParams
        collection_name = self.get_collection_name(company_id)
        existing = self.client.get_collections().collections
        existing_names = [c.name for c in existing]
        if collection_name not in existing_names:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )

    def upsert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[dict],
        ids: List[str]
    ):
        from qdrant_client.models import PointStruct
        points = [
            PointStruct(
                id=str(uuid.UUID(id_str)) if "-" in id_str else id_str,
                vector=vector,
                payload=payload,
            )
            for id_str, vector, payload in zip(ids, vectors, payloads)
        ]
        if points:
            self.client.upsert(collection_name=collection_name, points=points)

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 5,
        company_id: Optional[str] = None
    ) -> List[dict]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        search_filter = None
        if company_id:
            search_filter = Filter(
                must=[FieldCondition(key="company_id", match=MatchValue(value=company_id))]
            )
        results = self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=top_k,
            query_filter=search_filter,
        )
        return [
            {
                "text": r.payload.get("chunk_text", ""),
                "score": r.score,
                "source_type": r.payload.get("source_type", ""),
                "source_id": r.payload.get("source_id", ""),
            }
            for r in results
        ]

    def delete_by_source(self, collection_name: str, source_id: str):
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        self.client.delete(
            collection_name=collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="source_id", match=MatchValue(value=source_id))]
            ),
        )
