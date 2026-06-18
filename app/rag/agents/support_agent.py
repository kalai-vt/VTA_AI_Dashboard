from app.config.settings import settings


class SupportAgent:
    def __init__(self, db):
        self.db = db
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def respond(self, message: str, company_id: str, company_context: dict, conversation_history: list) -> str:
        company_name = company_context.get("name", "our company")
        agent_name = company_context.get("agent_name", "AI Assistant")
        support_email = company_context.get("support_email", "")

        # Search knowledge base
        context_chunks = []
        try:
            from app.services.embedding_service import EmbeddingService
            embedding_svc = EmbeddingService(self.db)
            results = await embedding_svc.search_similar(company_id, message, top_k=5)
            context_chunks = [r["text"] for r in results if r.get("text")]
        except Exception:
            pass

        context_text = "\n\n".join(context_chunks) if context_chunks else "No specific documentation available."

        system_prompt = f"""You are {agent_name}, a support assistant for {company_name}.

Use the following knowledge base to help resolve the user's issue:

{context_text}

Guidelines:
- Be empathetic and understanding
- Provide clear, step-by-step solutions when possible
- If you cannot resolve the issue, escalate to human support
- Always offer an alternative if you can't fully resolve the issue
{f'- For complex issues, suggest contacting: {support_email}' if support_email else ''}"""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *conversation_history[-6:],
                    {"role": "user", "content": message},
                ],
                max_tokens=500,
                temperature=0.5,
            )
            return response.choices[0].message.content
        except Exception:
            escalation = f" Please contact our support team at {support_email}." if support_email else " Please contact our support team directly."
            return f"I apologize for the difficulty you're experiencing.{escalation}"
