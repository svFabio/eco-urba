from fastapi import APIRouter

from backend.api.v1.endpoints import districts, gamc, health, nasa, poi, rasters, suggestions, trends

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(districts.router, prefix="/districts", tags=["Districts"])
api_router.include_router(gamc.router, prefix="/gamc", tags=["GAMC GeoServer"])
api_router.include_router(nasa.router, prefix="/nasa", tags=["NASA AppEEARS"])
api_router.include_router(poi.router, prefix="/pois", tags=["POIs"])
api_router.include_router(rasters.router, prefix="/rasters", tags=["NASA Rasters"])
api_router.include_router(suggestions.router, prefix="/districts", tags=["Suggestions"])
api_router.include_router(trends.router, tags=["Trends"])
