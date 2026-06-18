from app.config.settings import settings


class GreetingAgent:
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
        welcome_message = company_context.get("welcome_message", "")

        system_prompt = f"""You are {agent_name}, a friendly AI assistant for {company_name}.
{f'Default greeting: {welcome_message}' if welcome_message else ''}

Greet the user warmly, introduce yourself, and let them know what you can help with.
Keep the response concise (2-3 sentences). Be professional and friendly."""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *conversation_history[-3:],
                    {"role": "user", "content": message},
                ],
                max_tokens=200,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception:
            return f"Hello! I'm {agent_name} for {company_name}. How can I help you today?"
