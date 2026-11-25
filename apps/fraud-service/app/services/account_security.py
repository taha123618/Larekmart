"""Account takeover (ATO) detection, device reputation, and graph fraud signals."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class DeviceProfile:
    fingerprint: str
    linked_users: set[str] = field(default_factory=set)
    failed_attempts: int = 0
    is_blocked: bool = False
    last_seen_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def reputation_score(self) -> int:
        if self.is_blocked:
            return 0
        penalty = min(60, max(0, len(self.linked_users) - 1) * 20) + min(40, self.failed_attempts * 8)
        return max(0, 100 - penalty)


class AccountSecurityAnalyzer:
    """In-memory analyzer for ATO signals, device reputation, and graph clusters."""

    def __init__(self) -> None:
        self._devices: dict[str, DeviceProfile] = {}
        self._user_devices: dict[str, set[str]] = defaultdict(set)
        self._user_ips: dict[str, set[str]] = defaultdict(set)

    def record_auth_event(
        self,
        *,
        user_id: str,
        device_fingerprint: str,
        ip_address: str,
        failed_attempts_1h: int = 0,
        password_or_payout_changed: bool = False,
        geo_distance_km: float = 0.0,
    ) -> dict:
        profile = self._devices.get(device_fingerprint)
        if profile is None:
            profile = DeviceProfile(fingerprint=device_fingerprint)
            self._devices[device_fingerprint] = profile

        is_new_device = device_fingerprint not in self._user_devices[user_id]
        profile.linked_users.add(user_id)
        profile.failed_attempts += max(0, failed_attempts_1h)
        profile.last_seen_at = datetime.now(timezone.utc).isoformat()

        self._user_devices[user_id].add(device_fingerprint)
        self._user_ips[user_id].add(ip_address)

        ato_score = 0
        signals: list[str] = []

        if is_new_device and password_or_payout_changed:
            ato_score += 45
            signals.append("new_device_sensitive_change")
        if geo_distance_km > 800:
            ato_score += 35
            signals.append("impossible_travel_velocity")
        if failed_attempts_1h >= 5:
            ato_score += 30
            signals.append("credential_stuffing_burst")
        if len(profile.linked_users) >= 3:
            ato_score += 25
            signals.append("shared_device_cluster")

        ato_score = min(100, ato_score)
        decision = "BLOCK" if ato_score >= 75 else "CHALLENGE" if ato_score >= 40 else "ALLOW"

        # Connected graph neighborhood via shared devices
        connected_accounts: set[str] = set()
        for fp in self._user_devices[user_id]:
            dev = self._devices.get(fp)
            if dev:
                connected_accounts.update(dev.linked_users)
        connected_accounts.discard(user_id)

        return {
            "userId": user_id,
            "atoRiskScore": ato_score,
            "decision": decision,
            "signals": signals,
            "deviceReputationScore": profile.reputation_score,
            "graphConnectedAccounts": len(connected_accounts),
        }

    def get_device_reputation(self, fingerprint: str) -> dict:
        profile = self._devices.get(fingerprint)
        if profile is None:
            return {
                "fingerprint": fingerprint,
                "reputationScore": 100,
                "linkedAccounts": 0,
                "isBlocked": False,
            }
        return {
            "fingerprint": profile.fingerprint,
            "reputationScore": profile.reputation_score,
            "linkedAccounts": len(profile.linked_users),
            "failedAttempts": profile.failed_attempts,
            "isBlocked": profile.is_blocked,
            "lastSeenAt": profile.last_seen_at,
        }


account_security_analyzer = AccountSecurityAnalyzer()
