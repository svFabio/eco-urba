from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DistrictSummary(BaseModel):
    id: int
    name: str
    has_fixed_sensor: bool
    station_name: str | None = None


# Cochabamba's 15 Municipal Districts
COCHABAMBA_DISTRICTS: list[DistrictSummary] = [
    DistrictSummary(id=1, name="Distrito 1", has_fixed_sensor=False),
    DistrictSummary(id=2, name="Distrito 2", has_fixed_sensor=False),
    DistrictSummary(id=3, name="Distrito 3", has_fixed_sensor=False),
    DistrictSummary(id=4, name="Distrito 4", has_fixed_sensor=False),
    DistrictSummary(id=5, name="Distrito 5", has_fixed_sensor=True, station_name="Av. 6 de Agosto"),
    DistrictSummary(id=6, name="Distrito 6", has_fixed_sensor=False),
    DistrictSummary(id=7, name="Distrito 7", has_fixed_sensor=False),
    DistrictSummary(id=8, name="Distrito 8", has_fixed_sensor=False),
    DistrictSummary(id=9, name="Distrito 9", has_fixed_sensor=False),
    DistrictSummary(id=10, name="Distrito 10", has_fixed_sensor=False),
    DistrictSummary(id=11, name="Distrito 11", has_fixed_sensor=False),
    DistrictSummary(id=12, name="Distrito 12", has_fixed_sensor=True, station_name="Av. Circunvalación"),
    DistrictSummary(id=13, name="Distrito 13", has_fixed_sensor=False),
    DistrictSummary(id=14, name="Distrito 14", has_fixed_sensor=False),
    DistrictSummary(id=15, name="Distrito 15", has_fixed_sensor=False),
]


@router.get("", response_model=list[DistrictSummary], summary="List municipal districts")
def get_districts():
    return COCHABAMBA_DISTRICTS
