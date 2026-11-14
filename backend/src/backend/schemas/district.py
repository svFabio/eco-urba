from typing import Any
from pydantic import BaseModel, Field


class Centroid(BaseModel):
    latitude: float
    longitude: float


class District(BaseModel):
    id: int
    name: str
    zone: str = Field(description="Geographic/urban zone in Cochabamba (Norte, Centro, Sur, etc.)")
    has_fixed_sensor: bool
    station_name: str | None = None
    centroid: Centroid
    bbox: list[float] = Field(description="Bounding box [min_lon, min_lat, max_lon, max_lat]")
    area_km2: float | None = Field(default=None, description="Official area in square kilometers")


class DistrictGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class DistrictGeoJSONCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[DistrictGeoJSONFeature]
