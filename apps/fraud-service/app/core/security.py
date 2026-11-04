import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any
from fastapi import Header, HTTPException, Request, status
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


def safe_timing_compare(a: str, b: str) -> bool:
    """Compares two strings in constant time using SHA-256 pre-hashing."""
    if not a or not b:
        return False
    hash_a = hashlib.sha256(a.encode("utf-8")).digest()
    hash_b = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(hash_a, hash_b)


async def verify_internal_secret(
    x_internal_secret: str | None = Header(None, alias="x-internal-secret")
) -> bool:
    """Validates the internal gateway secret in constant time."""
    settings = get_settings()
    if not x_internal_secret or not safe_timing_compare(
        x_internal_secret, settings.INTERNAL_SERVICE_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid internal service secret",
        )
    return True


async def verify_admin_role(
    request: Request,
    authorization: str | None = Header(None, alias="Authorization"),
    x_user_role: str | None = Header(None, alias="x-user-role"),
    x_internal_secret: str | None = Header(None, alias="x-internal-secret"),
) -> dict[str, Any]:
    """
    Verifies that the caller has admin permissions via Clerk token or internal gateway proxy.
    Strictly prevents privilege escalation: gateway transport secret alone never elevates non-admin users.
    Direct Bearer tokens require cryptographic signature verification.
    """
    settings = get_settings()
    is_internal = bool(
        x_internal_secret and safe_timing_compare(x_internal_secret, settings.INTERNAL_SERVICE_SECRET)
    )
    user_id = request.headers.get("x-user-id")

    # 1. Internal Gateway path
    if is_internal:
        if x_user_role is not None or user_id is not None:
            if x_user_role == "admin":
                return {"role": "admin", "actor": user_id or "gateway-admin"}
            # Zero-Trust: If user context headers are present, caller must strictly possess admin role
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: administrator role required",
            )
        # Pure machine-to-machine internal service call (no user context)
        return {"role": "admin", "actor": "internal-service"}

    # 2. Direct Bearer token validation with cryptographic signature verification
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        parts = token.split(".")
        if len(parts) == 3:
            hmac_key = os.getenv("CLERK_JWT_HMAC_KEY") or settings.CLERK_JWT_HMAC_KEY
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
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Unauthorized: invalid token signature",
                        )
                except HTTPException:
                    raise
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Unauthorized: invalid token format or signature",
                    )
            else:
                # Direct Bearer tokens without verified signing key cannot be trusted
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized: direct bearer verification requires verified signing key",
                )

            try:
                padding = "=" * (-len(parts[1]) % 4)
                payload_json = base64.urlsafe_b64decode(parts[1] + padding).decode("utf-8")
                claims = json.loads(payload_json)

                now = time.time()
                exp = claims.get("exp")
                if exp and isinstance(exp, (int, float)) and now > exp:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Unauthorized: token expired",
                    )
                nbf = claims.get("nbf")
                if nbf and isinstance(nbf, (int, float)) and now < nbf:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Unauthorized: token not active yet",
                    )

                metadata = claims.get("metadata") if isinstance(claims.get("metadata"), dict) else {}
                user_metadata = claims.get("user_metadata") if isinstance(claims.get("user_metadata"), dict) else {}
                role = metadata.get("role") or user_metadata.get("role") or claims.get("role")
                if role == "admin":
                    return {"role": "admin", "actor": claims.get("sub", "admin")}
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: administrator role required",
                )
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized: malformed token payload",
                )

    # 3. Explicit development bypass (never enabled in production)
    if (
        settings.APP_ENV != "production"
        and (settings.FRAUD_DEV_AUTH_BYPASS or os.getenv("FRAUD_DEV_AUTH_BYPASS") == "true")
        and request.headers.get("x-dev-admin-override") == "true"
    ):
        return {"role": "admin", "actor": "dev-admin-override"}

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: administrator role required",
    )

