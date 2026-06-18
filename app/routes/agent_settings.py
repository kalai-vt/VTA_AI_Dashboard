from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, AgentSettings
from app.utils.security import get_current_active_user

router = APIRouter()


class AgentSettingsUpdate(BaseModel):
    agent_name: Optional[str] = None
    welcome_message: Optional[str] = None
    suggested_questions: Optional[list] = None
    primary_color: Optional[str] = None
    llm_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None


class TestMessageRequest(BaseModel):
    message: str


def settings_to_dict(s: AgentSettings) -> dict:
    return {
        "id": str(s.id),
        "company_id": str(s.company_id),
        "agent_name": s.agent_name,
        "welcome_message": s.welcome_message,
        "suggested_questions": s.suggested_questions,
        "primary_color": s.primary_color,
        "llm_model": s.llm_model,
        "temperature": s.temperature,
        "max_tokens": s.max_tokens,
        "system_prompt": s.system_prompt,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/settings")
async def get_agent_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AgentSettings).where(AgentSettings.company_id == current_user.company_id)
    )
    agent_settings = result.scalar_one_or_none()

    if not agent_settings:
        # Create default settings
        agent_settings = AgentSettings(
            company_id=current_user.company_id,
            agent_name="AI Assistant",
            welcome_message="Hello! How can I help you today?",
            suggested_questions=["What products do you offer?", "How can I contact support?", "What are your pricing plans?"],
            primary_color="#2e7d32",
            llm_model="gpt-4o-mini",
            temperature=0.7,
            max_tokens=500,
            system_prompt="You are a helpful AI assistant for the company. Answer questions accurately and helpfully.",
        )
        db.add(agent_settings)
        await db.flush()

    return settings_to_dict(agent_settings)


@router.put("/settings")
async def update_agent_settings(
    data: AgentSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AgentSettings).where(AgentSettings.company_id == current_user.company_id)
    )
    agent_settings = result.scalar_one_or_none()

    if not agent_settings:
        agent_settings = AgentSettings(company_id=current_user.company_id)
        db.add(agent_settings)

    if data.agent_name is not None:
        agent_settings.agent_name = data.agent_name
    if data.welcome_message is not None:
        agent_settings.welcome_message = data.welcome_message
    if data.suggested_questions is not None:
        agent_settings.suggested_questions = data.suggested_questions
    if data.primary_color is not None:
        agent_settings.primary_color = data.primary_color
    if data.llm_model is not None:
        agent_settings.llm_model = data.llm_model
    if data.temperature is not None:
        agent_settings.temperature = data.temperature
    if data.max_tokens is not None:
        agent_settings.max_tokens = data.max_tokens
    if data.system_prompt is not None:
        agent_settings.system_prompt = data.system_prompt

    agent_settings.updated_at = datetime.utcnow()
    await db.flush()
    return settings_to_dict(agent_settings)


@router.post("/settings/test")
async def test_agent(
    data: TestMessageRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        from app.rag.langgraph_agent import run as agent_run
        result = await agent_run(
            message=data.message,
            session_token="test-session",
            company_id=str(current_user.company_id),
            db=db,
            conversation_history=[]
        )
        return {"response": result.get("response", "No response generated")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent test failed: {str(e)}")
