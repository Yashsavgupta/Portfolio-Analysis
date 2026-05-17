from app.db.session import engine
from app.db.base import Base
# Import all models to register them
from app.models import (  # noqa: F401
    User,
    Portfolio,
    Holding,
    Instrument,
    ZerodhaAccount,
    MutualFundImport,
    PortfolioSnapshot,
    StockTrade,
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
