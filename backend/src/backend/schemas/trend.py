from typing import Literal
from pydantic import BaseModel, Field


class TrendPoint(BaseModel):
    year: int
    surface_temp_c: float
    ndvi_index: float
    canopy_pct: float


class TrendAnalysisResult(BaseModel):
    district_id: int
    district_name: str
    sensor_fusion_type: Literal["Estación MÓNICA Calibrada", "Sensado Virtual de IA (NASA Earthdata)"]
    baseline_temp_c: float = Field(description="Temperatura promedio histórica (2018)")
    current_temp_c: float = Field(description="Temperatura actual proyectada (2025)")
    warming_rate_c_per_decade: float = Field(description="Tasa de calentamiento en °C por década")
    ndvi_change_pct: float = Field(description="Variación porcentual de cobertura vegetal")
    p_value: float = Field(description="Significancia estadística del test de tendencia (p < 0.05)")
    is_significant: bool = Field(description="Verdadero si la tendencia supera el ruido estacional")
    divergence_classification: str = Field(description="Clasificación territorial del comportamiento microclimático")
    earth_system_diagnosis: str = Field(description="Diagnóstico técnico comprensible para el ciudadano")
    history: list[TrendPoint] = Field(description="Serie temporal histórica anualizada (2018-2025)")
