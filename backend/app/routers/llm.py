from fastapi import APIRouter
from backend.app.schemas import ExplanationRequest
from backend.app.services.llm_service import generate_explanation

router = APIRouter(prefix="/runs/{run_id}", tags=["llm"])


@router.post("/explanation")
def explanation(run_id: str, request: ExplanationRequest):
    return generate_explanation(
        run_id=run_id,
        backend=request.backend,
        ollama_url=request.ollama_url,
        ollama_model=request.ollama_model,
        openai_model=request.openai_model,
        openai_api_key=request.openai_api_key,
        include_class_ids=request.include_class_ids,
    )