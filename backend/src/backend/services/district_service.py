import json
from pathlib import Path

from backend.schemas.district import (
    Centroid,
    District,
    DistrictGeoJSONCollection,
    DistrictGeoJSONFeature,
    DistrictGeoJSONProperties,
    GeoJSONGeometry,
    MicroclimateProfile,
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
        microclimate=MicroclimateProfile(
            ndvi_index=0.58,
            surface_temp_c=24.2,
            heat_island_risk="Bajo",
            tree_canopy_pct=38.0,
            resilience_action="Protección estricta de la Cota 2750 y recarga hídrica contra loteamientos.",
        ),
    ),
    District(
        id=2,
        name="Distrito 2 - Tunari",
        zone="Norte",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3750, longitude=-66.1400),
        bbox=[-66.1600, -17.3900, -66.1200, -17.3600],
        area_km2=9.075,
        microclimate=MicroclimateProfile(
            ndvi_index=0.35,
            surface_temp_c=28.5,
            heat_island_risk="Moderado",
            tree_canopy_pct=18.0,
            resilience_action="Consolidación de corredores biológicos urbanos hacia la serranía este.",
        ),
    ),
    District(
        id=3,
        name="Distrito 3 - Sarco",
        zone="Noroeste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3720, longitude=-66.1850),
        bbox=[-66.2050, -17.3900, -66.1650, -17.3550],
        area_km2=8.156,
        microclimate=MicroclimateProfile(
            ndvi_index=0.31,
            surface_temp_c=29.8,
            heat_island_risk="Moderado",
            tree_canopy_pct=14.0,
            resilience_action="Incremento de arbolado nativo en aceras, plazas y ciclovías colectoras.",
        ),
    ),
    District(
        id=4,
        name="Distrito 4 - Molle",
        zone="Oeste Urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3680, longitude=-66.1620),
        bbox=[-66.1800, -17.3850, -66.1440, -17.3510],
        area_km2=8.344,
        microclimate=MicroclimateProfile(
            ndvi_index=0.28,
            surface_temp_c=31.0,
            heat_island_risk="Alto",
            tree_canopy_pct=11.0,
            resilience_action="Mitigación de radiación solar en avenidas anchas y plazas duras mediante toldos vivos.",
        ),
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
        microclimate=MicroclimateProfile(
            ndvi_index=0.32,
            surface_temp_c=30.5,
            heat_island_risk="Moderado",
            tree_canopy_pct=15.0,
            resilience_action="Preservación del espejo de agua de la Laguna Alalay y anillo verde de amortiguamiento.",
        ),
    ),
    District(
        id=6,
        name="Distrito 6 - San Antonio",
        zone="Este Urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4050, longitude=-66.1350),
        bbox=[-66.1520, -17.4250, -66.1180, -17.3850],
        area_km2=9.010,
        microclimate=MicroclimateProfile(
            ndvi_index=0.22,
            surface_temp_c=32.8,
            heat_island_risk="Alto",
            tree_canopy_pct=8.0,
            resilience_action="Implementación de pavimentos permeables y techos verdes en zona comercial densa.",
        ),
    ),
    District(
        id=7,
        name="Distrito 7 - Tamborada",
        zone="Sur",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4350, longitude=-66.1420),
        bbox=[-66.1600, -17.4550, -66.1240, -17.4150],
        area_km2=5.175,
        microclimate=MicroclimateProfile(
            ndvi_index=0.29,
            surface_temp_c=31.2,
            heat_island_risk="Moderado",
            tree_canopy_pct=10.0,
            resilience_action="Reforestación perimetral del río Tamborada y barreras verdes periurbanas.",
        ),
    ),
    District(
        id=8,
        name="Distrito 8 - Jaihuayco",
        zone="Suroeste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4200, longitude=-66.1700),
        bbox=[-66.1900, -17.4400, -66.1500, -17.4000],
        area_km2=24.740,
        microclimate=MicroclimateProfile(
            ndvi_index=0.20,
            surface_temp_c=33.6,
            heat_island_risk="Crítico",
            tree_canopy_pct=6.0,
            resilience_action="Plan intensivo de forestación urbana y sombreamiento en paradas y colegios.",
        ),
    ),
    District(
        id=9,
        name="Distrito 9 - Pucara / Arrumani",
        zone="Extremo Sur",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4600, longitude=-66.1650),
        bbox=[-66.2100, -17.4900, -66.1200, -17.4300],
        area_km2=118.282,
        microclimate=MicroclimateProfile(
            ndvi_index=0.19,
            surface_temp_c=33.9,
            heat_island_risk="Alto",
            tree_canopy_pct=5.0,
            resilience_action="Control de erosión en laderas áridas y siembra de especies nativas de bajo consumo hídrico.",
        ),
    ),
    District(
        id=10,
        name="Distrito 10 - Centro Histórico",
        zone="Centro",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3935, longitude=-66.1570),
        bbox=[-66.1700, -17.4050, -66.1440, -17.3820],
        area_km2=5.602,
        microclimate=MicroclimateProfile(
            ndvi_index=0.12,
            surface_temp_c=35.2,
            heat_island_risk="Crítico",
            tree_canopy_pct=4.0,
            resilience_action="Urgente reducción de impermeabilización, peatonalización verde y arbolado vertical en calles.",
        ),
    ),
    District(
        id=11,
        name="Distrito 11 - Las Cuadras",
        zone="Centro Este",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3880, longitude=-66.1440),
        bbox=[-66.1550, -17.4000, -66.1330, -17.3760],
        area_km2=5.559,
        microclimate=MicroclimateProfile(
            ndvi_index=0.26,
            surface_temp_c=31.8,
            heat_island_risk="Alto",
            tree_canopy_pct=9.0,
            resilience_action="Ampliación de masa arbórea en campus universitario UMSS y avenidas conectoras.",
        ),
    ),
    District(
        id=12,
        name="Distrito 12 - Cala Cala / Queru Queru",
        zone="Norte Urbano",
        has_fixed_sensor=True,
        station_name="Av. Circunvalación (Red MÓNICA)",
        centroid=Centroid(latitude=-17.3620, longitude=-66.1490),
        bbox=[-66.1650, -17.3780, -66.1330, -17.3460],
        area_km2=7.653,
        microclimate=MicroclimateProfile(
            ndvi_index=0.40,
            surface_temp_c=27.2,
            heat_island_risk="Bajo",
            tree_canopy_pct=24.0,
            resilience_action="Preservación del Jardín Botánico Martín Cárdenas e incentivo a jardines residenciales permeables.",
        ),
    ),
    District(
        id=13,
        name="Distrito 13 - Condebamba",
        zone="Noroeste Semi-urbano",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.3550, longitude=-66.1950),
        bbox=[-66.2200, -17.3750, -66.1700, -17.3350],
        area_km2=48.783,
        microclimate=MicroclimateProfile(
            ndvi_index=0.36,
            surface_temp_c=28.1,
            heat_island_risk="Moderado",
            tree_canopy_pct=20.0,
            resilience_action="Protección de torrenteras naturales y amortiguamiento contra expansión informal en colinas.",
        ),
    ),
    District(
        id=14,
        name="Distrito 14 - Valle Hermoso",
        zone="Sureste",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4250, longitude=-66.1250),
        bbox=[-66.1450, -17.4500, -66.1050, -17.4000],
        area_km2=6.939,
        microclimate=MicroclimateProfile(
            ndvi_index=0.23,
            surface_temp_c=32.5,
            heat_island_risk="Alto",
            tree_canopy_pct=7.0,
            resilience_action="Parques lineales en quebradas y mitigación de acumulación térmica en serranías este.",
        ),
    ),
    District(
        id=15,
        name="Distrito 15 - K'ara K'ara",
        zone="Sur Periférico",
        has_fixed_sensor=False,
        centroid=Centroid(latitude=-17.4450, longitude=-66.1150),
        bbox=[-66.1350, -17.4700, -66.0950, -17.4200],
        area_km2=21.224,
        microclimate=MicroclimateProfile(
            ndvi_index=0.16,
            surface_temp_c=34.8,
            heat_island_risk="Crítico",
            tree_canopy_pct=3.0,
            resilience_action="Remediación ambiental del vertedero K'ara K'ara y barreras forestales nativas de mitigación.",
        ),
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
                    "heat_island_risk": district.microclimate.heat_island_risk if district and district.microclimate else None,
                    "tree_canopy_pct": district.microclimate.tree_canopy_pct if district and district.microclimate else None,
                    "microclimate": district.microclimate.model_dump() if district and district.microclimate else None,
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
                        "heat_island_risk": d.microclimate.heat_island_risk if d.microclimate else None,
                        "tree_canopy_pct": d.microclimate.tree_canopy_pct if d.microclimate else None,
                        "microclimate": d.microclimate.model_dump() if d.microclimate else None,
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

    def get_district_shapely_geom(self, district_id: int):
        if not hasattr(self, "_shapely_geoms") or self._shapely_geoms is None:
            geojson_path = resolve_geojson_path()
            self._shapely_geoms = {}
            if geojson_path and geojson_path.exists():
                from shapely.geometry import shape
                with open(geojson_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                for feat in raw_data.get("features", []):
                    d_id = int(feat.get("properties", {}).get("distrito", 0))
                    self._shapely_geoms[d_id] = shape(feat["geometry"])
        return self._shapely_geoms.get(district_id)


district_service = DistrictService()
