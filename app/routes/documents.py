import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database.connection import get_db, AsyncSessionLocal
from app.database.models import User, Document, KnowledgeChunk
from app.utils.security import get_current_user
from app.config.settings import settings

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


async def process_doc_background(company_id: str, document_id: str, file_path: str, file_type: str):
    from app.services.document_service import process_document
    async with AsyncSessionLocal() as db:
        try:
            await process_document(company_id, document_id, file_path, file_type, db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Document processing error: {e}")


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content_type = file.content_type or ""
    file_type = ALLOWED_TYPES.get(content_type)
    if not file_type:
        # Try by extension
        ext = os.path.splitext(file.filename or "")[1].lower().lstrip(".")
        if ext in ("pdf", "docx", "txt"):
            file_type = ext
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    doc = Document(
        company_id=current_user.company_id,
        filename=file.filename or filename,
        file_type=file_type,
        file_size=len(content),
        status="pending",
    )
    db.add(doc)
    await db.flush()

    background_tasks.add_task(
        process_doc_background,
        str(current_user.company_id),
        str(doc.id),
        file_path,
        file_type,
    )

    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "status": doc.status,
    }


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
            "status": d.status,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.company_id == current_user.company_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.company_id == current_user.company_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.source_type == "document",
            KnowledgeChunk.source_id == str(doc.id),
        )
    )
    await db.delete(doc)
    return {"message": "Document deleted successfully"}
