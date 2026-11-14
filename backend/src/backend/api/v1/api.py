from fastapi import APIRouter

from backend.api.v1.endpoints import districts, gamc, health, nasa

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(districts.router, prefix="/districts", tags=["Districts"])
api_router.include_router(gamc.router, prefix="/gamc", tags=["GAMC GeoServer"])
api_router.include_router(nasa.router, prefix="/nasa", tags=["NASA AppEEARS"])
