from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from typing import List, Optional, Dict, Any
from app.config.settings import settings
import uuid


class QdrantService:
    def __init__(self):
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
        )
        self.vector_size = 1536

    def collection_name(self, company_id: str) -> str:
        return f"company_{company_id.replace('-', '_')}"

    def ensure_collection(self, company_id: str):
        name = self.collection_name(company_id)
        existing = self.client.get_collections().collections
        existing_names = [c.name for c in existing]
        if name not in existing_names:
            self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )
        return name

    def upsert(self, company_id: str, vectors: List[List[float]], payloads: List[Dict], ids: List[str]):
        name = self.ensure_collection(company_id)
        points = [
            PointStruct(
                id=str(ids[i]),
                vector=vectors[i],
                payload=payloads[i],
            )
            for i in range(len(vectors))
        ]
        self.client.upsert(collection_name=name, points=points)

    def search(
        self,
        company_id: str,
        query_vector: List[float],
        top_k: int = 5,
        filter_payload: Optional[Dict] = None,
    ) -> List[Dict]:
        name = self.collection_name(company_id)
        # Check if collection exists
        existing = self.client.get_collections().collections
        existing_names = [c.name for c in existing]
        if name not in existing_names:
            return []

        query_filter = None
        if filter_payload:
            conditions = [
                FieldCondition(key=k, match=MatchValue(value=v))
                for k, v in filter_payload.items()
            ]
            query_filter = Filter(must=conditions)

        results = self.client.search(
            collection_name=name,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return [
            {"id": str(r.id), "score": r.score, "payload": r.payload}
            for r in results
        ]

    def delete_by_filter(self, company_id: str, filter_key: str, filter_value: str):
        name = self.collection_name(company_id)
        existing = self.client.get_collections().collections
        existing_names = [c.name for c in existing]
        if name not in existing_names:
            return
        self.client.delete(
            collection_name=name,
            points_selector=Filter(
                must=[FieldCondition(key=filter_key, match=MatchValue(value=filter_value))]
            ),
        )


qdrant_service = QdrantService()
