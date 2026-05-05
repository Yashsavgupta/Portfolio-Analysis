from dataclasses import dataclass
from typing import Sequence

@dataclass
class PortfolioMetrics:
    total_return: float
    annualized_return: float
    volatility: float

class PortfolioEvaluator:
    """Evaluator for simple portfolio performance metrics."""

    def __init__(self, values: Sequence[float]):
        self.values = list(values)
        if len(self.values) < 2:
            raise ValueError("At least two portfolio values are required.")

    def total_return(self) -> float:
        return self.values[-1] / self.values[0] - 1.0

    def annualized_return(self, periods_per_year: int) -> float:
        years = (len(self.values) - 1) / periods_per_year
        if years <= 0:
            raise ValueError("Number of years must be positive.")
        return (self.values[-1] / self.values[0]) ** (1.0 / years) - 1.0

    def volatility(self) -> float:
        returns = [
            self.values[i] / self.values[i - 1] - 1.0
            for i in range(1, len(self.values))
        ]
        mean_return = sum(returns) / len(returns)
        variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
        return variance ** 0.5

    def evaluate(self, periods_per_year: int) -> PortfolioMetrics:
        return PortfolioMetrics(
            total_return=self.total_return(),
            annualized_return=self.annualized_return(periods_per_year),
            volatility=self.volatility(),
        )
