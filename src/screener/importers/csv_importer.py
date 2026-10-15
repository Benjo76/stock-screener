""" CSV Importer for portfolio holdings and transaction history """

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal


def parse_number(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return None
    # Remove currency symbols and whitespace
    s = re.sub(r"[^\d,\.\-\+]", "", s)
    if not s:
        return None

    # Handle German vs English number format
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            # German: 1.234,56 -> 1234.56
            s = s.replace(".", "").replace(",", ".")
        else:
            # English: 1,234.56 -> 1234.56
            s = s.replace(",", "")
    elif "," in s:
        # e.g. 1234,56
        s = s.replace(",", ".")
    
    try:
        return float(s)
    except ValueError:
        return None


def parse_date(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time())
    
    s = str(val).strip()
    if not s:
        return None

    date_formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]

    for fmt in date_formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue

    return None


def validate_isin(isin: str | None) -> bool:
    if not isin:
        return False
    isin = isin.strip().upper()
    return bool(re.match(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$", isin))


def validate_wkn(wkn: str | None) -> bool:
    if not wkn:
        return False
    wkn = wkn.strip().upper()
    return bool(re.match(r"^[A-Z0-9]{6}$", wkn))


@dataclass
class ParsedHoldingRow:
    row_number: int
    raw_data: dict[str, str]
    isin: str | None = None
    wkn: str | None = None
    ticker: str | None = None
    name: str | None = None
    shares: float = 0.0
    average_buy_price: float | None = None
    total_cost: float | None = None
    currency: str = "EUR"
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)


@dataclass
class ParsedTransactionRow:
    row_number: int
    raw_data: dict[str, str]
    isin: str | None = None
    wkn: str | None = None
    ticker: str | None = None
    name: str | None = None
    transaction_type: str = "BUY"  # BUY, SELL, DIVIDEND
    transaction_date: datetime | None = None
    shares: float | None = None
    price_per_share: float | None = None
    total_amount: float = 0.0
    fees: float = 0.0
    currency: str = "EUR"
    external_transaction_id: str | None = None
    notes: str | None = None
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)


@dataclass
class CsvValidationResult:
    import_type: Literal["holdings", "transactions", "unknown"]
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    holdings: list[ParsedHoldingRow] = field(default_factory=list)
    transactions: list[ParsedTransactionRow] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class CsvPortfolioImporter:
    """Robust CSV importer supporting German and English formats for holdings and transactions."""

    HEADER_MAPPINGS = {
        "isin": ["isin", "wertpapier-isin", "security_isin", "isin-code"],
        "wkn": ["wkn", "wertpapier-wkn", "security_wkn", "wertpapierkennnummer"],
        "ticker": ["ticker", "symbol", "tickersymbol", "ticker_symbol"],
        "name": ["name", "bezeichnung", "wertpapiername", "wertpapier", "security_name", "title"],
        "shares": ["shares", "stueck", "stück", "anzahl", "bestand", "menge", "quantity", "units"],
        "price": ["price", "kurs", "kaufkurs", "einstandskurs", "preis", "purchase_price", "price_per_share"],
        "total_amount": ["total", "gesamt", "gesamtwert", "kurswert", "wert", "total_amount", "amount", "betrag", "ausmachender_betrag"],
        "fees": ["fees", "gebuehren", "gebühren", "spesen", "kosten", "fee", "courtage"],
        "type": ["type", "typ", "art", "transaktionstyp", "buchungstyp", "geschaeftsart", "geschäftsart", "action"],
        "date": ["date", "datum", "buchungsdatum", "schlusstag", "ausfuehrungsdatum", "ausführungsdatum", "transaction_date"],
        "currency": ["currency", "waehrung", "währung", "curr", "devise"],
        "external_id": ["id", "tx_id", "transaction_id", "referenz", "auftragsnummer", "order_id", "belegnummer", "ext_id"],
        "notes": ["notes", "notizen", "kommentar", "bemerkung", "memo"],
    }

    @classmethod
    def detect_delimiter(cls, text: str) -> str:
        first_lines = text.strip().split("\n")[:5]
        sample = "\n".join(first_lines)
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=",;\t|")
            return dialect.delimiter
        except Exception:
            # Fallback heuristic
            semicolons = sample.count(";")
            commas = sample.count(",")
            tabs = sample.count("\t")
            if semicolons > commas and semicolons > tabs:
                return ";"
            elif tabs > commas:
                return "\t"
            return ","

    @classmethod
    def _normalize_header(cls, header: str) -> str:
        clean = header.strip().lower()
        clean = clean.replace(" ", "_").replace("-", "_")
        for standard_key, aliases in cls.HEADER_MAPPINGS.items():
            if clean in aliases:
                return standard_key
        return clean

    @classmethod
    def parse_csv_content(
        cls,
        csv_content: str,
        forced_type: Literal["holdings", "transactions"] | None = None,
    ) -> CsvValidationResult:
        content = csv_content.strip()
        if not content:
            return CsvValidationResult(
                import_type="unknown",
                total_rows=0,
                valid_rows_count=0,
                invalid_rows_count=0,
                errors=["CSV content is empty"],
            )

        delimiter = cls.detect_delimiter(content)
        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        
        try:
            headers_raw = next(reader)
        except StopIteration:
            return CsvValidationResult(
                import_type="unknown",
                total_rows=0,
                valid_rows_count=0,
                invalid_rows_count=0,
                errors=["CSV header is missing"],
            )

        headers = [cls._normalize_header(h) for h in headers_raw]

        # Determine import type if not forced
        has_type_col = "type" in headers
        has_date_col = "date" in headers
        
        if forced_type:
            import_type = forced_type
        elif has_type_col or has_date_col:
            import_type = "transactions"
        elif "shares" in headers or "isin" in headers or "wkn" in headers:
            import_type = "holdings"
        else:
            import_type = "unknown"

        if import_type == "unknown":
            return CsvValidationResult(
                import_type="unknown",
                total_rows=0,
                valid_rows_count=0,
                invalid_rows_count=0,
                errors=["Could not determine whether CSV contains holdings or transactions. Headers found: " + ", ".join(headers_raw)],
            )

        parsed_holdings: list[ParsedHoldingRow] = []
        parsed_transactions: list[ParsedTransactionRow] = []
        row_idx = 1  # 1 is header, data rows start at 2

        for row in reader:
            row_idx += 1
            if not row or all(not cell.strip() for cell in row):
                continue

            row_dict = {
                headers[i]: row[i].strip() if i < len(row) else ""
                for i in range(len(headers))
            }
            # Also keep raw
            raw_dict = {
                headers_raw[i]: row[i].strip() if i < len(row) else ""
                for i in range(len(headers_raw))
            }

            if import_type == "holdings":
                cls._process_holding_row(row_idx, row_dict, raw_dict, parsed_holdings)
            else:
                cls._process_transaction_row(row_idx, row_dict, raw_dict, parsed_transactions)

        total_rows = len(parsed_holdings) if import_type == "holdings" else len(parsed_transactions)
        valid_rows = sum(1 for r in parsed_holdings if r.is_valid) if import_type == "holdings" else sum(1 for r in parsed_transactions if r.is_valid)
        invalid_rows = total_rows - valid_rows

        return CsvValidationResult(
            import_type=import_type,
            total_rows=total_rows,
            valid_rows_count=valid_rows,
            invalid_rows_count=invalid_rows,
            holdings=parsed_holdings,
            transactions=parsed_transactions,
        )

    @classmethod
    def _process_holding_row(
        cls,
        row_number: int,
        row_dict: dict[str, str],
        raw_dict: dict[str, str],
        out_list: list[ParsedHoldingRow],
    ) -> None:
        isin = row_dict.get("isin")
        wkn = row_dict.get("wkn")
        ticker = row_dict.get("ticker")
        name = row_dict.get("name")
        currency = row_dict.get("currency") or "EUR"
        
        errors = []
        if isin:
            isin = isin.upper()
            if not validate_isin(isin):
                errors.append(f"Invalid ISIN format: '{isin}'")
        if wkn:
            wkn = wkn.upper()
            if not validate_wkn(wkn):
                errors.append(f"Invalid WKN format: '{wkn}'")
        
        if not isin and not wkn and not ticker:
            errors.append("At least one security identifier (ISIN, WKN or Ticker) is required")

        shares_val = parse_number(row_dict.get("shares"))
        if shares_val is None:
            errors.append("Shares / Quantity must be a valid number")
            shares_val = 0.0
        elif shares_val < 0:
            errors.append("Shares / Quantity cannot be negative")

        price_val = parse_number(row_dict.get("price"))
        if price_val is not None and price_val < 0:
            errors.append("Average buy price cannot be negative")

        total_cost_val = parse_number(row_dict.get("total_amount"))
        if total_cost_val is None and price_val is not None and shares_val:
            total_cost_val = round(shares_val * price_val, 2)
        elif total_cost_val is not None and total_cost_val < 0:
            errors.append("Total cost cannot be negative")

        out_list.append(
            ParsedHoldingRow(
                row_number=row_number,
                raw_data=raw_dict,
                isin=isin,
                wkn=wkn,
                ticker=ticker.upper() if ticker else None,
                name=name,
                shares=shares_val,
                average_buy_price=price_val,
                total_cost=total_cost_val,
                currency=currency.upper()[:3] if currency else "EUR",
                is_valid=(len(errors) == 0),
                errors=errors,
            )
        )

    @classmethod
    def _process_transaction_row(
        cls,
        row_number: int,
        row_dict: dict[str, str],
        raw_dict: dict[str, str],
        out_list: list[ParsedTransactionRow],
    ) -> None:
        isin = row_dict.get("isin")
        wkn = row_dict.get("wkn")
        ticker = row_dict.get("ticker")
        name = row_dict.get("name")
        currency = row_dict.get("currency") or "EUR"
        external_id = row_dict.get("external_id")
        notes = row_dict.get("notes")

        errors = []
        if isin:
            isin = isin.upper()
            if not validate_isin(isin):
                errors.append(f"Invalid ISIN format: '{isin}'")
        if wkn:
            wkn = wkn.upper()
            if not validate_wkn(wkn):
                errors.append(f"Invalid WKN format: '{wkn}'")

        if not isin and not wkn and not ticker:
            errors.append("At least one security identifier (ISIN, WKN or Ticker) is required")

        # Parse transaction type
        raw_type = row_dict.get("type", "BUY").strip().upper()
        if raw_type in ["BUY", "KAUF", "PURCHASE", "K"]:
            tx_type = "BUY"
        elif raw_type in ["SELL", "VERKAUF", "SALE", "V"]:
            tx_type = "SELL"
        elif raw_type in ["DIVIDEND", "DIVIDENDE", "AUSSCHUETTUNG", "AUSSCHÜTTUNG", "DIV"]:
            tx_type = "DIVIDEND"
        else:
            tx_type = "BUY"
            errors.append(f"Unknown transaction type '{raw_type}'. Supported: BUY, SELL, DIVIDEND")

        # Parse date
        date_raw = row_dict.get("date")
        tx_date = parse_date(date_raw) if date_raw else None
        if not tx_date:
            errors.append("Transaction date is missing or invalid")

        shares_val = parse_number(row_dict.get("shares"))
        if tx_type != "DIVIDEND" and shares_val is None:
            errors.append("Shares must be provided for BUY/SELL transactions")
        elif shares_val is not None and shares_val < 0:
            errors.append("Shares cannot be negative")

        price_val = parse_number(row_dict.get("price"))
        fees_val = parse_number(row_dict.get("fees")) or 0.0
        if fees_val < 0:
            errors.append("Fees cannot be negative")

        total_amount_val = parse_number(row_dict.get("total_amount"))
        if total_amount_val is None:
            if price_val is not None and shares_val is not None:
                total_amount_val = round((shares_val * price_val) + (fees_val if tx_type == "BUY" else -fees_val), 2)
            else:
                errors.append("Total amount must be provided or calculable from price and shares")
                total_amount_val = 0.0

        out_list.append(
            ParsedTransactionRow(
                row_number=row_number,
                raw_data=raw_dict,
                isin=isin,
                wkn=wkn,
                ticker=ticker.upper() if ticker else None,
                name=name,
                transaction_type=tx_type,
                transaction_date=tx_date,
                shares=shares_val,
                price_per_share=price_val,
                total_amount=total_amount_val,
                fees=fees_val,
                currency=currency.upper()[:3] if currency else "EUR",
                external_transaction_id=external_id,
                notes=notes,
                is_valid=(len(errors) == 0),
                errors=errors,
            )
        )
