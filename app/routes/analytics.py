from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc

from app.database.connection import get_db
from app.database.models import User, Analytics, ChatSession, ChatMessage, Lead, MessageRole
from app.utils.security import get_current_active_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    company_id = current_user.company_id
    today = date.today()

    # Total analytics
    totals = await db.execute(
        select(
            func.sum(Analytics.visitors),
            func.sum(Analytics.chat_sessions),
            func.sum(Analytics.messages),
            func.sum(Analytics.leads_generated),
        ).where(Analytics.company_id == company_id)
    )
    row = totals.first()
    total_visitors = int(row[0] or 0)
    total_sessions = int(row[1] or 0)
    total_messages = int(row[2] or 0)
    total_leads = int(row[3] or 0)
    conversion_rate = (total_leads / total_sessions * 100) if total_sessions > 0 else 0.0

    # Today's data
    today_result = await db.execute(
        select(Analytics).where(
            Analytics.company_id == company_id,
            Analytics.date == today
        )
    )
    today_data = today_result.scalar_one_or_none()
    sessions_today = today_data.chat_sessions if today_data else 0
    leads_today = today_data.leads_generated if today_data else 0

    return {
        "total_visitors": total_visitors,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "total_leads": total_leads,
        "conversion_rate": round(conversion_rate, 2),
        "sessions_today": sessions_today,
        "leads_today": leads_today,
    }


@router.get("/daily")
async def get_daily_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    company_id = current_user.company_id
    start_date = date.today() - timedelta(days=days)

    result = await db.execute(
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


@router.get("/questions")
async def get_top_questions(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Get messages from sessions belonging to the company
    result = await db.execute(
        select(ChatMessage.content, func.count(ChatMessage.id).label("count"))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(
            ChatSession.company_id == current_user.company_id,
            ChatMessage.role == MessageRole.user
        )
        .group_by(ChatMessage.content)
        .order_by(desc("count"))
        .limit(limit)
    )
    rows = result.all()
    return [{"message": row[0], "count": row[1]} for row in rows]
