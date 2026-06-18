from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Lead, LeadPriority, LeadStatus
from app.utils.security import get_current_active_user

router = APIRouter()


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    country: Optional[str] = None
    requirement: Optional[str] = None


def lead_to_dict(lead: Lead) -> dict:
    return {
        "id": str(lead.id),
        "company_id": str(lead.company_id),
        "session_id": str(lead.session_id) if lead.session_id else None,
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "company_name": lead.company_name,
        "country": lead.country,
        "requirement": lead.requirement,
        "quantity": lead.quantity,
        "priority": lead.priority.value if lead.priority else None,
        "lead_score": lead.lead_score,
        "status": lead.status.value if lead.status else None,
        "source": lead.source,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
    }


@router.get("")
async def list_leads(
    priority: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lead).where(Lead.company_id == current_user.company_id)

    if priority:
        try:
            query = query.where(Lead.priority == LeadPriority(priority))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid priority value")
    if status:
        try:
            query = query.where(Lead.status == LeadStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status value")
    if country:
        query = query.where(Lead.country == country)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.where(Lead.created_at >= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.where(Lead.created_at <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")

    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    leads = result.scalars().all()
    return [lead_to_dict(l) for l in leads]


@router.get("/stats")
async def get_lead_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Total leads
    total_result = await db.execute(
        select(func.count(Lead.id)).where(Lead.company_id == current_user.company_id)
    )
    total = total_result.scalar() or 0

    # High priority
    high_result = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.company_id == current_user.company_id,
            Lead.priority == LeadPriority.HIGH
        )
    )
    high_priority = high_result.scalar() or 0

    # Avg score
    avg_result = await db.execute(
        select(func.avg(Lead.lead_score)).where(Lead.company_id == current_user.company_id)
    )
    avg_score = avg_result.scalar() or 0.0

    # By country
    country_result = await db.execute(
        select(Lead.country, func.count(Lead.id))
        .where(Lead.company_id == current_user.company_id)
        .group_by(Lead.country)
    )
    by_country = {row[0] or "Unknown": row[1] for row in country_result.all()}

    # By status
    status_result = await db.execute(
        select(Lead.status, func.count(Lead.id))
        .where(Lead.company_id == current_user.company_id)
        .group_by(Lead.status)
    )
    by_status = {row[0].value if row[0] else "unknown": row[1] for row in status_result.all()}

    return {
        "total": total,
        "high_priority": high_priority,
        "by_country": by_country,
        "by_status": by_status,
        "avg_score": float(avg_score),
    }


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == current_user.company_id
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead_to_dict(lead)


@router.put("/{lead_id}")
async def update_lead(
    lead_id: str,
    data: LeadUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == current_user.company_id
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if data.status is not None:
        try:
            lead.status = LeadStatus(data.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status value")
    if data.priority is not None:
        try:
            lead.priority = LeadPriority(data.priority)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid priority value")
    if data.name is not None:
        lead.name = data.name
    if data.email is not None:
        lead.email = data.email
    if data.phone is not None:
        lead.phone = data.phone
    if data.company_name is not None:
        lead.company_name = data.company_name
    if data.country is not None:
        lead.country = data.country
    if data.requirement is not None:
        lead.requirement = data.requirement

    await db.flush()
    return lead_to_dict(lead)
