from openai import AsyncOpenAI
from app.config.settings import settings
import json

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

INTENTS = [
    "GREETING", "COMPANY_RELATED", "SALES_INQUIRY", "SUPPORT_REQUEST",
    "PRODUCT_INFORMATION", "EXPORT_INQUIRY", "RFQ_REQUEST",
    "CONTACT_REQUEST", "NON_COMPANY_RELATED"
]


async def classify_intent(message: str, history: list = []) -> dict:
    history_text = "\n".join([f"{m['role']}: {m['content']}" for m in history[-4:]])
    prompt = f"""Classify the user message intent.
Conversation history:
{history_text}

User message: {message}

Return JSON with:
- intent: one of {INTENTS}
- confidence: 0.0-1.0
- lead_score: 0-100 (how likely this person is a buyer)
- capture_lead: true/false (should we collect contact info)

Only return valid JSON."""

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are an intent classifier. Return only JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0,
        response_format={"type": "json_object"}
    )
    try:
        result = json.loads(response.choices[0].message.content)
        return {
            "intent": result.get("intent", "COMPANY_RELATED"),
            "confidence": float(result.get("confidence", 0.8)),
            "lead_score": int(result.get("lead_score", 0)),
            "capture_lead": bool(result.get("capture_lead", False))
        }
    except Exception:
        return {"intent": "COMPANY_RELATED", "confidence": 0.5, "lead_score": 0, "capture_lead": False}
