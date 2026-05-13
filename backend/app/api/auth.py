from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.middleware import get_current_payload, require_roles
from app.core.security import hash_password, verify_password
from app.models.user import UserRole
from app.services.database_service import (
    DatabaseConflictError,
    DatabaseError,
    create_guest_entry,
    create_user,
    get_user_by_email,
    set_user_role,
    record_failed_login,
    reset_failed_logins,
    is_account_locked,
)
from app.services.email_service import get_email_service
from app.services.otp_service import OTPService

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

otp_service = OTPService()
email_service = get_email_service()


class LoginRequest(BaseModel):
    email: str
    password: str
    role: UserRole


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=128)
    role: UserRole


class SendOTPRequest(BaseModel):
    email: str
    name: str = Field(default="User", min_length=1, max_length=80)


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RoleAssignmentRequest(BaseModel):
    email: str
    role: UserRole


class RoleAssignmentResponse(BaseModel):
    email: str
    role: UserRole
    updated_by: str


class GuestEntryRequest(BaseModel):
    name: str = Field(default="Guest User", min_length=1, max_length=80)
    email: str = Field(default="guest@example.com", min_length=3, max_length=120)
    company: str = Field(default="Guest Company", min_length=1, max_length=120)
    phone: str = Field(default="N/A", min_length=1, max_length=40)
    role: UserRole
    source: str = Field(default="guest_form", min_length=3, max_length=40)


class FeedbackRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    role: UserRole
    category: str = Field(min_length=2, max_length=120)
    priority: str = Field(min_length=2, max_length=20)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=3, max_length=1200)
    improvements: str = Field(default="", max_length=1200)
    source: str = Field(default="feedback_form", min_length=3, max_length=40)


def normalize_email(email: str) -> str:
    return str(email).strip().lower()


def normalize_display_name(name: str, fallback: str = "User") -> str:
    text = str(name or "").strip()
    if not text:
        return fallback
    return text[8:].strip() if text.lower().startswith("default ") else text


def normalize_role(role: UserRole | str) -> UserRole:
    if isinstance(role, UserRole):
        return role

    raw_role = str(role).strip().lower()
    legacy_map = {
        "retail": UserRole.retail_shop.value,
        "retailshop": UserRole.retail_shop.value,
    }
    normalized = legacy_map.get(raw_role, raw_role)
    return UserRole(normalized)


def create_access_token(subject: str, role: UserRole) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    # Using hard-coded 15 minutes or config
    minutes = settings.access_token_expire_minutes if settings.access_token_expire_minutes else 15
    expire_at = now + timedelta(minutes=minutes)
    payload = {
        "sub": subject,
        "type": "access",
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, role: UserRole) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    # Defaulting to 7 days config
    days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    expire_at = now + timedelta(days=days)
    payload = {
        "sub": subject,
        "type": "refresh",
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def _build_otp_response(data: SendOTPRequest) -> dict:
    email = normalize_email(data.email)
    try:
        existing_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    otp = otp_service.create_otp(email)
    email_sent = email_service.send_otp_email(
        to_email=email,
        name=data.name.strip(),
        otp=otp,
        validity_minutes=OTPService.OTP_VALIDITY_MINUTES,
    )

    expose_otp = os.getenv("EXPOSE_OTP_IN_RESPONSE", "").strip().lower() in {"1", "true", "yes", "on"}

    if not email_sent and not expose_otp:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "OTP delivery failed. Configure SMTP (SMTP_SERVER/SMTP_PORT/SENDER_EMAIL/SENDER_PASSWORD), "
                "keep MOCK_EMAIL_DELIVERY=false, restart the backend, then try again."
            ),
        )

    payload: dict[str, object] = {
        "success": True,
        "message": f"OTP sent to {email}",
        "email_sent": bool(email_sent),
    }

    if expose_otp:
        payload["otp"] = otp
        if not email_sent:
            payload["email_error"] = "Email delivery failed; OTP was returned only because EXPOSE_OTP_IN_RESPONSE=true."

    return payload


async def _collect_otp_request(request: Request) -> SendOTPRequest:
    body = await request.json()
    return SendOTPRequest(**body)


@router.post("/send-otp")
@limiter.limit(lambda: os.getenv("RATE_LIMIT_AUTH", "5/minute"))
async def send_otp(request: Request, data: SendOTPRequest = Depends(_collect_otp_request)) -> dict:
    return _build_otp_response(data)


@router.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest) -> dict:
    email = normalize_email(data.email)
    is_valid, message = otp_service.verify_otp(email, data.otp)

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return {"success": True, "message": message, "valid": True}


@router.post("/resend-otp")
@limiter.limit(lambda: os.getenv("RATE_LIMIT_AUTH", "5/minute"))
async def resend_otp(request: Request, data: SendOTPRequest = Depends(_collect_otp_request)) -> dict:
    return _build_otp_response(data)


@router.post("/signup", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest) -> LoginResponse:
    email = normalize_email(data.email)
    try:
        existing_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    if not otp_service.consume_verified_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification required. Please verify OTP before signup.",
        )

    password_hash = hash_password(data.password)
    try:
        db_user = create_user(
            name=data.name,
            email=email,
            password_hash=password_hash,
            role=data.role.value,
        )
    except DatabaseConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    token = create_access_token(subject=email, role=data.role)
    refresh = create_refresh_token(subject=email, role=data.role)

    # Do not fail signup on welcome-mail delivery issues.
    email_service.send_welcome_email(email, data.name, data.role.value)

    return LoginResponse(
        access_token=token,
        refresh_token=refresh,
        role=data.role,
        user={
            "id": db_user["id"],
            "email": email,
            "name": normalize_display_name(data.name),
            "role": data.role,
        },
    )


async def _collect_login_request(request: Request) -> LoginRequest:
    body = await request.json()
    return LoginRequest(**body)


@router.post("/login", response_model=LoginResponse)
@limiter.limit(lambda: os.getenv("RATE_LIMIT_AUTH", "5/minute"))
async def login(request: Request) -> LoginResponse:
    data = await _collect_login_request(request)
    email = normalize_email(data.email)
    try:
        db_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc
        
    # Check if account is locked
    if db_user and is_account_locked(db_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is temporarily locked due to too many failed login attempts. Try again later."
        )

    if db_user is not None:
        db_role = normalize_role(db_user["role"])
        if not verify_password(data.password, db_user["password_hash"]):
            record_failed_login(db_user["id"])
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
            
        reset_failed_logins(db_user["id"])

        if db_role != data.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Selected role does not match user role",
            )

        token = create_access_token(subject=email, role=db_role)
        refresh = create_refresh_token(subject=email, role=db_role)
        return LoginResponse(
            access_token=token,
            refresh_token=refresh,
            role=db_role,
            user={
                "id": db_user["id"],
                "email": db_user["email"],
                "name": normalize_display_name(db_user["name"], fallback="User"),
                "role": db_role,
            },
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )


@router.post("/refresh")
def refresh_token(data: RefreshTokenRequest):
    settings = get_settings()
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
            
        email = payload.get("sub")
        role_str = payload.get("role")
        if not email or not role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
            
        role = normalize_role(role_str)
        new_access_token = create_access_token(subject=email, role=role)
        return {"access_token": new_access_token, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )


@router.post(
    "/assign-role",
    response_model=RoleAssignmentResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
def assign_role(
    data: RoleAssignmentRequest,
    payload: dict = Depends(require_roles(UserRole.admin)),
) -> RoleAssignmentResponse:
    email = normalize_email(data.email)
    try:
        target = set_user_role(email=email, role=data.role.value)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return RoleAssignmentResponse(
        email=email,
        role=data.role,
        updated_by=payload.get("sub", "admin"),
    )


@router.get("/me")
def me(payload: dict = Depends(get_current_payload)) -> dict:
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        db_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "id": db_user["id"],
        "email": db_user["email"],
        "name": normalize_display_name(db_user["name"], fallback="User"),
        "role": normalize_role(db_user["role"]),
    }


@router.get("/validate-token")
def validate_token(
    payload: dict = Depends(
        require_roles(
            UserRole.admin,
            UserRole.manufacturer,
            UserRole.transporter,
            UserRole.dealer,
            UserRole.retail_shop,
        )
    ),
):
    return {"valid": True, "payload": payload}


@router.post("/guest-entry")
def save_guest_entry(data: GuestEntryRequest) -> dict:
    normalized_email = normalize_email(data.email)
    clean_name = normalize_display_name(data.name, fallback="Guest User")
    company = data.company.strip()
    phone = data.phone.strip()
    try:
        entry = create_guest_entry(
            name=clean_name,
            email=normalized_email,
            company=company,
            phone=phone,
            role=data.role.value,
            source=data.source.strip(),
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    email_sent = email_service.send_guest_account_email(
        to_email=normalized_email,
        name=clean_name,
        company=company,
        phone=phone,
    )

    response = {
        "success": True,
        "message": "Guest account created successfully",
        "entry_id": entry["id"],
        "created_at": entry["created_at"],
        "email_sent": bool(email_sent),
    }
    if not email_sent:
        delivery_reason = getattr(email_service, "last_error_message", "").strip()
        response["email_error"] = (
            "Guest account was created, but the confirmation email could not be delivered."
        )
        if delivery_reason:
            response["email_error"] = f"{response['email_error']} {delivery_reason}"
    return response


@router.post("/feedback")
def submit_feedback(data: FeedbackRequest) -> dict:
    normalized_email = normalize_email(data.email)
    clean_name = normalize_display_name(data.name, fallback="User")

    try:
        entry = create_guest_entry(
            name=clean_name,
            email=normalized_email,
            company=data.category.strip(),
            phone=f"{data.priority.strip()}-{data.rating}",
            role=data.role.value,
            source=data.source.strip(),
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    email_sent = email_service.send_feedback_thank_you_email(
        to_email=normalized_email,
        name=clean_name,
    )

    response = {
        "success": True,
        "entry_id": entry["id"],
        "created_at": entry["created_at"],
    }

    if not email_sent:
        logger.warning(
            "Feedback thank-you email failed for %s (name: %s)",
            normalized_email,
            clean_name,
        )
        response["message"] = "Feedback submitted; thank-you email could not be delivered."
        response["email_sent"] = False
        response["email_error"] = (
            "Email delivery failed. Verify SMTP credentials or enable MOCK_EMAIL_DELIVERY."
        )
        return response

    response["message"] = "Feedback submitted successfully"
    response["email_sent"] = True
    return response
