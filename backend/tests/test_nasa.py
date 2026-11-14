from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app
from backend.services.nasa_appeears import AppEEARSAuthError


@pytest.mark.asyncio
async def test_get_nasa_task_status():
    mock_status = {
        "task_id": "test-task-123",
        "status": "done",
        "task_name": "TEST_TASK",
    }
    with patch(
        "backend.api.v1.endpoints.nasa.appeears_client.get_task_status",
        new=AsyncMock(return_value=mock_status),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            response = await ac.get("/api/v1/nasa/task/test-task-123")
        assert response.status_code == 200
        assert response.json()["status"] == "done"


@pytest.mark.asyncio
async def test_nasa_auth_failure_handling():
    with patch(
        "backend.api.v1.endpoints.nasa.appeears_client.get_task_status",
        new=AsyncMock(side_effect=AppEEARSAuthError("Invalid NASA token")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            response = await ac.get("/api/v1/nasa/task/invalid-task")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_submit_point_task_success():
    mock_task_resp = {"task_id": "new-uuid-456", "status": "pending"}
    with patch(
        "backend.api.v1.endpoints.nasa.appeears_client.get_product_layers",
        new=AsyncMock(return_value=("HLSL30_VI.020", ["NDVI", "EVI"])),
    ), patch(
        "backend.api.v1.endpoints.nasa.appeears_client.submit_point_task",
        new=AsyncMock(return_value=mock_task_resp),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            payload = {
                "task_name": "TEST_POINT",
                "product_prefix": "HLSL30_VI",
                "layer_name": "NDVI",
                "coordinates": [{"id": "1", "latitude": -17.38, "longitude": -66.15}],
            }
            response = await ac.post("/api/v1/nasa/task/point", json=payload)
        assert response.status_code == 200
        assert response.json()["task_id"] == "new-uuid-456"


@pytest.mark.asyncio
async def test_submit_point_task_invalid_layer():
    with patch(
        "backend.api.v1.endpoints.nasa.appeears_client.get_product_layers",
        new=AsyncMock(return_value=("HLSL30_VI.020", ["NDVI", "EVI"])),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            payload = {
                "task_name": "TEST_POINT",
                "product_prefix": "HLSL30_VI",
                "layer_name": "INVALID_LAYER",
                "coordinates": [{"id": "1", "latitude": -17.38, "longitude": -66.15}],
            }
            response = await ac.post("/api/v1/nasa/task/point", json=payload)
        assert response.status_code == 400
