from fastapi import APIRouter

from backend.schemas.poi import POI, POIType
from backend.services.poi_service import get_pois

router = APIRouter()


@router.get("", response_model=list[POI])
def list_pois(type: POIType | None = None) -> list[POI]:
    return get_pois(poi_type=type)
