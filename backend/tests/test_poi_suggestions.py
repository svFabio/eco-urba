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
    assert body["meets_goal"] is False  # D1 has < 44%
    assert body["tree_canopy_pct"] > 0
    assert "suggestion_text" in body
    assert "available_areas_hint" in body
    assert isinstance(body["available_areas_hint"], str) and len(body["available_areas_hint"]) > 5
    assert len(body["candidate_interventions"]) >= 1


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


def test_suggestion_candidate_interventions_topography() -> None:
    # Distrito 1 (Tunari): ladera de alta pendiente, descarta hospital
    r1 = client.get("/api/v1/districts/1/suggestion")
    assert r1.status_code == 200
    ints1 = r1.json()["candidate_interventions"]
    assert len(ints1) >= 2
    types1 = [i["type"] for i in ints1]
    assert "tree_planting" in types1
    assert "health_center" not in types1  # Pendiente alta descarta hospital
    assert any(i["slope_pct"] > 15.0 for i in ints1)

    # Distrito 10 (Centro): planicie baja, incluye centro de salud
    r10 = client.get("/api/v1/districts/10/suggestion")
    assert r10.status_code == 200
    ints10 = r10.json()["candidate_interventions"]
    assert len(ints10) >= 2
    types10 = [i["type"] for i in ints10]
    assert "tree_planting" in types10
    assert "health_center" in types10  # Terreno plano apto para salud
    assert all(i["slope_pct"] < 5.0 for i in ints10)
