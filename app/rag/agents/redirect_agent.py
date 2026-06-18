from app.config.settings import settings


class RedirectAgent:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def respond(self, message: str, company_context: dict, conversation_history: list) -> str:
        company_name = company_context.get("name", "our company")
        agent_name = company_context.get("agent_name", "AI Assistant")

        system_prompt = f"""You are {agent_name} for {company_name}.

The user has asked something that is not related to {company_name}'s products or services.
Politely acknowledge their question, explain that you can only help with {company_name}-related topics,
and suggest what you CAN help them with (products, support, pricing, etc.).

Be friendly and brief. Don't be dismissive."""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=150,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception:
            return f"I'm here specifically to help with questions about {company_name}. I can assist you with our products, services, pricing, or support. What would you like to know?"
