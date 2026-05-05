import pytest
from portfolio_evaluator import PortfolioEvaluator


def test_total_return():
    evaluator = PortfolioEvaluator([100, 105, 110])
    assert pytest.approx(evaluator.total_return(), rel=1e-9) == 0.10


def test_annualized_return():
    evaluator = PortfolioEvaluator([100, 110])
    assert pytest.approx(evaluator.annualized_return(1), rel=1e-9) == 0.10


def test_volatility():
    evaluator = PortfolioEvaluator([100, 110, 120])
    assert evaluator.volatility() >= 0


def test_evaluate():
    evaluator = PortfolioEvaluator([100, 121])
    metrics = evaluator.evaluate(periods_per_year=1)
    assert metrics.total_return == pytest.approx(0.21, rel=1e-9)
    assert metrics.annualized_return == pytest.approx(0.21, rel=1e-9)
    assert metrics.volatility >= 0
