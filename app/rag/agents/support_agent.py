from openai import AsyncOpenAI
from app.config.settings import settings
from app.services.embedding_service import embed_text
from app.services.qdrant_service import qdrant_service

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

SUPPORT_SYSTEM = """You are a Support Assistant. Help using the context below.
If unresolved, offer: "Let me connect you with our support team for further assistance."

Context:
{context}"""


async def run(message: str, company_id: str, conversation_history: list = []) -> str:
    query_vector = await embed_text(message)
    results = qdrant_service.search(company_id, query_vector, top_k=5)
    context = "\n\n---\n\n".join(r["payload"].get("text", "") for r in results if r.get("payload")) or "No relevant info."
    messages = [{"role": "system", "content": SUPPORT_SYSTEM.format(context=context)}]
    messages += conversation_history[-6:]
    messages.append({"role": "user", "content": message})
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL, messages=messages, temperature=0.3, max_tokens=500)
    return response.choices[0].message.content
