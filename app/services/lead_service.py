import uuid
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database.models import Lead


async def create_lead(company_id: uuid.UUID, session_id: uuid.UUID, lead_data: Dict, db: AsyncSession) -> Lead:
    lead = Lead(
        company_id=company_id,
        session_id=session_id,
        name=lead_data.get("name", ""),
        email=lead_data.get("email", ""),
        phone=lead_data.get("phone"),
        company_name=lead_data.get("company"),
        country=lead_data.get("country"),
        requirement=lead_data.get("requirement"),
        quantity=lead_data.get("quantity"),
        lead_score=lead_data.get("lead_score", 0),
        priority=lead_data.get("priority", "MEDIUM"),
        status="new",
        source="chat",
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


async def get_leads(company_id: uuid.UUID, db: AsyncSession, priority: Optional[str] = None,
                    status: Optional[str] = None, country: Optional[str] = None,
                    skip: int = 0, limit: int = 50) -> List[Lead]:
    q = select(Lead).where(Lead.company_id == company_id)
    if priority:
        q = q.where(Lead.priority == priority)
    if status:
        q = q.where(Lead.status == status)
    if country:
        q = q.where(Lead.country == country)
    q = q.order_by(desc(Lead.created_at)).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


async def get_lead_stats(company_id: uuid.UUID, db: AsyncSession) -> Dict:
    total = await db.execute(select(func.count(Lead.id)).where(Lead.company_id == company_id))
    high = await db.execute(select(func.count(Lead.id)).where(Lead.company_id == company_id, Lead.priority == "HIGH"))
    medium = await db.execute(select(func.count(Lead.id)).where(Lead.company_id == company_id, Lead.priority == "MEDIUM"))
    new = await db.execute(select(func.count(Lead.id)).where(Lead.company_id == company_id, Lead.status == "new"))
    by_country = await db.execute(
        select(Lead.country, func.count(Lead.id).label("count"))
        .where(Lead.company_id == company_id, Lead.country.isnot(None))
        .group_by(Lead.country).order_by(desc("count")).limit(10)
    )
    return {
        "total": total.scalar() or 0,
        "high_priority": high.scalar() or 0,
        "medium_priority": medium.scalar() or 0,
        "new_count": new.scalar() or 0,
        "by_country": [{"country": r.country, "count": r.count} for r in by_country.fetchall()],
    }
