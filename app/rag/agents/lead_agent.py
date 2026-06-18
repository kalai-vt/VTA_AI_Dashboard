import json
from openai import AsyncOpenAI
from app.config.settings import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

LEAD_SYSTEM = """You are a Lead Qualification Assistant. Your goal:
1. Respond helpfully to the sales/purchase inquiry.
2. Naturally collect: name, email, phone, company, country, requirement, quantity.
3. Return JSON with keys: "response" (your reply string) and "lead_data" (dict of collected fields, or null).
Only include fields the user actually provided. Return valid JSON only."""


async def run(message: str, company_id: str, conversation_history: list = []) -> dict:
    messages = [{"role": "system", "content": LEAD_SYSTEM}]
    messages += conversation_history[-8:]
    messages.append({"role": "user", "content": message})
    try:
        resp = await client.chat.completions.create(
            model=settings.OPENAI_MODEL, messages=messages, temperature=0.5,
            max_tokens=600, response_format={"type": "json_object"})
        result = json.loads(resp.choices[0].message.content)
        return {
            "response": result.get("response", "Could you share your name, email, and requirements so we can send you a quote?"),
            "lead_data": result.get("lead_data"),
        }
    except Exception:
        return {
            "response": "Thank you for your interest! Please share your name, email, and requirements so we can send you a detailed quote.",
            "lead_data": None,
        }
