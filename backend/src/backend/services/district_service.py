import json
from pathlib import Path

from backend.schemas.district import (
    Centroid,
    District,
    DistrictGeoJSONCollection,
    DistrictGeoJSONFeature,
    DistrictGeoJSONProperties,
    GeoJSONGeometry,
    PerimeterGeoJSONFeature,
)

COCHABAMBA_DISTRICTS: list[District] = [
    District(
        id=1,
        name="Distrito 1 - Tunari",
        zone="Norte (Parque Tunari)",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3480, longitude=-66.1680),
        bbox=[-66.1950, -17.3650, -66.1410, -17.3310],
        area_km2=5.695,
    ),
    District(
        id=2,
        name="Distrito 2 - Muyurina",
        zone="Noreste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3750, longitude=-66.1400),
        bbox=[-66.1600, -17.3900, -66.1200, -17.3600],
        area_km2=9.075,
    ),
    District(
        id=3,
        name="Distrito 3 - Sarco",
        zone="Noroeste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3720, longitude=-66.1850),
        bbox=[-66.2050, -17.3900, -66.1650, -17.3550],
        area_km2=8.156,
    ),
    District(
        id=4,
        name="Distrito 4 - Cala Cala",
        zone="Norte Urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3680, longitude=-66.1620),
        bbox=[-66.1800, -17.3850, -66.1440, -17.3510],
        area_km2=8.344,
    ),
    District(
        id=5,
        name="Distrito 5 - Alalay",
        zone="Sur Central",
        has_fixed_sensor=True,
        station_name="Av. 6 de Agosto (Red MÓNICA)",
        centroid=Centroid(latitude=-17.4120, longitude=-66.1480),
        bbox=[-66.1680, -17.4300, -66.1280, -17.3940],
        area_km2=10.444,
    ),
    District(
        id=6,
        name="Distrito 6 - San Antonio",
        zone="Este Urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4050, longitude=-66.1350),
        bbox=[-66.1520, -17.4250, -66.1180, -17.3850],
        area_km2=9.010,
    ),
    District(
        id=7,
        name="Distrito 7 - Tamborada",
        zone="Sur",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4350, longitude=-66.1420),
        bbox=[-66.1600, -17.4550, -66.1240, -17.4150],
        area_km2=5.175,
    ),
    District(
        id=8,
        name="Distrito 8 - Jaihuayco",
        zone="Suroeste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4200, longitude=-66.1700),
        bbox=[-66.1900, -17.4400, -66.1500, -17.4000],
        area_km2=24.740,
    ),
    District(
        id=9,
        name="Distrito 9 - Pucara / Arrumani",
        zone="Extremo Sur",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4600, longitude=-66.1650),
        bbox=[-66.2100, -17.4900, -66.1200, -17.4300],
        area_km2=118.282,
    ),
    District(
        id=10,
        name="Distrito 10 - Centro Histórico",
        zone="Centro",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3935, longitude=-66.1570),
        bbox=[-66.1700, -17.4050, -66.1440, -17.3820],
        area_km2=5.602,
    ),
    District(
        id=11,
        name="Distrito 11 - Las Cuadras",
        zone="Centro Este",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3880, longitude=-66.1440),
        bbox=[-66.1550, -17.4000, -66.1330, -17.3760],
        area_km2=5.559,
    ),
    District(
        id=12,
        name="Distrito 12 - Queru Queru",
        zone="Noreste Urbano",
        has_fixed_sensor=True,
        station_name="Av. Circunvalación (Red MÓNICA)",
        centroid=Centroid(latitude=-17.3620, longitude=-66.1490),
        bbox=[-66.1650, -17.3780, -66.1330, -17.3460],
        area_km2=7.653,
    ),
    District(
        id=13,
        name="Distrito 13 - Condebamba",
        zone="Noroeste Semi-urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3550, longitude=-66.1950),
        bbox=[-66.2200, -17.3750, -66.1700, -17.3350],
        area_km2=48.783,
    ),
    District(
        id=14,
        name="Distrito 14 - Valle Hermoso",
        zone="Sureste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4250, longitude=-66.1250),
        bbox=[-66.1450, -17.4500, -66.1050, -17.4000],
        area_km2=6.939,
    ),
    District(
        id=15,
        name="Distrito 15 - K'ara K'ara",
        zone="Sur Periférico",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4450, longitude=-66.1150),
        bbox=[-66.1350, -17.4700, -66.0950, -17.4200],
        area_km2=21.224,
    ),
]

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DOCS_DIR = Path(__file__).resolve().parents[4] / "docs" / "distritos"


PERIMETER_GEOJSON_FILE = DATA_DIR / "perimetro_cercado.geojson"
PERIMETER_DOCS_FILE = DOCS_DIR / "perimetro_cercado.geojson"


def resolve_geojson_path() -> Path | None:
    for path in [
        DATA_DIR / "distritos_cercado_cochabamba.geojson",
        DOCS_DIR / "distritos_cercado_cochabamba.geojson",
    ]:
        if path.exists():
            return path
    return None


class DistrictService:
    def __init__(self) -> None:
        self._cached_geojson: DistrictGeoJSONCollection | None = None

    @staticmethod
    def get_all_districts() -> list[District]:
        return COCHABAMBA_DISTRICTS

    @staticmethod
    def get_district_by_id(district_id: int) -> District | None:
        return next((d for d in COCHABAMBA_DISTRICTS if d.id == district_id), None)

    def get_geojson_collection(self) -> DistrictGeoJSONCollection:
        if self._cached_geojson is not None:
            return self._cached_geojson

        district_lookup = {d.id: d for d in COCHABAMBA_DISTRICTS}
        geojson_path = resolve_geojson_path()

        if geojson_path:
            with open(geojson_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            features: list[DistrictGeoJSONFeature] = []
            for feat in raw_data.get("features", []):
                props = feat.get("properties", {})
                d_id = int(props.get("distrito", 0))
                district = district_lookup.get(d_id)

                merged_props = {
                    "id": d_id,
                    "name": district.name if district else props.get("nombre", f"Distrito {d_id}"),
                    "zone": district.zone if district else "Cochabamba",
                    "has_fixed_sensor": district.has_fixed_sensor if district else False,
                    "station_name": district.station_name if district else None,
                    "centroid": (
                        [district.centroid.longitude, district.centroid.latitude]
                        if district
                        else [0.0, 0.0]
                    ),
                    "area_km2": float(props.get("area_km2", district.area_km2 if district else 0.0)),
                    "municipio": props.get("municipio", "Cochabamba (Cercado)"),
                }

                features.append(
                    DistrictGeoJSONFeature(
                        type="Feature",
                        geometry=feat["geometry"],
                        properties=merged_props,
                    )
                )

            self._cached_geojson = DistrictGeoJSONCollection(features=features)
            return self._cached_geojson

        # Fallback to bbox rectangles if GeoJSON file is not present
        features = []
        for d in COCHABAMBA_DISTRICTS:
            min_lon, min_lat, max_lon, max_lat = d.bbox
            polygon = [
                [
                    [min_lon, min_lat],
                    [max_lon, min_lat],
                    [max_lon, max_lat],
                    [min_lon, max_lat],
                    [min_lon, min_lat],
                ]
            ]
            features.append(
                DistrictGeoJSONFeature(
                    type="Feature",
                    geometry={"type": "Polygon", "coordinates": polygon},
                    properties={
                        "id": d.id,
                        "name": d.name,
                        "zone": d.zone,
                        "has_fixed_sensor": d.has_fixed_sensor,
                        "station_name": d.station_name,
                        "centroid": [d.centroid.longitude, d.centroid.latitude],
                        "area_km2": d.area_km2,
                        "municipio": "Cochabamba (Cercado)",
                    },
                )
            )
        self._cached_geojson = DistrictGeoJSONCollection(features=features)
        return self._cached_geojson

    def get_cercado_perimeter(self) -> PerimeterGeoJSONFeature | None:
        for path in [PERIMETER_GEOJSON_FILE, PERIMETER_DOCS_FILE]:
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    return PerimeterGeoJSONFeature.model_validate(raw)
        return None


district_service = DistrictService()
