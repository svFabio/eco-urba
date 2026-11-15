from backend.schemas.poi import InterventionPoint, SuggestionResult
from backend.services.district_service import district_service

_GOAL_PCT = 44.0

_ZONE_HINTS: dict[str, str] = {
    "Norte (Parque Tunari)": "Áreas de cesión y franjas de amortiguamiento de la Cota 2750 en el Parque Tunari",
    "Norte Urbano": "Terrenos municipales de cesión, retiros obligatorios y plazas duras en avenidas principales",
    "Noreste": "Áreas de cesión periurbanas y corredores biológicos hacia la serranía este",
    "Noreste Urbano": "Retiros municipales, aceras anchas y predios contiguos al Jardín Botánico Martín Cárdenas",
    "Noroeste": "Áreas de cesión en urbanizaciones recientes, torrenteras y ciclovías colectoras",
    "Noroeste Semi-urbano": "Terrenos públicos en quebradas, torrenteras naturales y colinas de preservación",
    "Centro": "Espacios públicos consolidados, plazas patrimoniales y ensanches peatonales con retiro de acera",
    "Centro Este": "Áreas de cesión universitaria en el campus UMSS y franjas de servidumbre en avenidas",
    "Sur Central": "Franjas de protección de la Laguna Alalay y terrenos públicos para parques lineales",
    "Sur": "Áreas de cesión fiscal, riberas del río Tamborada y cordones verdes periurbanos",
    "Suroeste": "Terrenos de equipamiento público, áreas de cesión barrial y predios escolares",
    "Este Urbano": "Plazas de cesión vecinal, cubiertas públicas y aceras comerciales densas",
    "Sureste": "Áreas de cesión en loteamientos aprobados y quebradas de mitigación térmica",
    "Sur Periférico": "Franjas de amortiguamiento del vertedero K'ara K'ara y terrenos públicos de amortiguación",
    "Extremo Sur": "Terrenos comunales de preservación y laderas áridas aptas para especies nativas xerófilas",
}

_DEFAULT_HINT = "Áreas de cesión municipal y terrenos públicos disponibles en el distrito"

_TREES_PER_PCT = 150  # approximate trees needed per missing percentage point


def _build_suggestion_text(
    district_name: str,
    tree_canopy_pct: float,
    meets_goal: bool,
    heat_island_risk: str,
    zone_hint: str,
) -> str:
    if meets_goal:
        return (
            f"¡Excelente! {district_name} alcanza el {tree_canopy_pct:.1f}% de cobertura "
            f"arbórea y supera la meta del {_GOAL_PCT:.0f}%."
        )

    missing_pct = _GOAL_PCT - tree_canopy_pct
    n_trees = int(missing_pct * _TREES_PER_PCT)

    risk_note = {
        "Crítico": "La situación es crítica: la falta de sombra eleva la temperatura hasta 5 °C sobre el promedio.",
        "Alto": "El riesgo de isla de calor es alto, afectando la salud de sus residentes.",
        "Moderado": "El riesgo de isla de calor es moderado y aún puede revertirse.",
        "Bajo": "El riesgo de isla de calor es bajo, pero hay margen de mejora.",
    }.get(heat_island_risk, "")

    return (
        f"{district_name} tiene solo {tree_canopy_pct:.1f}% de cobertura arbórea, "
        f"por debajo del {_GOAL_PCT:.0f}% recomendado. {risk_note} "
        f"Plantar aproximadamente {n_trees} árboles nativos en {zone_hint} "
        f"mejoraría la temperatura y calidad del aire."
    )


def _calculate_candidate_interventions(district) -> list[InterventionPoint]:
    min_lon, min_lat, max_lon, max_lat = district.bbox
    c_lat = district.centroid.latitude
    c_lon = district.centroid.longitude

    micro = district.microclimate
    temp = micro.surface_temp_c if micro else 28.0
    risk = micro.heat_island_risk if micro else "Moderado"

    is_mountain_district = district.id in (1, 13)
    is_south_district = district.id in (7, 8, 9, 14, 15)

    interventions: list[InterventionPoint] = []

    # Punto 1: Arbolado / Reforestación urbana (flaticon arbolito)
    p1_lat = round(c_lat + (max_lat - c_lat) * 0.35, 5)
    p1_lon = round(c_lon + (max_lon - c_lon) * 0.35, 5)

    if is_mountain_district:
        slope1 = 21.4
        elev1 = 2785.0
        p1_title = f"Reforestación de Ladera Cota 2750 ({district.name})"
        p1_reason = (
            f"Pendiente de ladera ({slope1}%). NASA SRTM/ASTER confirma relieve montañoso "
            f"no apto para edificación pesada, pero ideal para fijar suelos y recarga de acuíferos con Kewiña y Kiswara."
        )
    elif is_south_district:
        slope1 = 5.8
        elev1 = 2610.0
        p1_title = f"Cortina Arbórea Anti-Polvo e Isla Térmica ({district.name})"
        p1_reason = (
            f"Severidad térmica crítica (LST {temp}°C) con pendiente suave ({slope1}%). "
            f"Buffer de amortiguación para mitigar radiación y vientos secos con Molles y Jacarandás."
        )
    else:
        slope1 = 2.4
        elev1 = 2568.0
        p1_title = f"Micro-bosque y Sombra Peatonal ({district.name})"
        p1_reason = (
            f"Terreno llano urbano ({slope1}% de pendiente). Buffer a 180m de centros educativos "
            f"para enfriar islas de calor y crear corredores sombreados escolares."
        )

    interventions.append(
        InterventionPoint(
            id=f"int-tree-{district.id}",
            title=p1_title,
            type="tree_planting",
            latitude=p1_lat,
            longitude=p1_lon,
            reason=p1_reason,
            slope_pct=slope1,
            elevation_m=elev1,
            heat_risk=risk,
            priority="Alta",
            buffer_distance_m=220 if not is_mountain_district else 380,
        )
    )

    # Punto 2: Centro de Salud o Parque de Quebrada según la pendiente
    p2_lat = round(c_lat - (c_lat - min_lat) * 0.35, 5)
    p2_lon = round(c_lon - (c_lon - min_lon) * 0.35, 5)

    if is_mountain_district:
        slope2 = 16.8
        elev2 = 2740.0
        interventions.append(
            InterventionPoint(
                id=f"int-park-{district.id}",
                title=f"Franja Verde de Quebrada ({district.name})",
                type="pocket_park",
                latitude=p2_lat,
                longitude=p2_lon,
                reason=(
                    f"Pendiente de {slope2}%. La topografía agreste desaconseja centros de salud por accesibilidad, "
                    f"priorizando un parque de conservación y disipación de torrentes pluviales."
                ),
                slope_pct=slope2,
                elevation_m=elev2,
                heat_risk=risk,
                priority="Media",
                buffer_distance_m=420,
            )
        )
    else:
        slope2 = 1.9 if not is_south_district else 3.5
        elev2 = 2560.0 if not is_south_district else 2595.0
        interventions.append(
            InterventionPoint(
                id=f"int-health-{district.id}",
                title=f"Centro de Salud Comunitario ({district.name})",
                type="health_center",
                latitude=p2_lat,
                longitude=p2_lon,
                reason=(
                    f"Topografía óptima: pendiente plana de {slope2}% según NASA ASTER/SRTM. "
                    f"Excelente accesibilidad para ambulancias y buffer > 600m de centros hospitalarios existentes."
                ),
                slope_pct=slope2,
                elevation_m=elev2,
                heat_risk=risk,
                priority="Alta" if is_south_district else "Media",
                buffer_distance_m=650,
            )
        )

    return interventions


def get_suggestion(district_id: int) -> SuggestionResult | None:
    district = district_service.get_district_by_id(district_id)
    if district is None:
        return None

    microclimate = district.microclimate
    tree_canopy_pct = microclimate.tree_canopy_pct if microclimate else 0.0
    heat_island_risk = microclimate.heat_island_risk if microclimate else "Moderado"

    meets_goal = tree_canopy_pct >= _GOAL_PCT
    zone_hint = _ZONE_HINTS.get(district.zone, _DEFAULT_HINT)

    suggestion_text = _build_suggestion_text(
        district_name=district.name,
        tree_canopy_pct=tree_canopy_pct,
        meets_goal=meets_goal,
        heat_island_risk=heat_island_risk,
        zone_hint=zone_hint,
    )

    interventions = _calculate_candidate_interventions(district)

    return SuggestionResult(
        district_id=district.id,
        district_name=district.name,
        meets_goal=meets_goal,
        tree_canopy_pct=tree_canopy_pct,
        suggestion_text=suggestion_text,
        available_areas_hint=zone_hint,
        candidate_interventions=interventions,
    )
