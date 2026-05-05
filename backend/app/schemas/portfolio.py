from typing import Optional

from pydantic import BaseModel, ConfigDict


class PortfolioBase(BaseModel):
    name: str
    type: str
    description: Optional[str] = None


class PortfolioRead(PortfolioBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
