"""Unit tests for fraud-service ATO detection, device reputation, and graph signals."""

from app.services.account_security import AccountSecurityAnalyzer


def test_ato_detection_and_graph_cluster():
    analyzer = AccountSecurityAnalyzer()

    # Normal login
    res1 = analyzer.record_auth_event(
        user_id="usr_1",
        device_fingerprint="fp_shared_1",
        ip_address="10.0.0.1",
        failed_attempts_1h=0,
    )
    assert res1["decision"] == "ALLOW"
    assert res1["deviceReputationScore"] == 100

    # Two more accounts share the same device + sensitive change + impossible travel
    analyzer.record_auth_event(
        user_id="usr_2",
        device_fingerprint="fp_shared_1",
        ip_address="10.0.0.2",
    )
    res3 = analyzer.record_auth_event(
        user_id="usr_3",
        device_fingerprint="fp_shared_1",
        ip_address="198.51.100.4",
        failed_attempts_1h=6,
        password_or_payout_changed=True,
        geo_distance_km=1500.0,
    )
    assert res3["decision"] == "BLOCK"
    assert res3["atoRiskScore"] >= 75
    assert res3["graphConnectedAccounts"] == 2
    assert "new_device_sensitive_change" in res3["signals"]
    assert "impossible_travel_velocity" in res3["signals"]

    rep = analyzer.get_device_reputation("fp_shared_1")
    assert rep["linkedAccounts"] == 3
    assert rep["reputationScore"] < 100
