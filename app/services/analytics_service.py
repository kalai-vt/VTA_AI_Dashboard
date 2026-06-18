import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.models import Analytics


async def get_or_create_today(company_id: uuid.UUID, db: AsyncSession) -> Analytics:
    today = date.today()
    result = await db.execute(select(Analytics).where(Analytics.company_id == company_id, Analytics.date == today))
    row = result.scalar_one_or_none()
    if not row:
        row = Analytics(company_id=company_id, date=today)
        db.add(row)
        await db.flush()
    return row


async def record_session(company_id: uuid.UUID, db: AsyncSession):
    row = await get_or_create_today(company_id, db)
    row.chat_sessions = (row.chat_sessions or 0) + 1
    await db.commit()


async def record_message(company_id: uuid.UUID, db: AsyncSession):
    row = await get_or_create_today(company_id, db)
    row.messages = (row.messages or 0) + 1
    await db.commit()


async def record_lead(company_id: uuid.UUID, db: AsyncSession):
    row = await get_or_create_today(company_id, db)
    row.leads_generated = (row.leads_generated or 0) + 1
    sessions = row.chat_sessions or 1
    row.conversion_rate = round(row.leads_generated / sessions * 100, 1)
    await db.commit()
