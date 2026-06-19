import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import Company, ChatSession, ChatMessage, MessageRole
from app.utils.security import get_current_active_user
from app.database.models import User

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_token: Optional[str] = None
    company_widget_key: str


@router.post("")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    # Find company by widget_key
    result = await db.execute(
        select(Company).where(Company.widget_key == chat_request.company_widget_key)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not company.is_active:
        raise HTTPException(status_code=403, detail="Company is not active")

    # Get or create session
    session = None
    if chat_request.session_token:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.session_token == chat_request.session_token,
                ChatSession.company_id == company.id
            )
        )
        session = result.scalar_one_or_none()

    if not session:
        visitor_ip = request.client.host if request.client else None
        session = ChatSession(
            company_id=company.id,
            session_token=str(uuid.uuid4()),
            visitor_ip=visitor_ip,
        )
        db.add(session)
        await db.flush()

    # Get conversation history
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .limit(20)
    )
    history = result.scalars().all()
    conversation_history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in history
    ]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.user,
        content=chat_request.message,
    )
    db.add(user_msg)
    await db.flush()

    # Run agent
    try:
        from app.rag.langgraph_agent import run as agent_run
        agent_result = await agent_run(
            message=chat_request.message,
            session_token=session.session_token,
            company_id=str(company.id),
            db=db,
            conversation_history=conversation_history
        )
    except Exception as e:
        agent_result = {
            "response": "I'm sorry, I'm having trouble processing your request right now. Please try again.",
            "intent": "error",
            "lead_score": 0.0,
            "capture_lead": False,
        }

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.assistant,
        content=agent_result.get("response", ""),
        intent=agent_result.get("intent"),
        lead_score=agent_result.get("lead_score"),
    )
    db.add(assistant_msg)

    # Update session
    session.last_activity = datetime.utcnow()
    session.message_count = (session.message_count or 0) + 2
    await db.flush()

    return {
        "response": agent_result.get("response", ""),
        "intent": agent_result.get("intent"),
        "lead_score": agent_result.get("lead_score", 0.0),
        "capture_lead": agent_result.get("capture_lead", False),
        "session_token": session.session_token,
    }


@router.get("/sessions")
async def list_sessions(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.company_id == current_user.company_id)
        .order_by(ChatSession.last_activity.desc())
        .offset(skip)
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "session_token": s.session_token,
            "visitor_name": s.visitor_name,
            "visitor_email": s.visitor_email,
            "visitor_ip": s.visitor_ip,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "last_activity": s.last_activity.isoformat() if s.last_activity else None,
            "message_count": s.message_count,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify session belongs to company
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.company_id == current_user.company_id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role.value,
            "content": m.content,
            "intent": m.intent,
            "lead_score": m.lead_score,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
