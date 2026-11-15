from pathlib import Path
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse

router = APIRouter()

RASTERS_DIR = Path(__file__).resolve().parents[5] / "data" / "rasters"
DEFAULT_BOUNDS = [
    [-17.547539808818485, -66.29457894571759],
    [-17.264661664569346, -66.05274190721205],
]
HOTSPOTS_BOUNDS = [
    [-17.535737717665434, -66.28312707797097],
    [-17.276771630866786, -66.06619722598597],
]

RASTER_METADATA = {
    "ndvi_2016": {
        "title": "Vegetación (NDVI) 2016",
        "variable": "ndvi",
        "year": 2016,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": -0.10, "max": 0.75, "unit": "NDVI", "palette": "árido a denso"},
        "mean_val": 0.2395,
    },
    "lst_2016": {
        "title": "Temperatura Superficial (LST) 2016",
        "variable": "lst",
        "year": 2016,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": 15.0, "max": 40.0, "unit": "°C", "palette": "fresco a crítico"},
        "mean_val": 29.43,
    },
    "ndvi_2020": {
        "title": "Vegetación (NDVI) 2020",
        "variable": "ndvi",
        "year": 2020,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": -0.10, "max": 0.75, "unit": "NDVI", "palette": "árido a denso"},
        "mean_val": 0.2563,
    },
    "lst_2020": {
        "title": "Temperatura Superficial (LST) 2020",
        "variable": "lst",
        "year": 2020,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": 15.0, "max": 40.0, "unit": "°C", "palette": "fresco a crítico"},
        "mean_val": 26.82,
    },
    "ndvi_2025": {
        "title": "Vegetación (NDVI) 2025",
        "variable": "ndvi",
        "year": 2025,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": -0.10, "max": 0.75, "unit": "NDVI", "palette": "árido a denso"},
        "mean_val": 0.2773,
    },
    "lst_2025": {
        "title": "Temperatura Superficial (LST) 2025",
        "variable": "lst",
        "year": 2025,
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": 15.0, "max": 40.0, "unit": "°C", "palette": "fresco a crítico"},
        "mean_val": 26.10,
    },
    "delta_ndvi": {
        "title": "Cambio de Vegetación (2016 → 2025)",
        "variable": "delta_ndvi",
        "year": "2016-2025",
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": -0.25, "max": 0.25, "unit": "Δ NDVI", "palette": "rojo (pérdida) a verde (ganancia)"},
        "description": "Diferencial de cobertura vegetal píxel a píxel calculado por la NASA.",
    },
    "delta_lst": {
        "title": "Cambio Térmico (2016 → 2025)",
        "variable": "delta_lst",
        "year": "2016-2025",
        "bounds": DEFAULT_BOUNDS,
        "legend": {"min": -7.0, "max": 7.0, "unit": "Δ °C", "palette": "azul (enfriamiento) a púrpura (calentamiento)"},
        "description": "Diferencial de temperatura superficial píxel a píxel.",
    },
    "hotspots_2024": {
        "title": "Hotspots Térmicos Críticos 2024",
        "variable": "hotspots",
        "year": 2024,
        "bounds": HOTSPOTS_BOUNDS,
        "legend": {"unit": "Hotspot", "palette": "anomalía térmica severa con bajo dosel"},
        "description": "Píxeles con estrés térmico crítico medidos por Landsat y MODIS.",
    },
}


@router.get("/catalog", summary="List available NASA satellite raster layers")
def get_raster_catalog():
    """Return catalog of georeferenced satellite rasters available for display."""
    layers = []
    for rid, meta in RASTER_METADATA.items():
        layers.append({
            "id": rid,
            "url": f"/api/v1/rasters/{rid}.png",
            **meta,
        })
    return {
        "layers": layers,
        "years": [2016, 2020, 2025],
        "variables": ["ndvi", "lst", "delta_ndvi", "delta_lst", "hotspots"],
    }


@router.get("/{raster_id}.png", summary="Serve georeferenced raster image PNG")
def get_raster_image(raster_id: str):
    """Serve satellite PNG with high cache duration for fast tile/overlay rendering."""
    if raster_id not in RASTER_METADATA:
        raise HTTPException(status_code=404, detail="Raster layer not found")

    file_path = RASTERS_DIR / f"{raster_id}.png"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Raster file not present on disk")

    return FileResponse(
        path=str(file_path),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )
