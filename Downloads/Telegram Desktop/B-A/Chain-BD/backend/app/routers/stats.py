from fastapi import APIRouter, Path, HTTPException
from typing import List
from app.models import DailyStat
from app.core.database import execute_query
from app.utils.bucketing import get_week_bucket

router = APIRouter()

@router.get("/{chain}/stats/daily", response_model=List[DailyStat])
def get_daily_stats(chain: str, days: int = 7):
    year_month = get_week_bucket().split('-W')[0]
    cql = f"SELECT date, total_tx, unique_wallets FROM daily_stats WHERE year_month = '{year_month}' LIMIT {days};"
    rows = execute_query(chain, cql)
    return [DailyStat(**dict(row)) for row in rows]