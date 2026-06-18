from openai import AsyncOpenAI
from app.config.settings import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def run(message: str, company_name: str = "our company") -> str:
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    f"You are a friendly AI sales and support assistant for {company_name}. "
                    "Greet the visitor warmly and let them know you can help with products, "
                    "services, quotations, and business inquiries. Be concise (2-3 sentences)."
                ),
            },
            {"role": "user", "content": message},
        ],
        temperature=0.7,
        max_tokens=150,
    )
    return response.choices[0].message.content
