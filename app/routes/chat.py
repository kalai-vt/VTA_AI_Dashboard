import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import Company, ChatSession, ChatMessage, Lead, User
from app.utils.security import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_token: Optional[str] = None
    widget_key: str


@router.post("/")
async def chat(
    req: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Find company by widget_key
    result = await db.execute(select(Company).where(Company.widget_key == req.widget_key))
    company = result.scalar_one_or_none()
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Get or create session
    session = None
    if req.session_token:
        sess_result = await db.execute(
            select(ChatSession).where(ChatSession.session_token == req.session_token)
        )
        session = sess_result.scalar_one_or_none()

    if not session:
        session_token = str(uuid.uuid4())
        visitor_ip = request.client.host if request.client else None
        session = ChatSession(
            company_id=company.id,
            session_token=session_token,
            visitor_ip=visitor_ip,
        )
        db.add(session)
        await db.flush()

    # Load conversation history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    history_msgs = history_result.scalars().all()
    conversation_history = [
        {"role": m.role, "content": m.content} for m in history_msgs[-10:]
    ]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)

    # Run the agent
    try:
        from app.rag.langgraph_agent import run_agent
        agent_result = await run_agent(
            message=req.message,
            session_token=session.session_token,
            company_id=str(company.id),
            company_name=company.name,
            conversation_history=conversation_history,
            db=db,
        )
    except Exception as e:
        agent_result = {
            "response": "I'm sorry, I'm having trouble processing your request. Please try again.",
            "intent": "COMPANY_RELATED",
            "lead_score": 0,
            "capture_lead": False,
            "lead_data": None,
        }

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=agent_result["response"],
        intent=agent_result.get("intent"),
        lead_score=agent_result.get("lead_score"),
    )
    db.add(assistant_msg)

    # Update session
    session.last_activity = datetime.utcnow()
    session.message_count = (session.message_count or 0) + 2

    # Save lead if captured
    if agent_result.get("lead_data") and agent_result["lead_data"].get("email"):
        lead_data = agent_result["lead_data"]
        lead_score = agent_result.get("lead_score", 0)
        priority = "HIGH" if lead_score >= 70 else ("MEDIUM" if lead_score >= 40 else "LOW")
        lead = Lead(
            company_id=company.id,
            session_id=session.id,
            name=lead_data.get("name"),
            email=lead_data["email"],
            phone=lead_data.get("phone"),
            company_name=lead_data.get("company"),
            country=lead_data.get("country"),
            requirement=lead_data.get("requirement"),
            quantity=lead_data.get("quantity"),
            lead_score=lead_score,
            priority=priority,
            source="chat",
        )
        db.add(lead)

    await db.flush()

    return {
        "response": agent_result["response"],
        "intent": agent_result.get("intent"),
        "lead_score": agent_result.get("lead_score", 0),
        "capture_lead": agent_result.get("capture_lead", False),
        "session_token": session.session_token,
    }


@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.company_id == current_user.company_id)
        .order_by(ChatSession.last_activity.desc())
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.company_id == current_user.company_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "intent": m.intent,
            "lead_score": m.lead_score,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
