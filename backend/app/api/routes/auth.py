from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, Token, UserRead
from app.services.auth_service import authenticate_user, create_user, create_access_token_for_user

router = APIRouter()


@router.post('/signup', response_model=Token)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user = create_user(db, request)
    access_token = create_access_token_for_user(user)
    return {'access_token': access_token, 'token_type': 'bearer'}


@router.post('/login', response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail='Incorrect email or password')
    
    access_token = create_access_token_for_user(user)
    return {'access_token': access_token, 'token_type': 'bearer'}


@router.get('/me', response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
