import httpx
from fastapi import APIRouter, HTTPException, Request, Response, status

from backend.core.config import settings

router = APIRouter()

GAMC_WMS_URL = "https://serviciosgamc.cochabamba.bo/api/gs/wms"

AVAILABLE_LAYERS = [
    {"name": "limite_distritos", "title": "Límites Distritales Oficiales"},
    {"name": "areas_verdes", "title": "Áreas Verdes y Parques"},
    {"name": "cota_2750", "title": "Cota 2750 (Parque Tunari)"},
    {"name": "cuencas_principales", "title": "Cuencas Principales"},
    {"name": "limite_cercado", "title": "Límite Municipal Cercado"},
    {"name": "poblacion_por_mazanas", "title": "Población por Manzanas"},
]


@router.get("/layers", summary="List available GAMC GeoServer layers")
def list_gamc_layers():
    """Return catalog of verified official municipal GIS layers from GAMC."""
    return AVAILABLE_LAYERS


@router.get("/wms", summary="Secure proxy for GAMC GeoServer WMS tiles")
async def proxy_gamc_wms(request: Request):
    """Proxy WMS GetMap/GetFeatureInfo requests, injecting server-side credentials securely."""
    key = (
        settings.GAMC_API_KEY.get_secret_value()
        if hasattr(settings.GAMC_API_KEY, "get_secret_value")
        else str(settings.GAMC_API_KEY)
    )
    service_id = settings.GAMC_SERVICE_ID

    if not key or not service_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GAMC credentials not configured in backend .env",
        )

    params = dict(request.query_params)
    params["key"] = key
    params["service_id"] = service_id

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(GAMC_WMS_URL, params=params)
            media_type = resp.headers.get("content-type", "image/png")
            return Response(content=resp.content, status_code=resp.status_code, media_type=media_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error connecting to GAMC GeoServer: {e}",
        )
