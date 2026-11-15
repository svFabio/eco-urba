from fastapi import APIRouter, HTTPException, status

from backend.schemas.district import (
    District,
    DistrictGeoJSONCollection,
    PerimeterGeoJSONFeature,
)
from backend.services.district_service import district_service

router = APIRouter()


@router.get("", response_model=list[District], summary="List all 15 municipal districts")
def get_districts():
    """Retrieve all 15 municipal districts with zones, sensor statuses, and bounding boxes."""
    return district_service.get_all_districts()


@router.get("/geojson", response_model=DistrictGeoJSONCollection, summary="Get districts as GeoJSON FeatureCollection")
def get_districts_geojson():
    """Return municipal districts formatted as GeoJSON for direct map rendering in Leaflet/MapLibre."""
    return district_service.get_geojson_collection()


@router.get(
    "/perimeter",
    response_model=PerimeterGeoJSONFeature,
    summary="Get consolidated outer perimeter of Cercado",
)
def get_cercado_perimeter():
    """Return the dissolved outer boundary of Cochabamba (Cercado) as a single GeoJSON polygon for masking."""
    perimeter = district_service.get_cercado_perimeter()
    if not perimeter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perimeter GeoJSON not found.",
        )
    return perimeter


@router.get(
    "/cota2750",
    summary="Get official Cota 2750 boundary line (Parque Tunari)",
)
def get_cota_2750():
    """Return the official Cota 2750 line as a GeoJSON LineString Feature."""
    return district_service.get_cota_2750()


@router.get("/{district_id}", response_model=District, summary="Get district by ID")
def get_district(district_id: int):
    """Retrieve specific district details by its municipal ID (1 to 15)."""
    district = district_service.get_district_by_id(district_id)
    if not district:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"District with ID {district_id} not found.",
        )
    return district
