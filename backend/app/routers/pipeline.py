from fastapi import APIRouter
from backend.app.schemas import FullPipelineStartRequest
from backend.app.services.pipeline_service import create_run_id, start_pipeline_worker, get_pipeline_status, stop_pipeline
router = APIRouter(prefix="/pipeline", tags=["pipeline"])
@router.post("/start")
def start_pipeline(request: FullPipelineStartRequest):
    run_id = create_run_id("autopipeline")
    payload = request.model_dump()
    payload["run_id"] = run_id
    payload["run_dir"] = f"backend/runs/{run_id}"
    return start_pipeline_worker(run_id, payload)
@router.get("/{run_id}/status")
def pipeline_status(run_id: str):
    return get_pipeline_status(run_id)
@router.post("/{run_id}/stop")
def pipeline_stop(run_id: str):
    return stop_pipeline(run_id)