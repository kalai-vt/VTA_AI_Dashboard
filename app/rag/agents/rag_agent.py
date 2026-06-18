from typing import List
from app.config.settings import settings


class RAGAgent:
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
        system_prompt_override = company_context.get("system_prompt", "")

        # Search for relevant context
        context_chunks = []
        try:
            from app.services.embedding_service import EmbeddingService
            embedding_svc = EmbeddingService(self.db)
            results = await embedding_svc.search_similar(company_id, message, top_k=5)
            context_chunks = [r["text"] for r in results if r.get("text")]
        except Exception:
            pass

        context_text = "\n\n".join(context_chunks) if context_chunks else "No specific documentation available."

        if system_prompt_override:
            system_prompt = system_prompt_override
        else:
            system_prompt = f"""You are {agent_name}, an AI assistant for {company_name}.

Use the following context from our knowledge base to answer the user's question accurately.
If the answer is not in the context, say so honestly and offer to help with what you do know.

Knowledge Base Context:
{context_text}

Guidelines:
- Be helpful, professional, and accurate
- If you reference specific information, mention it came from the company's documentation
- Keep responses concise but complete
- If you cannot answer, suggest contacting the company directly"""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *conversation_history[-6:],
                    {"role": "user", "content": message},
                ],
                max_tokens=company_context.get("max_tokens", 500),
                temperature=company_context.get("temperature", 0.7),
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"I'm sorry, I'm having trouble accessing our knowledge base right now. Please contact {company_name} directly for assistance."
