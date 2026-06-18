from datetime import date, timedelta
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database.models import Analytics


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_or_create_today(self, company_id: str) -> Analytics:
        today = date.today()
        result = await self.db.execute(
            select(Analytics).where(
                Analytics.company_id == company_id,
                Analytics.date == today
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            record = Analytics(
                company_id=company_id,
                date=today,
                visitors=0,
                chat_sessions=0,
                messages=0,
                leads_generated=0,
                conversion_rate=0.0,
            )
            self.db.add(record)
            await self.db.flush()
        return record

    async def record_event(self, company_id: str, event_type: str):
        record = await self._get_or_create_today(company_id)

        if event_type == "visitor":
            record.visitors = (record.visitors or 0) + 1
        elif event_type == "session":
            record.chat_sessions = (record.chat_sessions or 0) + 1
        elif event_type == "message":
            record.messages = (record.messages or 0) + 1
        elif event_type == "lead":
            record.leads_generated = (record.leads_generated or 0) + 1
            # Recalculate conversion rate
            if record.chat_sessions and record.chat_sessions > 0:
                record.conversion_rate = (record.leads_generated / record.chat_sessions) * 100

        await self.db.flush()

    async def get_dashboard_metrics(self, company_id: str) -> dict:
        result = await self.db.execute(
            select(
                func.sum(Analytics.visitors),
                func.sum(Analytics.chat_sessions),
                func.sum(Analytics.messages),
                func.sum(Analytics.leads_generated),
            ).where(Analytics.company_id == company_id)
        )
        row = result.first()
        total_visitors = int(row[0] or 0)
        total_sessions = int(row[1] or 0)
        total_messages = int(row[2] or 0)
        total_leads = int(row[3] or 0)
        conversion_rate = (total_leads / total_sessions * 100) if total_sessions > 0 else 0.0

        today = date.today()
        today_result = await self.db.execute(
            select(Analytics).where(
                Analytics.company_id == company_id,
                Analytics.date == today
            )
        )
        today_data = today_result.scalar_one_or_none()

        return {
            "total_visitors": total_visitors,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_leads": total_leads,
            "conversion_rate": round(conversion_rate, 2),
            "sessions_today": today_data.chat_sessions if today_data else 0,
            "leads_today": today_data.leads_generated if today_data else 0,
        }

    async def get_daily_chart(self, company_id: str, days: int = 30) -> List[dict]:
        start_date = date.today() - timedelta(days=days)
        result = await self.db.execute(
            select(Analytics)
            .where(
                Analytics.company_id == company_id,
                Analytics.date >= start_date
            )
            .order_by(Analytics.date)
        )
        records = result.scalars().all()
        return [
            {
                "date": r.date.isoformat() if r.date else None,
                "visitors": r.visitors,
                "sessions": r.chat_sessions,
                "messages": r.messages,
                "leads": r.leads_generated,
                "conversion_rate": r.conversion_rate,
            }
            for r in records
        ]
