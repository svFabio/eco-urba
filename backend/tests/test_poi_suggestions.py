from fastapi.testclient import TestClient

from backend.main import app
from backend.services.suggestion_service import _build_suggestion_text

client = TestClient(app)


def test_pois_returns_200() -> None:
    r = client.get("/api/v1/pois")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 15
    first = data[0]
    assert "id" in first
    assert "name" in first
    assert "type" in first
    assert "lat" in first
    assert "lng" in first
    assert "latitude" in first
    assert "longitude" in first
    assert "district_id" in first


def test_pois_filter_school() -> None:
    r = client.get("/api/v1/pois?type=school")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 5
    assert all(p["type"] == "school" for p in data)


def test_pois_filter_hospital_and_park() -> None:
    r_hosp = client.get("/api/v1/pois?type=hospital")
    assert r_hosp.status_code == 200
    hosp_data = r_hosp.json()
    assert len(hosp_data) >= 5
    assert all(p["type"] == "hospital" for p in hosp_data)

    r_park = client.get("/api/v1/pois?type=park")
    assert r_park.status_code == 200
    park_data = r_park.json()
    assert len(park_data) >= 5
    assert all(p["type"] == "park" for p in park_data)


def test_suggestion_district_1() -> None:
    r = client.get("/api/v1/districts/1/suggestion")
    assert r.status_code == 200
    body = r.json()
    assert body["district_id"] == 1
    assert "Distrito 1" in body["district_name"]
    assert "meets_goal" in body
    assert body["meets_goal"] is False  # D1 has 38%, goal is 44%
    assert body["tree_canopy_pct"] == 38.0
    assert "suggestion_text" in body
    assert "available_areas_hint" in body
    assert "cesión" in body["available_areas_hint"].lower() or "terreno" in body["available_areas_hint"].lower()


def test_suggestion_district_not_found() -> None:
    r = client.get("/api/v1/districts/99/suggestion")
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


def test_suggestion_meets_goal_message() -> None:
    text = _build_suggestion_text(
        district_name="Distrito Verde",
        tree_canopy_pct=46.5,
        meets_goal=True,
        heat_island_risk="Bajo",
        zone_hint="Parque Central",
    )
    assert "¡Excelente!" in text
    assert "supera la meta del 44%" in text
