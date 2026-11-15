import json
from pathlib import Path

from backend.schemas.poi import POI, POIType

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_PARKS_AND_GREEN: list[POI] = [
    # Parks & Green Spaces (Iconic Cochabamba Urban Reserves)
    POI(
        id="green-tunari",
        name="Parque Nacional Tunari (Área Protegida)",
        type="green_area",
        sub_type="Reserva Forestal",
        description="Pulmón verde principal de Cochabamba, zona de recarga hídrica sobre la Cota 2750.",
        lat=-17.3380,
        lng=-66.1650,
        district_id=1,
    ),
    POI(
        id="green-botanico",
        name="Jardín Botánico Martín Cárdenas",
        type="green_area",
        sub_type="Jardín Botánico",
        description="Reserva de flora nativa y biodiversidad andina (Distrito 12).",
        lat=-17.3712,
        lng=-66.1486,
        district_id=12,
    ),
    POI(
        id="green-alalay",
        name="Laguna Alalay (Humedal y Anillo Verde)",
        type="green_area",
        sub_type="Humedal y Cinturón Verde",
        description="Humedal urbano y franja de mitigación microclimática (Distritos 5 y 6).",
        lat=-17.4170,
        lng=-66.1360,
        district_id=5,
    ),
    POI(
        id="park-familia",
        name="Parque de la Familia",
        type="park",
        sub_type="Parque Urbano",
        description="Espacio verde y recreativo urbano con circuito de aguas.",
        lat=-17.3872,
        lng=-66.1601,
        district_id=10,
    ),
    POI(
        id="park-bicentenario",
        name="Parque del Bicentenario",
        type="park",
        sub_type="Parque Metropolitano",
        description="Área verde y recreacional del noroeste (Distrito 3).",
        lat=-17.3630,
        lng=-66.1835,
        district_id=3,
    ),
    POI(
        id="green-san-pedro",
        name="Cerro San Pedro (Área de Conservación)",
        type="green_area",
        sub_type="Área Protegida",
        description="Monumento Cristo de la Concordia y franja vegetal este.",
        lat=-17.3845,
        lng=-66.1350,
        district_id=11,
    ),
    POI(
        id="park-santa-cruz",
        name="Parque Metropolitano Mariscal Santa Cruz",
        type="park",
        sub_type="Parque Urbano",
        description="Complejo deportivo y forestado del oeste (Distrito 4 - Molle).",
        lat=-17.3980,
        lng=-66.1770,
        district_id=4,
    ),
    POI(
        id="park-1",
        name="Parque de la Concordia",
        type="park",
        sub_type="Parque Urbano",
        description="Espacio público de recreación y arbolado céntrico.",
        lat=-17.3930,
        lng=-66.1580,
        district_id=10,
    ),
    POI(
        id="park-3",
        name="Plaza de las Banderas",
        type="park",
        sub_type="Paseo Verde",
        description="Paseo peatonal arbolado sobre El Prado cochabambino.",
        lat=-17.3950,
        lng=-66.1570,
        district_id=10,
    ),
    POI(
        id="park-4",
        name="Parque El Mirador",
        type="park",
        sub_type="Mirador Urbano",
        description="Área verde con vista panorámica y preservación de flora.",
        lat=-17.3610,
        lng=-66.1480,
        district_id=12,
    ),
    POI(
        id="park-5",
        name="Parque Kanata",
        type="park",
        sub_type="Parque Urbano",
        description="Centro recreacional y arbolado del norte.",
        lat=-17.3760,
        lng=-66.1390,
        district_id=2,
    ),
]


def _build_pois() -> list[POI]:
    pois: list[POI] = []

    # 1. Real georeferenced schools in Cercado
    schools_file = _DATA_DIR / "schools_cercado.json"
    if schools_file.exists():
        with open(schools_file, "r", encoding="utf-8") as f:
            for item in json.load(f):
                pois.append(POI(**item))

    # 2. Real georeferenced hospitals and health centers in Cercado
    hospitals_file = _DATA_DIR / "hospitals_cercado.json"
    if hospitals_file.exists():
        with open(hospitals_file, "r", encoding="utf-8") as f:
            for item in json.load(f):
                pois.append(POI(**item))

    # 3. Add urban parks and green reserves
    pois.extend(_PARKS_AND_GREEN)
    return pois


_POIS: list[POI] = _build_pois()


def get_pois(poi_type: POIType | None = None) -> list[POI]:
    if poi_type is None:
        return _POIS
    return [p for p in _POIS if p.type == poi_type]

