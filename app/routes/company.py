import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database.connection import get_db
from app.database.models import User, Company, UserRole
from app.utils.security import get_current_active_user
from app.config.settings import settings

router = APIRouter()


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[str] = None
    support_email: Optional[str] = None
    sales_email: Optional[str] = None


class CompanyCreate(BaseModel):
    name: str
    website_url: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[str] = None
    support_email: Optional[str] = None
    sales_email: Optional[str] = None


def company_to_dict(company: Company) -> dict:
    return {
        "id": str(company.id),
        "name": company.name,
        "website_url": company.website_url,
        "logo_url": company.logo_url,
        "contact_email": company.contact_email,
        "support_email": company.support_email,
        "sales_email": company.sales_email,
        "industry": company.industry,
        "description": company.description,
        "is_active": company.is_active,
        "widget_key": str(company.widget_key),
        "created_at": company.created_at.isoformat() if company.created_at else None,
        "updated_at": company.updated_at.isoformat() if company.updated_at else None,
    }


@router.post("")
async def create_company(
    data: CompanyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Only superadmin can create companies")

    company = Company(
        name=data.name,
        website_url=data.website_url,
        industry=data.industry,
        description=data.description,
        contact_email=data.contact_email,
        support_email=data.support_email,
        sales_email=data.sales_email,
    )
    db.add(company)
    await db.flush()
    return company_to_dict(company)


@router.get("/me")
async def get_my_company(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company_to_dict(company)


@router.put("/me")
async def update_my_company(
    data: CompanyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if data.name is not None:
        company.name = data.name
    if data.website_url is not None:
        company.website_url = data.website_url
    if data.industry is not None:
        company.industry = data.industry
    if data.description is not None:
        company.description = data.description
    if data.contact_email is not None:
        company.contact_email = data.contact_email
    if data.support_email is not None:
        company.support_email = data.support_email
    if data.sales_email is not None:
        company.sales_email = data.sales_email

    await db.flush()
    return company_to_dict(company)


@router.post("/me/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")

    # Save file
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.company_id), "logos")
    os.makedirs(upload_dir, exist_ok=True)
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"logo_{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    logo_url = f"/uploads/{current_user.company_id}/logos/{filename}"
    company.logo_url = logo_url
    await db.flush()

    return {"logo_url": logo_url}


@router.get("/{company_id}")
async def get_company(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Only superadmin can access this endpoint")

    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company_to_dict(company)
