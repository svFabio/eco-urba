from fastapi import APIRouter, HTTPException, status
from backend.schemas.trend import TrendAnalysisResult
from backend.services.trend_service import trend_service

router = APIRouter()


@router.get(
    "/districts/{district_id}/trends",
    response_model=TrendAnalysisResult,
    summary="Get NASA Earth System Trend Detective analysis for a district or Cercado (id=0)",
)
def get_district_trend(district_id: int, start_year: int = 2018):
    if district_id == 0:
        return trend_service.get_cercado_trend(start_year=start_year)
    trend = trend_service.get_district_trend(district_id, start_year=start_year)
    if not trend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"District {district_id} not found",
        )
    return trend
