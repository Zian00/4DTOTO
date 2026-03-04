from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import PredictionResponse
from services.predictions import (
    frequency_analysis,
    hot_cold_analysis,
    recency_weighted_frequency,
)

router = APIRouter()


@router.get("", response_model=list[PredictionResponse])
async def get_predictions(db: AsyncSession = Depends(get_db)):
    r1 = await frequency_analysis(db)
    r2 = await hot_cold_analysis(db)
    r3 = await recency_weighted_frequency(db)
    return [PredictionResponse(**r) for r in (r1, r2, r3)]
