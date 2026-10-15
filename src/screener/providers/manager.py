""" Provider Manager for switching and falling back between providers """

import os
from typing import Literal

from screener.providers.base import BaseDataProvider
from screener.providers.mock_provider import MockDataProvider
from screener.providers.yahoo import YahooFinanceProvider


class ProviderManager:
    """Manages active financial data provider with fallback."""

    def __init__(self, default_provider_type: Literal["yahoo", "mock", "auto"] | None = None):
        self.default_provider_type = (
            default_provider_type
            or os.getenv("FINANCIAL_DATA_PROVIDER", "auto").lower()
        )
        self.yahoo_provider = YahooFinanceProvider()
        self.mock_provider = MockDataProvider()

    def get_provider(self, prefer_offline: bool = False) -> BaseDataProvider:
        # In test mode or when offline is preferred
        if (
            prefer_offline
            or self.default_provider_type == "mock"
            or os.getenv("APP_ENV") == "test"
        ):
            return self.mock_provider
        
        # When yahoo is preferred or auto in non-test mode
        return self.yahoo_provider


_default_manager = ProviderManager()


def get_data_provider() -> BaseDataProvider:
    return _default_manager.get_provider()
