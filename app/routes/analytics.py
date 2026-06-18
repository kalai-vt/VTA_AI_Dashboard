from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.connection import get_db
from app.database.models import User, ChatSession, ChatMessage, Lead, Analytics
from app.utils.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    today = datetime.utcnow().date()

    sessions_result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.company_id == cid)
    )
    total_sessions = sessions_result.scalar() or 0

    messages_result = await db.execute(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.company_id == cid)
    )
    total_messages = messages_result.scalar() or 0

    leads_result = await db.execute(
        select(func.count(Lead.id)).where(Lead.company_id == cid)
    )
    total_leads = leads_result.scalar() or 0

    conversion_rate = (total_leads / total_sessions * 100) if total_sessions > 0 else 0.0

    today_start = datetime.combine(today, datetime.min.time())
    active_today_result = await db.execute(
        select(func.count(ChatSession.id)).where(
            ChatSession.company_id == cid,
            ChatSession.last_activity >= today_start,
        )
    )
    active_today = active_today_result.scalar() or 0

    return {
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "total_leads": total_leads,
        "conversion_rate": round(conversion_rate, 2),
        "active_today": active_today,
    }


@router.get("/daily")
async def daily_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    today = datetime.utcnow().date()
    results = []

    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())

        sess_r = await db.execute(
            select(func.count(ChatSession.id)).where(
                ChatSession.company_id == cid,
                ChatSession.started_at >= day_start,
                ChatSession.started_at <= day_end,
            )
        )
        sessions_count = sess_r.scalar() or 0

        msg_r = await db.execute(
            select(func.count(ChatMessage.id))
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.company_id == cid,
                ChatMessage.created_at >= day_start,
                ChatMessage.created_at <= day_end,
            )
        )
        messages_count = msg_r.scalar() or 0

        lead_r = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.company_id == cid,
                Lead.created_at >= day_start,
                Lead.created_at <= day_end,
            )
        )
        leads_count = lead_r.scalar() or 0

        results.append({
            "date": day.isoformat(),
            "sessions": sessions_count,
            "messages": messages_count,
            "leads": leads_count,
        })

    return results


@router.get("/questions")
async def top_questions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage.content, func.count(ChatMessage.id).label("count"))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(
            ChatSession.company_id == current_user.company_id,
            ChatMessage.role == "user",
        )
        .group_by(ChatMessage.content)
        .order_by(func.count(ChatMessage.id).desc())
        .limit(10)
    )
    rows = result.all()
    return [{"question": row[0], "count": row[1]} for row in rows]
