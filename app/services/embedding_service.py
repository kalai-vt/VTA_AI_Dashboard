from openai import AsyncOpenAI
from app.config.settings import settings
from typing import List

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def embed_text(text: str) -> List[float]:
    response = await client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=text[:8000]
    )
    return response.data[0].embedding


async def embed_batch(texts: List[str]) -> List[List[float]]:
    results = []
    for i in range(0, len(texts), 100):
        batch = [t[:8000] for t in texts[i:i+100]]
        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=batch
        )
        results.extend([d.embedding for d in response.data])
    return results
