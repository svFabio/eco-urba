from typing import Literal
from pydantic import BaseModel, Field, JsonValue


class Centroid(BaseModel):
    latitude: float
    longitude: float


class MicroclimateProfile(BaseModel):
    ndvi_index: float = Field(description="Normalized Difference Vegetation Index [0..1]")
    surface_temp_c: float = Field(description="Estimated Land Surface Temperature in °C")
    heat_island_risk: Literal["Crítico", "Alto", "Moderado", "Bajo"]
    tree_canopy_pct: float = Field(description="Estimated urban tree canopy percentage")
    resilience_action: str = Field(description="Recommended climate resilience action for the district")


class District(BaseModel):
    id: int
    name: str
    zone: str = Field(description="Geographic/urban zone in Cochabamba (Norte, Centro, Sur, etc.)")
    has_fixed_sensor: bool
    station_name: str | None = None
    centroid: Centroid
    bbox: list[float] = Field(description="Bounding box [min_lon, min_lat, max_lon, max_lat]")
    area_km2: float | None = Field(default=None, description="Official area in square kilometers")
    microclimate: MicroclimateProfile | None = None


class GeoJSONGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list[JsonValue]


class DistrictGeoJSONProperties(BaseModel):
    id: int
    name: str
    zone: str
    has_fixed_sensor: bool
    station_name: str | None = None
    centroid: list[float]
    area_km2: float
    municipio: str = "Cochabamba (Cercado)"
    microclimate: MicroclimateProfile | None = None


class DistrictGeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONGeometry
    properties: DistrictGeoJSONProperties


class DistrictGeoJSONCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[DistrictGeoJSONFeature]


class PerimeterProperties(BaseModel):
    nombre: str
    municipio: str


class PerimeterGeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONGeometry
    properties: PerimeterProperties
