from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.models import Lead, LeadPriority, LeadStatus


class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_or_update_lead(self, company_id: str, session_id: str, lead_data: dict) -> Lead:
        # Check if lead exists for this session
        existing = None
        if session_id:
            result = await self.db.execute(
                select(Lead).where(
                    Lead.company_id == company_id,
                    Lead.session_id == session_id
                )
            )
            existing = result.scalar_one_or_none()

        if existing:
            # Update
            if lead_data.get("name"):
                existing.name = lead_data["name"]
            if lead_data.get("email"):
                existing.email = lead_data["email"]
            if lead_data.get("phone"):
                existing.phone = lead_data["phone"]
            if lead_data.get("company_name"):
                existing.company_name = lead_data["company_name"]
            if lead_data.get("country"):
                existing.country = lead_data["country"]
            if lead_data.get("requirement"):
                existing.requirement = lead_data["requirement"]
            if lead_data.get("quantity"):
                existing.quantity = lead_data["quantity"]
            if lead_data.get("lead_score") is not None:
                existing.lead_score = lead_data["lead_score"]
            await self.db.flush()
            return existing
        else:
            # Create
            lead = Lead(
                company_id=company_id,
                session_id=session_id if session_id else None,
                name=lead_data.get("name", "Unknown"),
                email=lead_data.get("email", ""),
                phone=lead_data.get("phone"),
                company_name=lead_data.get("company_name"),
                country=lead_data.get("country"),
                requirement=lead_data.get("requirement"),
                quantity=lead_data.get("quantity"),
                lead_score=lead_data.get("lead_score", 0.0),
                priority=LeadPriority(lead_data.get("priority", "LOW")),
                status=LeadStatus.new,
                source="chat",
            )
            self.db.add(lead)
            await self.db.flush()

            # Update analytics
            try:
                from app.services.analytics_service import AnalyticsService
                analytics = AnalyticsService(self.db)
                await analytics.record_event(company_id, "lead")
            except Exception:
                pass

            return lead

    async def update_lead_status(self, lead_id: str, company_id: str, status: str, priority: str = None):
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.company_id == company_id)
        )
        lead = result.scalar_one_or_none()
        if not lead:
            return None

        lead.status = LeadStatus(status)
        if priority:
            lead.priority = LeadPriority(priority)
        await self.db.flush()
        return lead

    async def get_leads(self, company_id: str, filters: dict, skip: int = 0, limit: int = 50):
        query = select(Lead).where(Lead.company_id == company_id)
        if filters.get("priority"):
            query = query.where(Lead.priority == LeadPriority(filters["priority"]))
        if filters.get("status"):
            query = query.where(Lead.status == LeadStatus(filters["status"]))
        if filters.get("country"):
            query = query.where(Lead.country == filters["country"])

        query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_lead_stats(self, company_id: str) -> dict:
        total_result = await self.db.execute(
            select(func.count(Lead.id)).where(Lead.company_id == company_id)
        )
        total = total_result.scalar() or 0

        high_result = await self.db.execute(
            select(func.count(Lead.id)).where(
                Lead.company_id == company_id,
                Lead.priority == LeadPriority.HIGH
            )
        )
        high_priority = high_result.scalar() or 0

        avg_result = await self.db.execute(
            select(func.avg(Lead.lead_score)).where(Lead.company_id == company_id)
        )
        avg_score = avg_result.scalar() or 0.0

        return {
            "total": total,
            "high_priority": high_priority,
            "avg_score": float(avg_score),
        }
