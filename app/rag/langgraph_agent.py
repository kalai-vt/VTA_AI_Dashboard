import operator
from typing import TypedDict, List, Optional, Annotated, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.settings import settings


class AgentState(TypedDict):
    messages: Annotated[List[dict], operator.add]
    intent: str
    confidence: float
    lead_score: float
    capture_lead: bool
    company_id: str
    session_id: str
    company_context: dict
    response: str


async def _get_company_context(company_id: str, db: AsyncSession) -> dict:
    from app.database.models import Company, AgentSettings
    try:
        result = await db.execute(select(Company).where(Company.id == company_id))
        company = result.scalar_one_or_none()
        if not company:
            return {}

        settings_result = await db.execute(
            select(AgentSettings).where(AgentSettings.company_id == company_id)
        )
        agent_settings = settings_result.scalar_one_or_none()

        context = {
            "id": str(company.id),
            "name": company.name,
            "website_url": company.website_url,
            "description": company.description,
            "support_email": company.support_email,
            "sales_email": company.sales_email,
        }

        if agent_settings:
            context.update({
                "agent_name": agent_settings.agent_name,
                "welcome_message": agent_settings.welcome_message,
                "system_prompt": agent_settings.system_prompt,
                "temperature": agent_settings.temperature,
                "max_tokens": agent_settings.max_tokens,
                "llm_model": agent_settings.llm_model,
            })

        return context
    except Exception:
        return {}


async def run(
    message: str,
    session_token: str,
    company_id: str,
    db: AsyncSession,
    conversation_history: list = []
) -> dict:
    try:
        from langgraph.graph import StateGraph, END
        from app.rag.intent_classifier import IntentClassifier
        from app.rag.agents.greeting_agent import GreetingAgent
        from app.rag.agents.rag_agent import RAGAgent
        from app.rag.agents.lead_agent import LeadAgent
        from app.rag.agents.support_agent import SupportAgent
        from app.rag.agents.redirect_agent import RedirectAgent

        company_context = await _get_company_context(company_id, db)
        classifier = IntentClassifier()
        intent_result = await classifier.classify(message, conversation_history, str(company_context.get("name", "")))

        # Find session_id
        session_id = ""
        try:
            from app.database.models import ChatSession
            result = await db.execute(
                select(ChatSession).where(ChatSession.session_token == session_token)
            )
            session = result.scalar_one_or_none()
            if session:
                session_id = str(session.id)
        except Exception:
            pass

        response_text = ""
        lead_captured = False

        intent = intent_result.intent

        if intent == "greeting" or intent == "farewell":
            agent = GreetingAgent()
            response_text = await agent.respond(message, company_context, conversation_history)

        elif intent in ("product_inquiry", "pricing", "other"):
            agent = RAGAgent(db)
            response_text = await agent.respond(message, company_id, company_context, conversation_history)

        elif intent == "support" or intent == "complaint":
            agent = SupportAgent(db)
            response_text = await agent.respond(message, company_id, company_context, conversation_history)

        elif intent == "lead_qualification" or intent_result.capture_lead:
            agent = LeadAgent(db)
            result = await agent.respond(message, company_id, session_id, company_context, conversation_history)
            response_text = result.get("response", "")
            lead_captured = result.get("lead_captured", False)

        elif intent == "off_topic":
            agent = RedirectAgent()
            response_text = await agent.respond(message, company_context, conversation_history)

        else:
            agent = RAGAgent(db)
            response_text = await agent.respond(message, company_id, company_context, conversation_history)

        # Track analytics
        try:
            from app.services.analytics_service import AnalyticsService
            analytics = AnalyticsService(db)
            await analytics.record_event(company_id, "message")
        except Exception:
            pass

        return {
            "response": response_text,
            "intent": intent,
            "confidence": intent_result.confidence,
            "lead_score": intent_result.lead_score,
            "capture_lead": intent_result.capture_lead or lead_captured,
        }

    except Exception as e:
        return {
            "response": "I apologize, I'm having trouble processing your request. Please try again or contact us directly.",
            "intent": "error",
            "confidence": 0.0,
            "lead_score": 0.0,
            "capture_lead": False,
        }
