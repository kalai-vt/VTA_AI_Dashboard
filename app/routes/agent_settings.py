from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.database.connection import get_db
from app.database.models import User, AgentSettings
from app.utils.security import get_current_user

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentSettingsUpdate(BaseModel):
    agent_name: Optional[str] = None
    welcome_message: Optional[str] = None
    suggested_questions: Optional[List[str]] = None
    primary_color: Optional[str] = None
    llm_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None


@router.get("/settings")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentSettings).where(AgentSettings.company_id == current_user.company_id)
    )
    agent_settings = result.scalar_one_or_none()

    if not agent_settings:
        agent_settings = AgentSettings(
            company_id=current_user.company_id,
            agent_name="AI Assistant",
            welcome_message="Hello! How can I help you today?",
            suggested_questions=[],
            primary_color="#2563eb",
            llm_model="gpt-4o-mini",
            temperature=0.7,
            max_tokens=1000,
            system_prompt="You are a helpful AI assistant. Answer questions based on the company knowledge base.",
        )
        db.add(agent_settings)
        await db.flush()

    return {
        "id": str(agent_settings.id),
        "agent_name": agent_settings.agent_name,
        "welcome_message": agent_settings.welcome_message,
        "suggested_questions": agent_settings.suggested_questions,
        "primary_color": agent_settings.primary_color,
        "llm_model": agent_settings.llm_model,
        "temperature": agent_settings.temperature,
        "max_tokens": agent_settings.max_tokens,
        "system_prompt": agent_settings.system_prompt,
        "updated_at": agent_settings.updated_at.isoformat() if agent_settings.updated_at else None,
    }


@router.put("/settings")
async def update_settings(
    update: AgentSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentSettings).where(AgentSettings.company_id == current_user.company_id)
    )
    agent_settings = result.scalar_one_or_none()

    if not agent_settings:
        agent_settings = AgentSettings(company_id=current_user.company_id)
        db.add(agent_settings)
        await db.flush()

    for field, value in update.model_dump(exclude_none=True).items():
        setattr(agent_settings, field, value)
    agent_settings.updated_at = datetime.utcnow()

    await db.flush()
    return {"message": "Agent settings updated successfully"}
