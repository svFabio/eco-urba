from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient, Response

from backend.main import app


@pytest.mark.asyncio
async def test_list_gamc_layers():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/gamc/layers")
    assert response.status_code == 200
    layers = response.json()
    assert any(l["name"] == "limite_distritos" for l in layers)
    assert any(l["name"] == "areas_verdes" for l in layers)


@pytest.mark.asyncio
async def test_proxy_gamc_wms():
    dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    mock_resp = Response(
        status_code=200,
        content=dummy_png,
        headers={"content-type": "image/png"},
    )
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_resp)):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            response = await ac.get(
                "/api/v1/gamc/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=limite_distritos"
            )
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content == dummy_png
