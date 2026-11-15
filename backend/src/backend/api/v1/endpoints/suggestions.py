from fastapi import APIRouter, HTTPException

from backend.schemas.poi import SuggestionResult
from backend.services.suggestion_service import get_suggestion

router = APIRouter()


@router.get("/{district_id}/suggestion", response_model=SuggestionResult)
def district_suggestion(district_id: int, force_refresh: bool = False) -> SuggestionResult:
    result = get_suggestion(district_id, force_refresh=force_refresh)
    if result is None:
        raise HTTPException(status_code=404, detail=f"District {district_id} not found")
    return result
