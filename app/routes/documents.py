import os
import uuid
import asyncio
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.database.models import User, Document, DocumentStatus
from app.utils.security import get_current_active_user
from app.config.settings import settings

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only PDF, DOCX, TXT allowed.")

    # Save file
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.company_id), "documents")
    os.makedirs(upload_dir, exist_ok=True)
    ext = ALLOWED_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)

    file_content = await file.read()
    file_size = len(file_content)
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Create document record
    document = Document(
        company_id=current_user.company_id,
        filename=file.filename,
        file_type=ext,
        file_size=file_size,
        status=DocumentStatus.pending,
    )
    db.add(document)
    await db.flush()
    doc_id = str(document.id)

    async def process():
        from app.services.document_service import DocumentService
        from app.database.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            svc = DocumentService(session)
            await svc.process_document(str(current_user.company_id), doc_id, file_path, ext)

    asyncio.create_task(process())

    return {
        "id": doc_id,
        "filename": file.filename,
        "file_type": ext,
        "file_size": file_size,
        "status": "pending",
    }


@router.get("")
async def list_documents(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Document).where(Document.company_id == current_user.company_id)
    )
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "status": d.status.value,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.company_id == current_user.company_id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.company_id), "documents")
    for f in os.listdir(upload_dir) if os.path.exists(upload_dir) else []:
        if document_id in f:
            try:
                os.remove(os.path.join(upload_dir, f))
            except Exception:
                pass

    await db.delete(doc)
    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.company_id == current_user.company_id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "status": doc.status.value,
        "chunk_count": doc.chunk_count,
    }
