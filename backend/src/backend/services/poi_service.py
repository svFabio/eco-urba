from backend.schemas.poi import POI, POIType

_POIS: list[POI] = [
    # Schools
    POI(id="school-1", name="U.E. Simón Bolívar", type="school", lat=-17.3942, lng=-66.1572, district_id=10),
    POI(id="school-2", name="U.E. Mariscal Sucre", type="school", lat=-17.3700, lng=-66.1610, district_id=4),
    POI(id="school-3", name="U.E. Bolivia", type="school", lat=-17.3875, lng=-66.1448, district_id=11),
    POI(id="school-4", name="Colegio La Salle", type="school", lat=-17.3630, lng=-66.1510, district_id=12),
    POI(id="school-5", name="U.E. Ayacucho", type="school", lat=-17.3960, lng=-66.1555, district_id=10),
    # Hospitals
    POI(id="hospital-1", name="Hospital Viedma", type="hospital", lat=-17.3920, lng=-66.1540, district_id=10),
    POI(id="hospital-2", name="Clínica Americana", type="hospital", lat=-17.3715, lng=-66.1590, district_id=4),
    POI(id="hospital-3", name="Hospital del Niño", type="hospital", lat=-17.3948, lng=-66.1562, district_id=10),
    POI(id="hospital-4", name="Hospital Cochabamba", type="hospital", lat=-17.4080, lng=-66.1500, district_id=5),
    POI(id="hospital-5", name="Policlínico Central", type="hospital", lat=-17.3890, lng=-66.1430, district_id=11),
    # Parks
    POI(id="park-1", name="Parque de la Concordia", type="park", lat=-17.3930, lng=-66.1580, district_id=10),
    POI(id="park-2", name="Parque Simón Bolívar", type="park", lat=-17.3690, lng=-66.1620, district_id=4),
    POI(id="park-3", name="Plaza de las Banderas", type="park", lat=-17.3950, lng=-66.1570, district_id=10),
    POI(id="park-4", name="Parque El Mirador", type="park", lat=-17.3610, lng=-66.1480, district_id=12),
    POI(id="park-5", name="Parque Kanata", type="park", lat=-17.3760, lng=-66.1390, district_id=2),
    # Green Areas
    POI(id="green-1", name="Jardín Botánico Martín Cárdenas", type="green_area", lat=-17.3705, lng=-66.1465, district_id=12),
    POI(id="green-2", name="Laguna Alalay - Circuito Verde", type="green_area", lat=-17.4150, lng=-66.1380, district_id=5),
]


def get_pois(poi_type: POIType | None = None) -> list[POI]:
    if poi_type is None:
        return _POIS
    return [p for p in _POIS if p.type == poi_type]
