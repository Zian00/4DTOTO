from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import PredictionResponse
from services.predictions import frequency_analysis

router = APIRouter()


@router.get("/", response_model=PredictionResponse)
async def get_predictions(db: AsyncSession = Depends(get_db)):
    result = await frequency_analysis(db)
    return PredictionResponse(
        model=result["model"],
        description=result["description"],
        four_d_prediction=result["four_d_prediction"],
        toto_prediction=result["toto_prediction"],
        data_points=result["data_points"],
        disclaimer=result["disclaimer"],
    )
