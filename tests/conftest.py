"""Pytest fixtures and environment configuration"""

import os

os.environ["APP_ENV"] = "test"
os.environ["API_KEY"] = "test-api-key"
os.environ["DATA_PROVIDER"] = "mock"
