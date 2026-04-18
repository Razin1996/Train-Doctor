from fastapi import APIRouter, Query
from backend.app.services.run_service import get_test_metrics
router = APIRouter(prefix="/compare", tags=["compare"])
@router.get("")
def compare_runs(run_a: str = Query(...), run_b: str = Query(...)):
    return {"run_a": run_a, "run_b": run_b, "metrics_a": get_test_metrics(run_a), "metrics_b": get_test_metrics(run_b)}