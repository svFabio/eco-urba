from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_get_district_trend_success():
    response = client.get("/api/v1/districts/1/trends")
    assert response.status_code == 200
    data = response.json()
    assert data["district_id"] == 1
    assert "warming_rate_c_per_decade" in data
    assert "p_value" in data
    assert "is_significant" in data
    assert "history" in data
    assert len(data["history"]) == 8
    assert data["history"][0]["year"] == 2018
    assert data["history"][-1]["year"] == 2025


def test_get_district_trend_calibrated_sensor():
    # Distrito 5 tiene estacion MONICA
    response = client.get("/api/v1/districts/5/trends")
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_fusion_type"] == "Estación MÓNICA Calibrada"


def test_get_district_trend_not_found():
    response = client.get("/api/v1/districts/999/trends")
    assert response.status_code == 404
