"""INDmoney CSV Parser - Parse and import mutual fund data from INDmoney exports"""
import logging
import csv
from io import StringIO
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.mutual_fund import MutualFund, MutualFundHolding
from app.models.portfolio import Portfolio
from app.services.mutual_fund_service import MutualFundService

logger = logging.getLogger(__name__)


class INDmoneyCSVParser:
    """Parser for INDmoney mutual fund export CSV files"""

    # Expected CSV columns - these can vary but these are common
    POSSIBLE_COLUMNS = {
        'fund_name': ['Scheme Name', 'Fund Name', 'fund_name', 'Fund', 'Name', 'Scheme'],
        'fund_house': ['Fund House', 'fund_house', 'AMC', 'Asset Management Company', 'Folio'],
        'isin': ['ISIN', 'isin', 'Scheme ISIN'],
        'units': ['Units', 'units', 'Quantity', 'Qty', 'Holdings', 'Balance Units'],
        'nav': ['NAV', 'nav', 'Unit Price', 'Price', 'Current NAV', 'Latest NAV'],
        'value': ['Current Value', 'Value', 'value', 'Market Value', 'Amount', 'Present Value'],
        'cost_basis': ['Invested Value', 'Cost', 'cost_basis', 'Investment Amount', 'Purchase Value', 'Total Invested'],
        'purchase_date': ['Purchase Date', 'purchase_date', 'Date', 'Investment Date', 'Start Date'],
        'plan_type': ['Plan', 'plan_type', 'Plan Type', 'Investment Plan', 'Option'],
    }

    @staticmethod
    def parse_csv_content(csv_content: str, portfolio_id: int) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse INDmoney CSV export
        
        Args:
            csv_content: Raw CSV content as string
            portfolio_id: Portfolio ID to associate holdings with
            
        Returns:
            Tuple of (parsed holdings list, list of error messages)
        """
        errors = []
        holdings = []
        
        try:
            # Parse CSV
            csv_reader = csv.DictReader(StringIO(csv_content))
            
            if not csv_reader.fieldnames:
                errors.append("CSV file appears to be empty or invalid")
                return holdings, errors
            
            # Map columns
            column_mapping = INDmoneyCSVParser._detect_columns(csv_reader.fieldnames)
            
            if not column_mapping:
                errors.append("Could not map CSV columns. Ensure file has Fund Name, Units, Value columns.")
                return holdings, errors
            
            # Parse rows
            for row_num, row in enumerate(csv_reader, start=2):  # Start from 2 (header is 1)
                try:
                    holding = INDmoneyCSVParser._parse_row(row, column_mapping, portfolio_id)
                    
                    if holding:
                        holdings.append(holding)
                    else:
                        logger.warning(f"Row {row_num} could not be parsed")
                
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    logger.error(f"Error parsing row {row_num}: {str(e)}")
            
            logger.info(f"Parsed {len(holdings)} holdings from INDmoney CSV")
            
        except Exception as e:
            errors.append(f"CSV parsing error: {str(e)}")
            logger.error(f"Error parsing CSV: {str(e)}")
        
        return holdings, errors

    @staticmethod
    def _detect_columns(csv_columns: List[str]) -> Dict[str, str]:
        """
        Detect and map CSV columns to expected format
        
        Args:
            csv_columns: List of column headers from CSV
            
        Returns:
            Dictionary mapping standard names to actual CSV column names
        """
        mapping = {}
        csv_columns_lower = {col.lower(): col for col in csv_columns}
        
        for standard_col, possible_names in INDmoneyCSVParser.POSSIBLE_COLUMNS.items():
            for possible_name in possible_names:
                if possible_name.lower() in csv_columns_lower:
                    mapping[standard_col] = csv_columns_lower[possible_name.lower()]
                    break
        
        # Check if we have minimum required columns
        required = ['fund_name', 'units', 'value']
        if not all(col in mapping for col in required):
            logger.error(f"Missing required columns. Mapped: {mapping}")
            return {}
        
        return mapping

    @staticmethod
    def _parse_number(value: str, default: float = 0.0) -> float:
        """Parse a number string, handling commas and empty values."""
        if not value or not str(value).strip():
            return default
        try:
            return float(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _parse_row(row: Dict[str, str], column_mapping: Dict[str, str], portfolio_id: int) -> Dict[str, Any]:
        """
        Parse a single CSV row

        Args:
            row: CSV row as dictionary
            column_mapping: Column mapping from _detect_columns
            portfolio_id: Portfolio ID

        Returns:
            Parsed holding dictionary or None
        """
        try:
            # Extract values
            fund_name = (row.get(column_mapping.get('fund_name', '')) or '').strip()
            fund_house = (row.get(column_mapping.get('fund_house', ''), '') or '').strip() or 'Unknown'
            isin = (row.get(column_mapping.get('isin', ''), '') or '').strip() or None

            units = INDmoneyCSVParser._parse_number(row.get(column_mapping.get('units', ''), ''))
            nav = INDmoneyCSVParser._parse_number(row.get(column_mapping.get('nav', ''), ''))
            current_value = INDmoneyCSVParser._parse_number(row.get(column_mapping.get('value', ''), ''))
            cost_basis = INDmoneyCSVParser._parse_number(row.get(column_mapping.get('cost_basis', ''), ''))

            # Purchase date is optional — default to today if not present or unparseable
            purchase_date_str = row.get(column_mapping.get('purchase_date', ''), '')
            purchase_date = INDmoneyCSVParser._parse_date(purchase_date_str)
            if not purchase_date:
                purchase_date = datetime.utcnow().date()

            # Plan type
            plan_type = (row.get(column_mapping.get('plan_type', ''), '') or '').strip().lower()
            if 'regular' in plan_type:
                plan_type = 'regular'
            else:
                plan_type = 'direct'

            if not fund_name:
                raise ValueError("Fund name is empty")

            # Skip rows where both units and value are zero (likely summary/footer rows)
            if units == 0 and current_value == 0:
                return None

            return {
                'fund_name': fund_name,
                'fund_house': fund_house,
                'isin': isin,
                'units': units,
                'nav_at_purchase': nav,
                'current_value': current_value,
                'cost_basis': cost_basis,
                'purchase_date': purchase_date,
                'plan_type': plan_type,
                'portfolio_id': portfolio_id,
                'source': 'indmoney'
            }

        except Exception as e:
            logger.error(f"Error parsing row: {str(e)}")
            raise

    @staticmethod
    def _parse_date(date_str: str) -> Any:
        """
        Parse date string in various formats
        
        Args:
            date_str: Date string
            
        Returns:
            datetime.date object or None
        """
        if not date_str or not date_str.strip():
            return None
        
        date_formats = [
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%d-%m-%y',
            '%d/%m/%y',
            '%B %d, %Y',
            '%b %d, %Y',
            '%d %B %Y',
            '%d %b %Y'
        ]
        
        for date_format in date_formats:
            try:
                return datetime.strptime(date_str.strip(), date_format).date()
            except ValueError:
                continue
        
        logger.warning(f"Could not parse date: {date_str}")
        return None

    @staticmethod
    def import_holdings_to_db(
        db: Session,
        parsed_holdings: List[Dict[str, Any]]
    ) -> Tuple[int, List[str]]:
        """
        Import parsed holdings into database
        
        Args:
            db: Database session
            parsed_holdings: List of parsed holding dictionaries
            
        Returns:
            Tuple of (number of holdings imported, list of error messages)
        """
        imported_count = 0
        errors = []
        
        try:
            for holding_data in parsed_holdings:
                try:
                    portfolio_id = holding_data['portfolio_id']
                    
                    # Verify portfolio exists
                    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
                    if not portfolio:
                        errors.append(f"Portfolio {portfolio_id} not found")
                        continue
                    
                    # Find or create mutual fund
                    mutual_fund = None
                    
                    if holding_data.get('isin'):
                        mutual_fund = db.query(MutualFund).filter(
                            MutualFund.isin == holding_data['isin']
                        ).first()
                    
                    if not mutual_fund:
                        # Try to find by name and fund house
                        mutual_fund = db.query(MutualFund).filter(
                            (MutualFund.name.ilike(f"%{holding_data['fund_name']}%")) &
                            (MutualFund.fund_house.ilike(f"%{holding_data['fund_house']}%"))
                        ).first()
                    
                    if not mutual_fund:
                        # Generate stable codes — truncate to avoid DB length issues
                        safe_name = holding_data['fund_name'].replace(' ', '_')[:80]
                        generated_isin = holding_data.get('isin') or f"MF_{safe_name}"
                        generated_code = f"MF_{safe_name}"

                        # Check again by generated isin/code to avoid duplicate-key errors on reimport
                        mutual_fund = db.query(MutualFund).filter(
                            MutualFund.isin == generated_isin
                        ).first()

                        if not mutual_fund:
                            mutual_fund = MutualFund(
                                isin=generated_isin,
                                fund_code=generated_code,
                                name=holding_data['fund_name'],
                                fund_house=holding_data['fund_house'],
                                category='Mutual Fund',
                                current_nav=holding_data.get('nav_at_purchase', 0),
                                is_active=True
                            )
                            db.add(mutual_fund)
                            db.flush()  # Get the ID
                    
                    # Create holding record
                    cost = holding_data['cost_basis']
                    value = holding_data['current_value']
                    gain_loss = value - cost
                    gain_loss_pct = (gain_loss / cost * 100) if cost > 0 else 0.0
                    holding_days = (datetime.utcnow().date() - holding_data['purchase_date']).days

                    mf_holding = MutualFundHolding(
                        portfolio_id=portfolio_id,
                        mutual_fund_id=mutual_fund.id,
                        units=holding_data['units'],
                        cost_basis=cost,
                        current_value=value,
                        purchase_date=holding_data['purchase_date'],
                        nav_at_purchase=holding_data.get('nav_at_purchase'),
                        plan_type=holding_data['plan_type'],
                        source=holding_data['source'],
                        gain_loss=gain_loss,
                        gain_loss_pct=gain_loss_pct,
                        holding_days=holding_days,
                        is_long_term=holding_days >= 365,
                        is_active=True
                    )
                    
                    db.add(mf_holding)
                    imported_count += 1
                
                except Exception as e:
                    errors.append(f"Error importing holding {holding_data.get('fund_name')}: {str(e)}")
                    logger.error(f"Error importing holding: {str(e)}")
                    continue
            
            db.commit()
            logger.info(f"Imported {imported_count} holdings from INDmoney")
        
        except Exception as e:
            db.rollback()
            errors.append(f"Database error during import: {str(e)}")
            logger.error(f"Database error during import: {str(e)}")
        
        return imported_count, errors

    @staticmethod
    def validate_csv(csv_content: str) -> Tuple[bool, List[str]]:
        """
        Validate CSV format before full import
        
        Args:
            csv_content: CSV content as string
            
        Returns:
            Tuple of (is_valid, list of validation errors)
        """
        errors = []
        
        try:
            csv_reader = csv.DictReader(StringIO(csv_content))
            
            if not csv_reader.fieldnames:
                errors.append("CSV file appears to be empty")
                return False, errors
            
            column_mapping = INDmoneyCSVParser._detect_columns(csv_reader.fieldnames)
            
            if not column_mapping:
                errors.append("Could not detect required columns (Fund Name, Units, Value)")
                return False, errors
            
            row_count = sum(1 for _ in csv_reader)
            
            if row_count == 0:
                errors.append("CSV file has no data rows")
                return False, errors
            
            logger.info(f"CSV validation passed. Found {row_count} rows with valid columns")
            return True, []
        
        except Exception as e:
            errors.append(f"CSV validation error: {str(e)}")
            return False, errors
