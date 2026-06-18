from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import User, Lead
from app.utils.security import get_current_user

router = APIRouter(prefix="/leads", tags=["leads"])


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
async def list_leads(
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Lead).where(Lead.company_id == current_user.company_id)
    if priority:
        query = query.where(Lead.priority == priority)
    if status:
        query = query.where(Lead.status == status)
    if country:
        query = query.where(Lead.country == country)
    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    leads = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "name": l.name,
            "email": l.email,
            "phone": l.phone,
            "company_name": l.company_name,
            "country": l.country,
            "requirement": l.requirement,
            "quantity": l.quantity,
            "priority": l.priority,
            "lead_score": l.lead_score,
            "status": l.status,
            "source": l.source,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in leads
    ]


@router.get("/stats")
async def lead_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead).where(Lead.company_id == current_user.company_id)
    )
    leads = result.scalars().all()

    total = len(leads)
    high_priority = sum(1 for l in leads if l.priority == "HIGH")
    medium_priority = sum(1 for l in leads if l.priority == "MEDIUM")
    new_count = sum(1 for l in leads if l.status == "new")

    country_counts: dict = {}
    for l in leads:
        if l.country:
            country_counts[l.country] = country_counts.get(l.country, 0) + 1

    by_country = [{"country": k, "count": v} for k, v in sorted(country_counts.items(), key=lambda x: -x[1])]

    return {
        "total": total,
        "high_priority": high_priority,
        "medium_priority": medium_priority,
        "new_count": new_count,
        "by_country": by_country,
    }


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.company_id == current_user.company_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {
        "id": str(lead.id),
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "company_name": lead.company_name,
        "country": lead.country,
        "requirement": lead.requirement,
        "quantity": lead.quantity,
        "priority": lead.priority,
        "lead_score": lead.lead_score,
        "status": lead.status,
        "source": lead.source,
        "session_id": str(lead.session_id) if lead.session_id else None,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
    }


@router.put("/{lead_id}")
async def update_lead(
    lead_id: str,
    update: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.company_id == current_user.company_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for field, value in update.model_dump(exclude_none=True).items():
        if hasattr(lead, field):
            setattr(lead, field, value)

    await db.flush()
    return {"message": "Lead updated successfully"}
