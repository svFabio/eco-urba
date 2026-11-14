from fastapi import APIRouter

from backend.api.v1.endpoints import districts, health

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(districts.router, prefix="/districts", tags=["Districts"])
