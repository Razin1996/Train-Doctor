from fastapi import APIRouter, Query
from backend.app.services.diagnosis_service import get_diagnosis, get_recommendations, get_failure_groups

router = APIRouter(prefix="/runs/{run_id}", tags=["diagnosis"])


def _parse_include_class_ids(include_class_ids: str | None):
    if not include_class_ids:
        return None
    out = []
    for part in include_class_ids.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(int(part))
        except Exception:
            continue
    return out if out else None


@router.get("/diagnosis")
def diagnosis(run_id: str, include_class_ids: str | None = Query(default=None)):
    return get_diagnosis(run_id, _parse_include_class_ids(include_class_ids))


@router.get("/recommendations")
def recommendations(run_id: str, include_class_ids: str | None = Query(default=None)):
    return get_recommendations(run_id, _parse_include_class_ids(include_class_ids))


@router.get("/failure-groups")
def failure_groups(run_id: str, include_class_ids: str | None = Query(default=None)):
    return get_failure_groups(run_id, _parse_include_class_ids(include_class_ids))