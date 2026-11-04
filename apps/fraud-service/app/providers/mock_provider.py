from app.providers.base import BaseRiskProvider, ProviderRiskResult
from app.schemas.fraud import AssessRiskRequest, SignalDetail

DISPOSABLE_EMAIL_DOMAINS = {
    "tempmail.com",
    "throwawaymail.com",
    "guerrillamail.com",
    "sharklasers.com",
    "mailinator.com",
    "10minutemail.com",
    "fakeinbox.com",
}

KNOWN_HIGH_RISK_IP_PREFIXES = (
    "198.51.100.",  # TEST-NET-2 / Mock Tor Exit
    "203.0.113.",   # TEST-NET-3 / Mock Datacenter Proxy
    "10.99.",       # Internal test proxy range
)


class MockExternalRiskProvider(BaseRiskProvider):
    """
    Default mock risk intelligence provider simulating external reputation checks
    for IP addresses, disposable email domains, and proxy networks.
    """

    @property
    def name(self) -> str:
        return "mock_reputation_engine"

    async def evaluate(self, request: AssessRiskRequest) -> ProviderRiskResult:
        score_delta = 0
        signals: list[SignalDetail] = []
        meta: dict[str, str] = {}

        # 1. Disposable Email Domain Reputation Check
        email = str(request.metadata.get("email") or "").strip().lower()
        if "@" in email:
            domain = email.split("@")[-1]
            if domain in DISPOSABLE_EMAIL_DOMAINS:
                score_delta += 40
                signals.append(
                    SignalDetail(
                        name="external_disposable_email_detected",
                        scoreDelta=40,
                        reason=f"External risk provider identified disposable domain '{domain}'",
                    )
                )
                meta["emailReputation"] = "DISPOSABLE"

        # 2. Known Proxy / Tor Exit Subnet Reputation Check
        ip = str(request.ipAddress or "")
        if ip and any(ip.startswith(prefix) for prefix in KNOWN_HIGH_RISK_IP_PREFIXES):
            score_delta += 45
            signals.append(
                SignalDetail(
                    name="external_proxy_or_vpn_detected",
                    scoreDelta=45,
                    reason=f"External risk intelligence flagged IP {ip} as anonymized proxy/Tor exit",
                )
            )
            meta["ipReputation"] = "ANONYMOUS_PROXY"

        return ProviderRiskResult(
            provider_name=self.name,
            risk_score_delta=min(score_delta, 60),
            signals=signals,
            metadata=meta,
        )

