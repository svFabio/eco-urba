from backend.schemas.poi import SuggestionResult
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

    return SuggestionResult(
        district_id=district.id,
        district_name=district.name,
        meets_goal=meets_goal,
        tree_canopy_pct=tree_canopy_pct,
        suggestion_text=suggestion_text,
        available_areas_hint=zone_hint,
    )
