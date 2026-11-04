import base64
import hmac
import hashlib
import json
import os
from typing import Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


def add_security_headers(response: object) -> None:
    headers = getattr(response, "headers", None)
    if headers is not None:
        headers["X-Content-Type-Options"] = "nosniff"
        headers["X-Frame-Options"] = "DENY"
        headers["X-XSS-Protection"] = "1; mode=block"
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin"


def setup_security(app: FastAPI) -> None:
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(SecurityHeadersMiddleware)


import time


def safe_timing_compare(a: str, b: str) -> bool:
    """Compares two strings in constant time using SHA-256 pre-hashing."""
    if not a or not b:
        return False
    hash_a = hashlib.sha256(a.encode("utf-8")).digest()
    hash_b = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(hash_a, hash_b)


def get_current_actor(request: Request) -> dict[str, Any] | None:
    """Resolves authenticated actor from internal secret or Clerk session."""
    settings = get_settings()
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET") or settings.INTERNAL_SERVICE_SECRET
    provided_secret = request.headers.get("x-internal-secret")
    is_internal = False
    if internal_secret and provided_secret:
        if safe_timing_compare(provided_secret, internal_secret):
            is_internal = True

    if is_internal:
        x_user_id = request.headers.get("x-user-id")
        if x_user_id:
            x_user_role = request.headers.get("x-user-role", "user")
            return {"userId": x_user_id, "role": x_user_role, "isInternal": False}
        return {"userId": "internal", "role": "admin", "isInternal": True}

    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        parts = token.split(".")
        if len(parts) == 3:
            # Clerk tokens are RS256; symmetric validation is permitted ONLY
            # via explicit test fixture key CLERK_JWT_HMAC_KEY — never CLERK_SECRET_KEY.
            hmac_key = os.getenv("CLERK_JWT_HMAC_KEY")
            if hmac_key:
                expected_sig = hmac.new(
                    hmac_key.encode("utf-8"),
                    f"{parts[0]}.{parts[1]}".encode("utf-8"),
                    hashlib.sha256,
                ).digest()
                try:
                    padding = "=" * (-len(parts[2]) % 4)
                    provided_sig = base64.urlsafe_b64decode(parts[2] + padding)
                    if not hmac.compare_digest(
                        hashlib.sha256(provided_sig).digest(),
                        hashlib.sha256(expected_sig).digest(),
                    ):
                        return None
                except Exception:
                    return None
            else:
                # Direct Bearer tokens without verified signing key cannot be trusted
                return None

            try:
                padding = "=" * (-len(parts[1]) % 4)
                payload_json = base64.urlsafe_b64decode(parts[1] + padding).decode("utf-8")
                claims = json.loads(payload_json)

                now = time.time()
                if "exp" in claims and isinstance(claims["exp"], (int, float)) and now > claims["exp"]:
                    return None
                if "nbf" in claims and isinstance(claims["nbf"], (int, float)) and now < claims["nbf"]:
                    return None

                role = (
                    claims.get("metadata", {}).get("role")
                    if isinstance(claims.get("metadata"), dict)
                    else claims.get("role")
                )
                user_id = claims.get("sub") or claims.get("user_id") or claims.get("id")
                return {"userId": user_id, "role": role or "user", "isInternal": False}
            except Exception:
                return None

    # Dev/test bypass with x-user-id header permitted only with explicit bypass flag in non-production
    is_non_prod = settings.app_env != "production"
    if is_non_prod and os.getenv("RECOMMENDATION_DEV_AUTH_BYPASS") == "true":
        x_user_id = request.headers.get("x-user-id")
        if x_user_id:
            role = request.headers.get("x-user-role", "user")
            return {"userId": x_user_id, "role": role, "isInternal": False}

    return None


def require_admin_or_internal(request: Request) -> dict[str, Any]:
    """Dependency enforcing admin role or internal service secret."""
    settings = get_settings()
    actor = get_current_actor(request)
    if actor:
        # Machine-to-machine internal service call carries no user identity
        if actor.get("isInternal") and actor.get("userId") == "internal":
            return actor
        # Proxied user request must prove admin role
        if actor.get("role") == "admin":
            return actor

    if (
        settings.app_env != "production"
        and os.getenv("RECOMMENDATION_DEV_AUTH_BYPASS") == "true"
        and not os.getenv("INTERNAL_SERVICE_SECRET")
    ):
        return {"userId": "dev_admin", "role": "admin", "isInternal": True}

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator privileges or internal secret required",
    )


def validate_user_ownership(request: Request, target_user_id: str) -> None:
    """Enforces that the caller owns the resource or is an admin."""
    settings = get_settings()
    actor = get_current_actor(request)
    if not actor:
        if settings.app_env != "production" and not os.getenv("INTERNAL_SERVICE_SECRET"):
            return
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if actor.get("role") == "admin" or actor.get("isInternal"):
        return

    if actor.get("userId") != target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access this user's data",
        )

