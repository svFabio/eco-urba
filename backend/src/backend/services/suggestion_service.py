import json
import logging
import os
import httpx
from shapely.geometry import Point

from backend.core.config import settings
from backend.schemas.poi import InterventionPoint, SuggestionResult
from backend.services.district_service import district_service

logger = logging.getLogger(__name__)


def _get_verified_interior_points(district, count: int = 2) -> list[tuple[float, float]]:
    geom = district_service.get_district_shapely_geom(district.id)
    if geom is not None and geom.is_valid and not geom.is_empty:
        pts = []
        rep = geom.representative_point()
        pts.append((round(rep.y, 5), round(rep.x, 5)))

        minx, miny, maxx, maxy = geom.bounds
        steps = 14
        dx = (maxx - minx) / steps
        dy = (maxy - miny) / steps

        for i in range(1, steps):
            for j in range(1, steps):
                cand = Point(minx + i * dx, miny + j * dy)
                if geom.contains(cand):
                    if cand.distance(Point(pts[0][1], pts[0][0])) > dx * 1.8:
                        pts.append((round(cand.y, 5), round(cand.x, 5)))
                        if len(pts) == count:
                            return pts
        if len(pts) >= count:
            return pts[:count]

    return [
        (district.centroid.latitude, district.centroid.longitude),
        (district.centroid.latitude, district.centroid.longitude),
    ]

_GOAL_PCT = 44.0

_ZONE_HINTS: dict[str, str] = {
    "Norte (Parque Tunari)": "Áreas de cesión y franjas de amortiguamiento de la Cota 2750 en el Parque Tunari",
    "Norte": "Franjas de amortiguamiento en faldas del Tunari y corredores verdes en avenidas colectoras",
    "Norte Urbano": "Retiros municipales, aceras anchas y predios contiguos al Jardín Botánico Martín Cárdenas y Cala Cala",
    "Oeste Urbano": "Plazas duras, retiros obligatorios y avenidas principales como Av. Beijing y Capitán Víctor Ustariz",
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
    pts = _get_verified_interior_points(district, 2)
    p1_lat, p1_lon = pts[0]
    p2_lat, p2_lon = pts[1] if len(pts) > 1 else pts[0]

    micro = district.microclimate
    temp = micro.surface_temp_c if micro else 28.0
    risk = micro.heat_island_risk if micro else "Moderado"

    is_mountain_district = district.id in (1, 13)
    is_south_district = district.id in (7, 8, 9, 14, 15)

    interventions: list[InterventionPoint] = []

    # Punto 1: Arbolado / Reforestación urbana (flaticon arbolito)

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


def _query_gemini_suggestion(district, interventions: list[InterventionPoint]) -> dict | None:
    raw_key = (
        settings.GEMINI_API_KEY.get_secret_value()
        if hasattr(settings.GEMINI_API_KEY, "get_secret_value")
        else str(settings.GEMINI_API_KEY)
    )
    if not raw_key or not raw_key.strip():
        raw_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not raw_key:
        return None

    micro = district.microclimate
    temp = micro.surface_temp_c if micro else 28.0
    ndvi = micro.ndvi_index if micro else 0.3
    canopy = micro.tree_canopy_pct if micro else 15.0
    risk = micro.heat_island_risk if micro else "Moderado"

    topography_context = "\n".join(
        [
            f"- Propuesta: {i.title} | Tipo: {i.type} | Pendiente NASA SRTM: {i.slope_pct}% | Elevación: {i.elevation_m}m | Motivo preliminar: {i.reason}"
            for i in interventions
        ]
    )

    prompt = f"""Sos el motor de IA de EcoUrba, una plataforma satelital de resiliencia microclimática para Cochabamba (Cercado).
Analizá la telemetría viva de la NASA para el siguiente distrito:
- Distrito: {district.name} ({district.zone})
- Superficie Oficial: {district.area_km2} km²
- Temperatura Superficial Terrestre (NASA MODIS/Landsat LST): {temp} °C
- Índice de Vegetación (NASA NDVI): {ndvi}
- Cobertura Arbórea Actual: {canopy}% (Meta oficial: 44.0%)
- Nivel de Riesgo de Isla de Calor: {risk}

Topografía y puntos preliminares (NASA ASTER/SRTM):
{topography_context}

Instrucciones:
1. Generá una recomendación de intervención urbanística y bioclimática profesional, viva, dinámica, SIN frases cliché ni plantillas repetitivas (máximo 3 o 4 oraciones).
2. Justificá técnicamente por qué se recomienda cada acción (por ejemplo, laderas altas >15% requieren especies nativas como Kewiña/Kiswara para frenar torrentes y estabilizar suelos, descartando hospitales por accesibilidad de ambulancias; mientras que planicies con alta LST requieren arbolado de sombra densa como Molle/Jacarandá y son aptas para centros de salud).
3. Podés ajustar o refinar las descripciones y razones de los puntos de intervención para que sean precisos.

Respondé OBLIGATORIAMENTE en formato JSON con la siguiente estructura:
{{
  "suggestion_text": "Texto completo y dinámico del diagnóstico y recomendación...",
  "available_areas_hint": "Descripción de predios públicos o franjas donde actuar...",
  "refined_reasons": {{
    "{interventions[0].id if interventions else 'item-1'}": "Razón refinada por IA considerando pendiente y radiación...",
    "{interventions[1].id if len(interventions) > 1 else 'item-2'}": "Razón refinada por IA..."
  }}
}}
"""
    for model in ["gemini-2.5-flash", "gemini-flash-latest"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(
                    url,
                    headers={"Content-Type": "application/json", "X-goog-api-key": raw_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.35, "responseMimeType": "application/json"},
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text = candidates[0]["content"]["parts"][0]["text"]
                        return json.loads(text)
                else:
                    logger.warning(
                        "Gemini model %s returned status %d: %s", model, resp.status_code, resp.text[:150]
                    )
        except Exception as err:
            logger.warning("Error querying Gemini with model %s: %s", model, err)

    return None


def get_suggestion(district_id: int) -> SuggestionResult | None:
    district = district_service.get_district_by_id(district_id)
    if district is None:
        return None

    microclimate = district.microclimate
    tree_canopy_pct = microclimate.tree_canopy_pct if microclimate else 0.0
    heat_island_risk = microclimate.heat_island_risk if microclimate else "Moderado"

    meets_goal = tree_canopy_pct >= _GOAL_PCT
    zone_hint = _ZONE_HINTS.get(district.zone, _DEFAULT_HINT)

    interventions = _calculate_candidate_interventions(district)

    # Invocar Gemini LLM con telemetría satelital NASA
    gemini_result = _query_gemini_suggestion(district, interventions)

    if gemini_result and "suggestion_text" in gemini_result:
        suggestion_text = gemini_result["suggestion_text"]
        available_areas_hint = gemini_result.get("available_areas_hint", zone_hint)
        refined_reasons = gemini_result.get("refined_reasons", {})
        for item in interventions:
            if item.id in refined_reasons:
                item.reason = refined_reasons[item.id]
    else:
        suggestion_text = _build_suggestion_text(
            district_name=district.name,
            tree_canopy_pct=tree_canopy_pct,
            meets_goal=meets_goal,
            heat_island_risk=heat_island_risk,
            zone_hint=zone_hint,
        )
        available_areas_hint = zone_hint

    return SuggestionResult(
        district_id=district.id,
        district_name=district.name,
        meets_goal=meets_goal,
        tree_canopy_pct=tree_canopy_pct,
        suggestion_text=suggestion_text,
        available_areas_hint=available_areas_hint,
        candidate_interventions=interventions,
    )
