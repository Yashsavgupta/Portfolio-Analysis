import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.db.base import Base
from app.models.portfolio import Portfolio
from app.schemas.auth import SignupRequest
from app.services.auth_service import create_user
from app.services.indmoney_parser import INDmoneyCSVParser
from app.services.mutual_fund_analytics_service import MutualFundAnalyticsService


def setup_in_memory_db():
    engine = create_engine('sqlite:///:memory:', echo=False, future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_indmoney_csv_demo_import_and_analysis():
    db = setup_in_memory_db()

    user = create_user(
        db,
        SignupRequest(
            email='test@example.com',
            password='password123',
            full_name='Demo Tester'
        )
    )

    portfolio = Portfolio(
        user_id=user.id,
        name='Demo Mutual Fund Portfolio',
        type='mutual_funds',
        description='Import portfolio for mutual fund demo'
    )
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)

    csv_path = os.path.join(os.path.dirname(__file__), 'data', 'demo_indmoney_mutual_funds.csv')
    with open(csv_path, 'r', encoding='utf-8') as f:
        csv_content = f.read()

    valid, validation_errors = INDmoneyCSVParser.validate_csv(csv_content)
    assert valid, f'CSV validation failed: {validation_errors}'

    parsed_holdings, parse_errors = INDmoneyCSVParser.parse_csv_content(csv_content, portfolio.id)
    assert not parse_errors, f'CSV parsing errors: {parse_errors}'
    assert len(parsed_holdings) == 10

    imported_count, import_errors = INDmoneyCSVParser.import_holdings_to_db(db, parsed_holdings)
    assert imported_count == 10, f'Imported {imported_count} holdings, errors: {import_errors}'
    assert not import_errors

    summary = MutualFundAnalyticsService.get_portfolio_mf_summary(db, portfolio.id)
    assert summary['num_funds'] == 10
    assert summary['total_invested'] > 0
    assert summary['total_value'] > 0
    assert 'Mutual Fund' in summary['by_category']
    assert len(summary['by_house']) >= 5

    details = MutualFundAnalyticsService.get_portfolio_mf_details(db, portfolio.id)
    assert details['total'] == 10
    assert len(details['holdings']) == 10
    assert details['holdings'][0]['fund_name']
    assert details['holdings'][0]['plan_type'] in ['direct', 'regular']
