from typing import Optional

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, request: SignupRequest) -> User:
    hashed_password = get_password_hash(request.password)
    user = User(
        email=request.email,
        password_hash=hashed_password,
        full_name=request.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_access_token_for_user(user: User) -> str:
    return create_access_token(data={'sub': str(user.id)})
