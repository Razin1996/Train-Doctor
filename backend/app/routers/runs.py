from fastapi import APIRouter, HTTPException

from backend.app.schemas import ExistingRunImportRequest
from backend.app.services.pipeline_service import list_runs, get_run_summary
from backend.app.services.run_service import (
    get_train_log,
    get_test_metrics,
    get_per_image_metrics,
    get_iteration_summaries,
    get_class_balance,
    inspect_run_artifacts,
    import_existing_run,
    get_run_classes,
)
from backend.app.services.reconstruct_service import reconstruct_missing_artifacts

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("")
def runs_list():
    return {"runs": list_runs()}


@router.post("/import-existing")
def import_existing(request: ExistingRunImportRequest):
    try:
        return import_existing_run(
            directory_path=request.directory_path,
            run_id=request.run_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{run_id}/reconstruct-missing")
def reconstruct_missing(run_id: str):
    try:
        return reconstruct_missing_artifacts(run_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{run_id}/summary")
def run_summary(run_id: str):
    return get_run_summary(run_id)


@router.get("/{run_id}/artifacts")
def run_artifacts(run_id: str):
    return inspect_run_artifacts(run_id)


@router.get("/{run_id}/classes")
def run_classes(run_id: str):
    return get_run_classes(run_id)


@router.get("/{run_id}/class-balance")
def run_class_balance(run_id: str):
    return get_class_balance(run_id)


@router.get("/{run_id}/train-log")
def run_train_log(run_id: str):
    return {"run_id": run_id, "train_log": get_train_log(run_id)}


@router.get("/{run_id}/test-metrics")
def run_test_metrics(run_id: str):
    return {"run_id": run_id, "test_metrics": get_test_metrics(run_id)}


@router.get("/{run_id}/per-image")
def run_per_image(run_id: str):
    return {"run_id": run_id, "per_image_metrics": get_per_image_metrics(run_id)}


@router.get("/{run_id}/iterations")
def run_iterations(run_id: str):
    return get_iteration_summaries(run_id)