from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.middleware import get_current_payload, require_roles
from app.models.user import UserRole
from app.services.database_service import (
    DatabaseConflictError,
    DatabaseError,
    create_guest_entry,
    create_user,
    get_user_by_email,
)
from app.services.email_service import get_email_service
from app.services.otp_service import OTPService
from app.services.state_service import users

router = APIRouter(prefix="/auth", tags=["auth"])

otp_service = OTPService()
email_service = get_email_service()
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 120000


class LoginRequest(BaseModel):
    email: str
    password: str
    role: UserRole


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=6, max_length=128)
    role: UserRole


class SendOTPRequest(BaseModel):
    email: str
    name: str = Field(default="User", min_length=1, max_length=80)


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user: dict


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


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    hash_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    salt_encoded = base64.urlsafe_b64encode(salt).decode("utf-8")
    hash_encoded = base64.urlsafe_b64encode(hash_bytes).decode("utf-8")
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt_encoded}${hash_encoded}"


def verify_password(plain_password: str, stored_password: str) -> bool:
    parts = stored_password.split("$")
    if len(parts) == 4 and parts[0] == PASSWORD_SCHEME:
        try:
            iterations = int(parts[1])
            salt = base64.urlsafe_b64decode(parts[2].encode("utf-8"))
            expected = base64.urlsafe_b64decode(parts[3].encode("utf-8"))
        except (ValueError, TypeError):
            return False

        calculated = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(calculated, expected)

    # Backward compatibility for seeded users with plain-text passwords.
    return stored_password == plain_password


def create_access_token(subject: str, role: UserRole) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire_at = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


@router.post("/send-otp")
def send_otp(data: SendOTPRequest) -> dict:
    email = normalize_email(data.email)
    try:
        existing_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc

    if email in users or existing_user is not None:
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

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP email. Check SMTP configuration and sender credentials.",
        )

    payload: dict[str, object] = {
        "success": True,
        "message": f"OTP sent to {email}",
    }

    if get_settings().app_env.lower() == "development":
        payload["otp"] = otp

    return payload


@router.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest) -> dict:
    email = normalize_email(data.email)
    is_valid, message = otp_service.verify_otp(email, data.otp)

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return {"success": True, "message": message, "valid": True}


@router.post("/resend-otp")
def resend_otp(data: SendOTPRequest) -> dict:
    return send_otp(data)


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

    if email in users or existing_user is not None:
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

    users[email] = {
        "email": email,
        "name": data.name,
        "password": password_hash,
        "role": data.role,
        "db_id": db_user["id"],
    }

    token = create_access_token(subject=email, role=data.role)

    # Do not fail signup on welcome-mail delivery issues.
    email_service.send_welcome_email(email, data.name, data.role.value)

    return LoginResponse(
        access_token=token,
        role=data.role,
        user={
            "id": db_user["id"],
            "email": email,
            "name": normalize_display_name(data.name),
            "role": data.role,
        },
    )


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest) -> LoginResponse:
    email = normalize_email(data.email)
    try:
        db_user = get_user_by_email(email)
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc
    if db_user is not None:
        db_role = normalize_role(db_user["role"])
        if not verify_password(data.password, db_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if db_role != data.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Selected role does not match user role",
            )

        token = create_access_token(subject=email, role=db_role)
        return LoginResponse(
            access_token=token,
            role=db_role,
            user={
                "id": db_user["id"],
                "email": db_user["email"],
                "name": normalize_display_name(db_user["name"], fallback="User"),
                "role": db_role,
            },
        )

    user = users.get(email)
    if user is None or not verify_password(data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user_role = normalize_role(user["role"])
    if user_role != data.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Selected role does not match user role",
        )

    token = create_access_token(subject=email, role=user_role)
    return LoginResponse(
        access_token=token,
        role=user_role,
        user={
            "email": user["email"],
            "name": normalize_display_name(user["name"], fallback="User"),
            "role": user_role,
        },
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
    target = users.get(email)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target["role"] = data.role
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

    user = users.get(email)
    if user is not None:
        return {
            "email": user["email"],
            "name": normalize_display_name(user["name"], fallback="User"),
            "role": normalize_role(user["role"]),
        }

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
    try:
        entry = create_guest_entry(
            name=data.name.strip(),
            email=normalize_email(data.email),
            company=data.company.strip(),
            phone=data.phone.strip(),
            role=data.role.value,
            source=data.source.strip(),
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        ) from exc
    return {
        "success": True,
        "message": "Guest form data stored",
        "entry_id": entry["id"],
        "created_at": entry["created_at"],
    }
