import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.mark.asyncio
async def test_get_all_districts():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/districts")
    assert response.status_code == 200
    districts = response.json()
    assert len(districts) == 15
    for d in districts:
        assert "id" in d
        assert "name" in d
        assert "centroid" in d
        assert "bbox" in d
        assert len(d["bbox"]) == 4


@pytest.mark.asyncio
async def test_get_district_geojson():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/districts/geojson")
    assert response.status_code == 200
    geojson = response.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 15
    first_feat = geojson["features"][0]
    assert first_feat["geometry"]["type"] in ("Polygon", "MultiPolygon")
    assert "properties" in first_feat


@pytest.mark.asyncio
async def test_get_single_district():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/districts/5")
    assert response.status_code == 200
    d5 = response.json()
    assert d5["id"] == 5
    assert d5["has_fixed_sensor"] is True
    assert "Av. 6 de Agosto" in d5["station_name"]


@pytest.mark.asyncio
async def test_district_not_found():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/districts/99")
    assert response.status_code == 404
