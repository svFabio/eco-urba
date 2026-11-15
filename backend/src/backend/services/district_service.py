import json
from pathlib import Path
from shapely.geometry import shape

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

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DOCS_DIR = Path(__file__).resolve().parents[4] / "docs" / "distritos"

PERIMETER_GEOJSON_FILE = DATA_DIR / "perimetro_cercado.geojson"
PERIMETER_DOCS_FILE = DOCS_DIR / "perimetro_cercado.geojson"
INDICATORS_FILE = DATA_DIR / "cocha360_distritos_indicadores.geojson"


def resolve_geojson_path() -> Path | None:
    for path in [
        DATA_DIR / "distritos_cercado_cochabamba.geojson",
        DOCS_DIR / "distritos_cercado_cochabamba.geojson",
    ]:
        if path.exists():
            return path
    return None


def _load_nasa_indicators() -> dict[int, dict]:
    indicators: dict[int, dict] = {}
    if INDICATORS_FILE.exists():
        try:
            with open(INDICATORS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for feat in data.get("features", []):
                p = feat.get("properties", {})
                d_str = p.get("distrito", "")
                if d_str.startswith("D"):
                    num = int(d_str[1:])
                    indicators[num] = p
        except Exception:
            pass
    return indicators


_DISTRICT_METADATA: dict[int, dict] = {
    1: {"name": "Distrito 1 - Tunari", "zone": "Norte (Parque Tunari)", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Protección estricta de la Cota 2750 y recarga hídrica contra loteamientos."},
    2: {"name": "Distrito 2 - Tunari", "zone": "Norte", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Consolidación de corredores biológicos urbanos hacia la serranía este."},
    3: {"name": "Distrito 3 - Sarco", "zone": "Noroeste", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Incremento de arbolado nativo en aceras, plazas y ciclovías colectoras."},
    4: {"name": "Distrito 4 - Molle", "zone": "Oeste Urbano", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Mitigación de radiación solar en avenidas anchas y plazas duras mediante toldos vivos."},
    5: {"name": "Distrito 5 - Alejo Calatayud", "zone": "Sur Central", "has_fixed_sensor": True, "station_name": "Av. 6 de Agosto (Red MÓNICA)", "resilience_action": "Preservación del espejo de agua de la Laguna Alalay y anillo verde de amortiguamiento."},
    6: {"name": "Distrito 6 - San Antonio", "zone": "Este Urbano", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Implementación de pavimentos permeables y techos verdes en zona comercial densa."},
    7: {"name": "Distrito 7 - Valle Hermoso", "zone": "Sur", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Reforestación perimetral del río Tamborada y barreras verdes periurbanas."},
    8: {"name": "Distrito 8 - Jaihuayco", "zone": "Suroeste", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Plan intensivo de forestación urbana y sombreamiento en paradas y colegios."},
    9: {"name": "Distrito 9 - Itocta", "zone": "Extremo Sur", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Control de erosión en laderas áridas y siembra de especies nativas de bajo consumo hídrico."},
    10: {"name": "Distrito 10 - Centro Histórico", "zone": "Centro", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Urgente reducción de impermeabilización, peatonalización verde y arbolado vertical en calles."},
    11: {"name": "Distrito 11 - Las Cuadras", "zone": "Centro Este", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Ampliación de masa arbórea en campus universitario UMSS y avenidas conectoras."},
    12: {"name": "Distrito 12 - Cala Cala / Queru Queru", "zone": "Norte Urbano", "has_fixed_sensor": True, "station_name": "Av. Circunvalación (Red MÓNICA)", "resilience_action": "Preservación del Jardín Botánico Martín Cárdenas e incentivo a jardines residenciales permeables."},
    13: {"name": "Distrito 13 - Condebamba", "zone": "Noroeste Semi-urbano", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Protección de torrenteras naturales y amortiguamiento contra expansión informal en colinas."},
    14: {"name": "Distrito 14 - Valle Hermoso", "zone": "Sureste", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Parques lineales en quebradas y mitigación de acumulación térmica en serranías este."},
    15: {"name": "Distrito 15 - K'ara K'ara", "zone": "Sur Periférico", "has_fixed_sensor": False, "station_name": None, "resilience_action": "Remediación ambiental del vertedero K'ara K'ara y barreras forestales nativas de mitigación."},
}


def _load_districts() -> list[District]:
    districts: list[District] = []
    geojson_path = resolve_geojson_path()
    nasa_indicators = _load_nasa_indicators()

    if geojson_path and geojson_path.exists():
        with open(geojson_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        for feat in raw_data.get("features", []):
            props = feat.get("properties", {})
            d_id = int(props.get("distrito", 0))
            if d_id not in _DISTRICT_METADATA:
                continue

            geom = shape(feat["geometry"])
            centroid = Centroid(
                latitude=round(geom.centroid.y, 4),
                longitude=round(geom.centroid.x, 4),
            )
            bbox = [round(b, 4) for b in geom.bounds]
            area_km2 = float(props.get("area_km2", 0.0))

            meta = _DISTRICT_METADATA[d_id]
            nasa_p = nasa_indicators.get(d_id, {})

            surface_temp = round(float(nasa_p.get("lst_2025_c", 28.0)), 1)
            ndvi = round(float(nasa_p.get("ndvi_2025", 0.3)), 2)
            hotspot_pct = round(float(nasa_p.get("hotspot_2024_pct_valido", 0.0)), 1)
            hotspot_km2 = round(float(nasa_p.get("hotspot_2024_km2", 0.0)), 3)

            # Clasificación bioclimática objetiva derivada de telemetría NASA
            if hotspot_pct >= 25.0 or surface_temp >= 32.5:
                risk = "Crítico"
            elif hotspot_pct >= 15.0 or surface_temp >= 30.5:
                risk = "Alto"
            elif hotspot_pct >= 5.0 or surface_temp >= 28.0:
                risk = "Moderado"
            else:
                risk = "Bajo"

            canopy = round(max(3.0, min(50.0, (ndvi - 0.12) * 100.0)), 1)

            microclimate = MicroclimateProfile(
                ndvi_index=ndvi,
                surface_temp_c=surface_temp,
                heat_island_risk=risk,
                tree_canopy_pct=canopy,
                resilience_action=meta["resilience_action"],
                hotspot_2024_pct=hotspot_pct,
                hotspot_2024_km2=hotspot_km2,
            )

            districts.append(
                District(
                    id=d_id,
                    name=meta["name"],
                    zone=meta["zone"],
                    has_fixed_sensor=meta["has_fixed_sensor"],
                    station_name=meta["station_name"],
                    centroid=centroid,
                    bbox=bbox,
                    area_km2=area_km2,
                    microclimate=microclimate,
                )
            )

    districts.sort(key=lambda d: d.id)
    return districts


COCHABAMBA_DISTRICTS: list[District] = _load_districts()


class DistrictService:
    def __init__(self) -> None:
        self._cached_geojson: DistrictGeoJSONCollection | None = None
        self._shapely_geoms: dict[int, any] | None = None

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

        if geojson_path and geojson_path.exists():
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
                    "hotspot_2024_pct": district.microclimate.hotspot_2024_pct if district and district.microclimate else None,
                    "hotspot_2024_km2": district.microclimate.hotspot_2024_km2 if district and district.microclimate else None,
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

        # Fallback
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
                        "hotspot_2024_pct": d.microclimate.hotspot_2024_pct if d.microclimate else None,
                        "hotspot_2024_km2": d.microclimate.hotspot_2024_km2 if d.microclimate else None,
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

    def get_cota_2750(self) -> dict:
        return {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-66.2100, -17.3480],
                    [-66.1950, -17.3420],
                    [-66.1800, -17.3360],
                    [-66.1650, -17.3320],
                    [-66.1500, -17.3300],
                    [-66.1350, -17.3350],
                    [-66.1200, -17.3400],
                    [-66.1050, -17.3480],
                    [-66.0900, -17.3550],
                    [-66.0750, -17.3650],
                ],
            },
            "properties": {
                "name": "Línea Cota 2750 m.s.n.m.",
                "description": "Límite ecológico y legal del Parque Nacional Tunari (Ley 1262)",
                "elevation_m": 2750,
            },
        }

    def get_district_shapely_geom(self, district_id: int):
        if self._shapely_geoms is None:
            geojson_path = resolve_geojson_path()
            self._shapely_geoms = {}
            if geojson_path and geojson_path.exists():
                with open(geojson_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                for feat in raw_data.get("features", []):
                    d_id = int(feat.get("properties", {}).get("distrito", 0))
                    self._shapely_geoms[d_id] = shape(feat["geometry"])
        return self._shapely_geoms.get(district_id)


district_service = DistrictService()
