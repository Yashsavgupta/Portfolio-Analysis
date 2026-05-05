export type PortfolioSummary = {
  totalValue: number;
  returnPct: number;
  volatility: number;
};

export type HoldingItem = {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  currentValue: number;
};

export type HoldingsData = {
  holdings: Array<{
    tradingsymbol: string;
    exchange: string;
    instrument_token: number;
    quantity: number;
    last_price: number;
    pnl: number;
    product: string;
  }>;
  count: number;
};
