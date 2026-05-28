import os
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

CLERK_PEM_PUBLIC_KEY = os.getenv("CLERK_PEM_PUBLIC_KEY")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

# Cache the PyJWKClient instance to prevent fetching JWKS on every request
jwk_client = None
if CLERK_JWKS_URL:
    jwk_client = PyJWKClient(CLERK_JWKS_URL)

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    token = credentials.credentials
    try:
        if CLERK_PEM_PUBLIC_KEY:
            # Mode A: High-performance, offline signature verification using the PEM key
            pem_key = CLERK_PEM_PUBLIC_KEY.strip()
            if not pem_key.startswith("-----BEGIN PUBLIC KEY-----"):
                # Format to multi-line PEM format standard if raw string is provided
                pem_key = f"-----BEGIN PUBLIC KEY-----\n{pem_key}\n-----END PUBLIC KEY-----"
            
            decoded = jwt.decode(
                token,
                pem_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
        elif jwk_client:
            # Mode B: Dynamic verification fetching and caching Clerk's JWKS keys
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
        else:
            # Mode C: Fallback local development bypass (signature not verified)
            decoded = jwt.decode(token, options={"verify_signature": False})

        user_id = decoded.get("sub")
        if not user_id:
            raise ValueError("Token missing subject (sub)")
        return user_id
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
