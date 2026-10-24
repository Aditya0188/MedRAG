def test_health_endpoints(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"

    resp_v1 = client.get("/api/v1/health")
    assert resp_v1.status_code == 200

    resp_dep = client.get("/api/v1/health/dependencies")
    assert resp_dep.status_code == 200
    dep_data = resp_dep.json()
    assert dep_data["database"]["status"] == "healthy"
    assert "rxnorm_api" in dep_data
    assert "dailymed_api" in dep_data
    assert "openfda_api" in dep_data


def test_demo_scenarios_list(client):
    resp = client.get("/api/v1/demo/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    assert len(scenarios) == 3
    keys = [s["id"] for s in scenarios]
    assert "scenario_1_clear" in keys
    assert "scenario_2_ambiguous" in keys
    assert "scenario_3_no_warning" in keys
