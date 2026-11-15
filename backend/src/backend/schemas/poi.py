from typing import Literal

from pydantic import BaseModel, computed_field

POIType = Literal["school", "hospital", "park", "green_area"]


class POI(BaseModel):
    id: str
    name: str
    type: POIType
    lat: float
    lng: float
    district_id: int

    @computed_field
    @property
    def latitude(self) -> float:
        return self.lat

    @computed_field
    @property
    def longitude(self) -> float:
        return self.lng


class InterventionPoint(BaseModel):
    id: str
    title: str
    type: Literal["tree_planting", "health_center", "pocket_park"]
    latitude: float
    longitude: float
    reason: str
    slope_pct: float
    elevation_m: float
    heat_risk: str
    priority: Literal["Alta", "Media", "Baja"]
    buffer_distance_m: int


class SuggestionResult(BaseModel):
    district_id: int
    district_name: str
    meets_goal: bool
    tree_canopy_pct: float
    suggestion_text: str
    available_areas_hint: str
    candidate_interventions: list[InterventionPoint] = []
