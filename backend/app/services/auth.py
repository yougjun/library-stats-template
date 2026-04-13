"""
Auth Service — Token creation, verification, and password hashing.
Wraps JWT operations and bcrypt hashing with config-driven settings.
"""

from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
import bcrypt
import ipaddress
import logging

from app.config import config

logger = logging.getLogger(__name__)

security = HTTPBearer()


class BcryptContext:
    @staticmethod
    def hash(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify(plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


pwd_context = BcryptContext()


def create_access_token(data: dict, token_type: str = "access"):
    to_encode = data.copy()
    if token_type == "refresh":
        expire = datetime.utcnow() + timedelta(days=config.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"token_type": "refresh"})
    else:
        expire = datetime.utcnow() + timedelta(hours=config.ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"token_type": "access"})
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        token_type = payload.get("token_type", "access")
        if token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        role: str = payload.get("role")
        if role is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"role": role, "code": payload.get("code")}
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        logger.warning(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")



def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != config.LOCAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else ""


def check_ip_whitelist(request: Request):
    if not config.IP_WHITELIST_ENABLED:
        return True
    if not config.ALLOWED_IPS or len(config.ALLOWED_IPS) == 0:
        return True

    client_ip = get_client_ip(request)
    try:
        client_addr = ipaddress.ip_address(client_ip)
        for allowed in config.ALLOWED_IPS:
            if "0.0.0.0/0" == allowed or "::/0" == allowed:
                return True
            try:
                if "/" in allowed:
                    network = ipaddress.ip_network(allowed, strict=False)
                    if client_addr in network:
                        return True
                else:
                    if client_addr == ipaddress.ip_address(allowed):
                        return True
            except ValueError:
                continue
    except ValueError:
        logger.error(f"Invalid client IP: {client_ip}")

    logger.warning(f"IP whitelist blocked access from {client_ip}")
    raise HTTPException(status_code=403, detail="Access denied")
