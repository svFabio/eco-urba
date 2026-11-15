import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.mark.asyncio
async def test_get_raster_catalog():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/rasters/catalog")
    assert response.status_code == 200
    data = response.json()
    assert "layers" in data
    assert len(data["layers"]) >= 8
    assert any(l["id"] == "lst_2025" for l in data["layers"])
    assert any(l["id"] == "delta_lst" for l in data["layers"])


@pytest.mark.asyncio
async def test_get_raster_image():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/rasters/lst_2025.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert len(response.content) > 10000


@pytest.mark.asyncio
async def test_get_raster_not_found():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/rasters/non_existent.png")
    assert response.status_code == 404
