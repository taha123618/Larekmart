from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel
from app.schemas.fraud import AssessRiskRequest, SignalDetail


class ProviderRiskResult(BaseModel):
    provider_name: str
    risk_score_delta: int
    signals: list[SignalDetail]
    metadata: dict[str, Any] = {}


class BaseRiskProvider(ABC):
    """
    Abstract contract for external third-party fraud & identity intelligence providers
    (e.g., Sift, MaxMind minFraud, LexisNexis ThreatMetrix, Ekata).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the risk intelligence provider."""
        pass

    @abstractmethod
    async def evaluate(self, request: AssessRiskRequest) -> ProviderRiskResult:
        """Evaluates an inbound risk request and returns an external risk score and signals."""
        pass

