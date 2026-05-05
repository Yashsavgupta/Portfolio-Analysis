from pydantic import BaseModel, ConfigDict


class HoldingRead(BaseModel):
    id: int
    quantity: float
    average_price: float
    current_price: float
    market_value: float

    model_config = ConfigDict(from_attributes=True)
