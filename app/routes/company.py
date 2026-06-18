from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import Company, User, AgentSettings
from app.utils.security import get_current_user

router = APIRouter(prefix="/company", tags=["company"])


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    support_email: Optional[str] = None
    sales_email: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None


@router.get("/me")
async def get_my_company(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {
        "id": str(company.id),
        "name": company.name,
        "website_url": company.website_url,
        "logo_url": company.logo_url,
        "contact_email": company.contact_email,
        "support_email": company.support_email,
        "sales_email": company.sales_email,
        "industry": company.industry,
        "description": company.description,
        "widget_key": str(company.widget_key),
        "is_active": company.is_active,
        "created_at": company.created_at.isoformat() if company.created_at else None,
    }


@router.put("/me")
async def update_my_company(
    update: CompanyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in update.model_dump(exclude_none=True).items():
        setattr(company, field, value)

    await db.flush()
    return {"message": "Company updated successfully"}


@router.get("/widget/{widget_key}")
async def get_widget_settings(widget_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.widget_key == widget_key))
    company = result.scalar_one_or_none()
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Widget not found")

    settings_result = await db.execute(
        select(AgentSettings).where(AgentSettings.company_id == company.id)
    )
    agent_settings = settings_result.scalar_one_or_none()

    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "widget_key": str(company.widget_key),
        "agent_name": agent_settings.agent_name if agent_settings else "AI Assistant",
        "welcome_message": agent_settings.welcome_message if agent_settings else "Hello! How can I help you today?",
        "suggested_questions": agent_settings.suggested_questions if agent_settings else [],
        "primary_color": agent_settings.primary_color if agent_settings else "#2563eb",
    }
