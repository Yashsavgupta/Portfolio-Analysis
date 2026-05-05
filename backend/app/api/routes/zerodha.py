from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.zerodha import (
    ZerodhaConnectResponse,
    ZerodhaStatus,
    ZerodhaConnectCompleteRequest,
    ZerodhaConnectCompleteResponse,
    ZerodhaApiKeyInput,
    ZerodhaApiKeyResponse,
    HoldingsResponse,
    OrdersResponse,
    PositionsResponse
)
from app.services.zerodha_service import (
    get_zerodha_status,
    begin_zerodha_connect,
    complete_zerodha_connect,
    set_zerodha_api_keys,
    get_zerodha_api_keys,
    get_zerodha_holdings,
    get_zerodha_orders,
    get_zerodha_positions
)
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


@router.get('/status', response_model=ZerodhaStatus)
def zerodha_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Zerodha connection status for current user"""
    return get_zerodha_status(current_user.id, db)


@router.post('/connect', response_model=ZerodhaConnectResponse)
def zerodha_connect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate Zerodha OAuth flow"""
    try:
        login_url = begin_zerodha_connect(current_user.id, db)
        return {'redirect_url': login_url}
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/connect/complete', response_model=ZerodhaConnectCompleteResponse)
def zerodha_connect_complete(
    payload: ZerodhaConnectCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete Zerodha OAuth flow"""
    result = complete_zerodha_connect(payload.request_token, current_user.id, db)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    return result


@router.get('/holdings', response_model=HoldingsResponse)
def zerodha_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Zerodha holdings"""
    result = get_zerodha_holdings(current_user.id, db)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result


@router.get('/orders', response_model=OrdersResponse)
def zerodha_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Zerodha orders"""
    result = get_zerodha_orders(current_user.id, db)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result


@router.post('/api-keys', response_model=ZerodhaApiKeyResponse)
def set_api_keys(
    api_key_data: ZerodhaApiKeyInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set Zerodha API keys for current user"""
    result = set_zerodha_api_keys(current_user.id, api_key_data.api_key, api_key_data.api_secret, db)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    return result


@router.get('/api-keys')
def get_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Zerodha API keys for current user"""
    return get_zerodha_api_keys(current_user.id, db)
