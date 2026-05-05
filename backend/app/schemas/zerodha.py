from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ZerodhaStatus(BaseModel):
    connected: bool
    message: str
    user_id: Optional[str] = None


class ZerodhaConnectResponse(BaseModel):
    redirect_url: str


class ZerodhaConnectCompleteRequest(BaseModel):
    request_token: str


class ZerodhaConnectCompleteResponse(BaseModel):
    success: bool
    user_id: Optional[str] = None
    message: str


class ZerodhaApiKeyInput(BaseModel):
    api_key: str
    api_secret: Optional[str] = None


class ZerodhaApiKeyResponse(BaseModel):
    success: bool
    message: str


class HoldingItem(BaseModel):
    tradingsymbol: str
    exchange: str
    instrument_token: int
    quantity: int
    average_price: float
    last_price: float
    pnl: float
    product: str


class HoldingsResponse(BaseModel):
    holdings: List[Dict[str, Any]]
    count: int


class OrderItem(BaseModel):
    order_id: str
    tradingsymbol: str
    exchange: str
    transaction_type: str
    order_type: str
    quantity: int
    price: float
    status: str
    order_timestamp: str


class OrdersResponse(BaseModel):
    orders: List[Dict[str, Any]]
    count: int


class PositionItem(BaseModel):
    tradingsymbol: str
    exchange: str
    instrument_token: int
    quantity: int
    average_price: float
    last_price: float
    pnl: float
    product: str
    net_quantity: int


class PositionsResponse(BaseModel):
    net: List[Dict[str, Any]]
    day: List[Dict[str, Any]]


class MutualFundImportResponse(BaseModel):
    status: str
    message: str
