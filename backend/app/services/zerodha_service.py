from datetime import datetime
from typing import Any, Dict, Optional

from kiteconnect import KiteConnect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.zerodha_account import ZerodhaAccount
import logging

logger = logging.getLogger(__name__)


def _get_account(user_id: int, db: Session) -> Optional[ZerodhaAccount]:
    return db.query(ZerodhaAccount).filter(ZerodhaAccount.user_id == user_id).first()


def _resolve_credentials(user_id: int, db: Session) -> tuple[Optional[str], Optional[str], Optional[str], Optional[ZerodhaAccount]]:
    account = _get_account(user_id, db)
    api_key = (account.api_key if account and account.api_key else settings.ZERODHA_API_KEY).strip() or None
    api_secret = (account.api_secret if account and account.api_secret else settings.ZERODHA_API_SECRET).strip() or None
    access_token = account.access_token if account and account.access_token else None
    return api_key, api_secret, access_token, account


def _build_client(api_key: str, access_token: Optional[str] = None) -> KiteConnect:
    client = KiteConnect(api_key=api_key)
    if access_token:
        client.set_access_token(access_token)
    return client


def _get_authenticated_client(user_id: int, db: Session) -> tuple[Optional[KiteConnect], Optional[ZerodhaAccount], Optional[str]]:
    api_key, _, access_token, account = _resolve_credentials(user_id, db)
    if not api_key:
        return None, account, 'Zerodha API key not configured'
    if not access_token:
        return None, account, 'Zerodha account not connected'
    return _build_client(api_key, access_token), account, None


def get_zerodha_status(user_id: int, db: Session) -> dict:
    """Check if user has connected Zerodha account"""
    zerodha_account = _get_account(user_id, db)

    if zerodha_account and zerodha_account.access_token:
        return {
            'connected': True,
            'user_id': zerodha_account.zerodha_user_id,
            'message': 'Zerodha account connected successfully'
        }

    api_key, _, _, _ = _resolve_credentials(user_id, db)
    return {
        'connected': False,
        'message': (
            'Zerodha account not connected. Please connect your Zerodha account.'
            if api_key
            else 'Zerodha API key not configured. Save your API credentials before connecting.'
        )
    }


def begin_zerodha_connect(user_id: int, db: Session) -> str:
    """Generate Zerodha login URL"""
    api_key, _, _, _ = _resolve_credentials(user_id, db)
    if not api_key:
        raise ValueError('Zerodha API key not configured')

    login_url = _build_client(api_key).login_url()
    return login_url


def complete_zerodha_connect(request_token: str, user_id: int, db: Session) -> Dict[str, Any]:
    """Complete Zerodha OAuth flow and store access token"""
    try:
        api_key, api_secret, _, zerodha_account = _resolve_credentials(user_id, db)
        if not api_key or not api_secret:
            raise ValueError('Zerodha API credentials are incomplete')

        kite = _build_client(api_key)
        data = kite.generate_session(request_token, api_secret=api_secret)
        access_token = data["access_token"]
        zerodha_user_id = data["user_id"]

        if not zerodha_account:
            zerodha_account = ZerodhaAccount(
                user_id=user_id,
            )
            db.add(zerodha_account)

        zerodha_account.zerodha_user_id = zerodha_user_id
        zerodha_account.access_token = access_token
        zerodha_account.status = 'connected'
        zerodha_account.last_synced_at = datetime.utcnow()

        db.commit()
        db.refresh(zerodha_account)

        return {
            'success': True,
            'user_id': zerodha_user_id,
            'message': 'Zerodha account connected successfully'
        }

    except Exception as e:
        logger.error(f"Error completing Zerodha connect: {str(e)}")
        db.rollback()
        return {
            'success': False,
            'message': f'Failed to connect Zerodha account: {str(e)}'
        }


def set_zerodha_api_keys(user_id: int, api_key: str, api_secret: Optional[str], db: Session) -> Dict[str, Any]:
    """Store Zerodha API keys for user"""
    try:
        normalized_api_key = (api_key or '').strip()
        normalized_api_secret = (api_secret or '').strip()
        if not normalized_api_key:
            return {
                'success': False,
                'message': 'API key is required'
            }

        zerodha_account = _get_account(user_id, db)

        if not zerodha_account:
            if not normalized_api_secret:
                return {
                    'success': False,
                    'message': 'API secret is required when saving Zerodha API keys for the first time'
                }
            zerodha_account = ZerodhaAccount(
                user_id=user_id,
            )
            db.add(zerodha_account)

        zerodha_account.api_key = normalized_api_key
        if normalized_api_secret:
            zerodha_account.api_secret = normalized_api_secret
        elif not zerodha_account.api_secret:
            return {
                'success': False,
                'message': 'API secret is required when no saved secret exists'
            }

        if zerodha_account.status != 'connected':
            zerodha_account.status = 'api_keys_set'

        db.commit()
        db.refresh(zerodha_account)

        return {
            'success': True,
            'message': 'Zerodha API keys saved successfully'
        }

    except Exception as e:
        logger.error(f"Error saving Zerodha API keys: {str(e)}")
        db.rollback()
        return {
            'success': False,
            'message': f'Failed to save API keys: {str(e)}'
        }


def get_zerodha_api_keys(user_id: int, db: Session) -> Dict[str, Any]:
    """Get Zerodha API keys for user"""
    zerodha_account = _get_account(user_id, db)

    if zerodha_account and zerodha_account.api_key:
        return {
            'api_key': zerodha_account.api_key,
            'has_api_secret': bool(zerodha_account.api_secret),
        }

    return {'has_api_secret': False}


def get_zerodha_holdings(user_id: int, db: Session) -> Dict[str, Any]:
    """Fetch holdings from Zerodha"""
    kite, zerodha_account, error = _get_authenticated_client(user_id, db)
    if error:
        return {'error': error}

    try:
        holdings = kite.holdings()
        if zerodha_account:
            zerodha_account.last_synced_at = datetime.utcnow()
            db.commit()
        return {
            'holdings': holdings,
            'count': len(holdings)
        }
    except Exception as e:
        logger.error(f"Error fetching Zerodha holdings: {str(e)}")
        db.rollback()
        return {'error': f'Failed to fetch holdings: {str(e)}'}

def get_zerodha_orders(user_id: int, db: Session) -> Dict[str, Any]:
    """Fetch orders from Zerodha"""
    kite, _, error = _get_authenticated_client(user_id, db)
    if error:
        return {'error': error}

    try:
        orders = kite.orders()

        return {
            'orders': orders,
            'count': len(orders)
        }

    except Exception as e:
        logger.error(f"Error fetching Zerodha orders: {str(e)}")
        return {'error': f'Failed to fetch orders: {str(e)}'}

def get_zerodha_positions(user_id: int, db: Session) -> Dict[str, Any]:
    """Fetch positions from Zerodha"""
    kite, _, error = _get_authenticated_client(user_id, db)
    if error:
        return {'error': error}

    try:
        positions = kite.positions()

        return {
            'net': positions.get('net', []),
            'day': positions.get('day', [])
        }

    except Exception as e:
        logger.error(f"Error fetching Zerodha positions: {str(e)}")
        return {'error': f'Failed to fetch positions: {str(e)}'}
