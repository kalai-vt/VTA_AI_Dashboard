import json
from app.config.settings import settings


class LeadAgent:
    def __init__(self, db):
        self.db = db
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def respond(self, message: str, company_id: str, session_id: str, company_context: dict, conversation_history: list) -> dict:
        company_name = company_context.get("name", "our company")
        agent_name = company_context.get("agent_name", "AI Assistant")

        # Check what info we already have from conversation
        collected_info = self._extract_collected_info(conversation_history)

        system_prompt = f"""You are {agent_name}, a sales assistant for {company_name}.

Your goal is to qualify this lead by collecting their contact information and requirements.
Already collected: {json.dumps(collected_info)}

Progressively ask for:
1. Name (if not collected)
2. Email (if not collected)
3. Company name (if not collected)
4. Their requirement/what they're looking for (if not collected)
5. Quantity or scale (if relevant)

Be conversational and natural. Don't ask for everything at once.
When you have name and email, respond with a JSON block at the end:
LEAD_DATA: {{"name": "...", "email": "...", "company_name": "...", "requirement": "...", "country": "..."}}

If the user provides info, acknowledge it warmly and ask for the next piece."""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *conversation_history[-8:],
                    {"role": "user", "content": message},
                ],
                max_tokens=300,
                temperature=0.7,
            )
            response_text = response.choices[0].message.content

            # Extract lead data if present
            lead_data = None
            if "LEAD_DATA:" in response_text:
                try:
                    parts = response_text.split("LEAD_DATA:")
                    clean_response = parts[0].strip()
                    lead_json = parts[1].strip()
                    lead_data = json.loads(lead_json)
                    # Save lead
                    await self._save_lead(company_id, session_id, lead_data)
                    return {"response": clean_response, "lead_captured": True, "lead_data": lead_data}
                except Exception:
                    pass

            return {"response": response_text, "lead_captured": False, "lead_data": None}

        except Exception:
            return {
                "response": f"I'd love to help you! Could you start by telling me your name and email so I can connect you with the right person at {company_name}?",
                "lead_captured": False,
                "lead_data": None,
            }

    def _extract_collected_info(self, conversation_history: list) -> dict:
        info = {}
        full_text = " ".join([m.get("content", "") for m in conversation_history])

        # Simple extraction - in production use NLP
        import re
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', full_text)
        if email_match:
            info["email"] = email_match.group()

        return info

    async def _save_lead(self, company_id: str, session_id: str, lead_data: dict):
        try:
            from app.services.lead_service import LeadService
            lead_svc = LeadService(self.db)
            await lead_svc.create_or_update_lead(company_id, session_id, lead_data)
        except Exception:
            pass
