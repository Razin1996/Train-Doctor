from fastapi import APIRouter
from backend.app.schemas import DatasetPrepareRequest
from backend.app.services.dataset_service import prepare_dataset_and_audit
from backend.app.services.pipeline_service import create_run_id
router = APIRouter(prefix="/dataset", tags=["dataset"])
@router.post("/prepare")
def prepare_dataset(request: DatasetPrepareRequest):
    run_id = create_run_id("dataset")
    return prepare_dataset_and_audit(run_id, request)
@router.post("/audit")
def audit_dataset(request: DatasetPrepareRequest):
    run_id = create_run_id("audit")
    return prepare_dataset_and_audit(run_id, request)