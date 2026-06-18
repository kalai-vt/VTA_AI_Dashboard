import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.database.connection import get_db
from app.database.models import User, Company, UserRole
from app.utils.security import (
    get_password_hash, verify_password, create_access_token,
    get_current_active_user
)
from app.config.settings import settings

router = APIRouter()


class RegisterRequest(BaseModel):
    company_name: str
    website_url: str = ""
    full_name: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    company_id: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create company
    company = Company(
        name=request.company_name,
        website_url=request.website_url,
    )
    db.add(company)
    await db.flush()

    # Create user
    user = User(
        company_id=company.id,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        full_name=request.full_name,
        role=UserRole.company_admin,
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            company_id=str(user.company_id),
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            company_id=str(user.company_id),
        )
    )


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "company_id": str(current_user.company_id),
        "company": {
            "id": str(company.id),
            "name": company.name,
            "website_url": company.website_url,
            "logo_url": company.logo_url,
            "industry": company.industry,
            "widget_key": str(company.widget_key),
        } if company else None
    }
