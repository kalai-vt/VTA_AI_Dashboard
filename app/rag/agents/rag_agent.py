from openai import AsyncOpenAI
from app.config.settings import settings
from app.services.embedding_service import embed_text
from app.services.qdrant_service import qdrant_service

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """You are an AI Sales and Support Assistant. Answer ONLY using the context below.
Never hallucinate. Never invent prices, specs, or certifications.
If the answer is not in the context respond: "I could not find that information in our knowledge base. I can connect you with our team."

Context:
{context}"""


async def run(message: str, company_id: str, conversation_history: list = []) -> str:
    query_vector = await embed_text(message)
    results = qdrant_service.search(company_id, query_vector, top_k=5)
    if not results:
        return "I could not find that information in our knowledge base. I can connect you with our team."
    context = "\n\n---\n\n".join(r["payload"].get("text", "") for r in results if r.get("payload"))
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(context=context)}]
    messages += conversation_history[-6:]
    messages.append({"role": "user", "content": message})
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL, messages=messages, temperature=0.3, max_tokens=600)
    return response.choices[0].message.content
