from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.nasa_appeears import appeears_client

router = APIRouter()


class Coordinate(BaseModel):
    id: str
    latitude: float
    longitude: float


class PointTaskRequest(BaseModel):
    task_name: str = "ECOURBA_POINT_SAMPLE"
    product_prefix: str = "HLSL30_VI"
    layer_name: str = "NDVI"
    coordinates: list[Coordinate]
    start_date: str = "01-01-2024"
    end_date: str = "01-31-2024"


@router.post("/task/point", summary="Submit point extraction task to AppEEARS")
def submit_point_task(req: PointTaskRequest):
    try:
        product, layers = appeears_client.get_product_layers(req.product_prefix)
        matched_layer = next((l for l in layers if l.upper() == req.layer_name.upper()), None)
        if not matched_layer:
            raise HTTPException(
                status_code=400,
                detail=f"Layer '{req.layer_name}' not found for product '{product}'. Available: {layers}",
            )

        coords_dict = [c.model_dump() for c in req.coordinates]
        result = appeears_client.submit_point_task(
            task_name=req.task_name,
            product=product,
            layer=matched_layer,
            coordinates=coords_dict,
            start_date=req.start_date,
            end_date=req.end_date,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}", summary="Get status of AppEEARS extraction task")
def get_task_status(task_id: str):
    try:
        return appeears_client.get_task_status(task_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
