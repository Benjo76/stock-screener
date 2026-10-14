from pydantic import BaseModel, ConfigDict, Field


class SecurityCreate(BaseModel):
    isin: str | None = Field(
        default=None,
        min_length=12,
        max_length=12,
        description="International Securities Identification Number (12 characters)",
        examples=["US0378331005"],
    )
    wkn: str | None = Field(
        default=None,
        min_length=6,
        max_length=6,
        description="Wertpapierkennnummer (German securities identification code, 6 characters)",
        examples=["865985"],
    )
    ticker: str | None = Field(
        default=None,
        max_length=32,
        description="Stock ticker symbol",
        examples=["AAPL"],
    )
    name: str | None = Field(
        default=None,
        max_length=255,
        description="Company / security name",
        examples=["Apple Inc."],
    )
    exchange: str | None = Field(
        default=None,
        max_length=100,
        description="Exchange name",
        examples=["NASDAQ"],
    )
    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        description="ISO 4217 Currency Code (3 characters)",
        examples=["USD"],
    )


class SecurityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Unique internal ID of the security", examples=[1])
    isin: str = Field(
        description="International Securities Identification Number",
        examples=["US0378331005"],
    )
    wkn: str | None = Field(
        default=None,
        description="Wertpapierkennnummer",
        examples=["865985"],
    )
    ticker: str | None = Field(
        default=None,
        description="Stock ticker symbol",
        examples=["AAPL"],
    )
    name: str | None = Field(
        default=None,
        description="Company / security name",
        examples=["Apple Inc."],
    )
    exchange: str | None = Field(
        default=None,
        description="Exchange name",
        examples=["NASDAQ"],
    )
    currency: str | None = Field(
        default=None,
        description="ISO 4217 Currency Code",
        examples=["USD"],
    )
