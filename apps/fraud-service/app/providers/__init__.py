from app.core.config import get_settings
from app.providers.base import BaseRiskProvider, ProviderRiskResult
from app.providers.mock_provider import MockExternalRiskProvider

_active_provider: BaseRiskProvider | None = None


def get_risk_provider() -> BaseRiskProvider:
    global _active_provider
    if _active_provider is None:
        # Defaults to MockExternalRiskProvider for reproducible testing and development
        _active_provider = MockExternalRiskProvider()
    return _active_provider


__all__ = ["BaseRiskProvider", "ProviderRiskResult", "MockExternalRiskProvider", "get_risk_provider"]

