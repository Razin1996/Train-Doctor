from fastapi import APIRouter
from backend.app.schemas import ExplanationRequest
from backend.app.services.llm_service import generate_explanation
router = APIRouter(prefix="/runs/{run_id}", tags=["llm"])
@router.post("/explanation")
def explanation(run_id: str, request: ExplanationRequest):
    return generate_explanation(run_id, request.backend, request.ollama_url, request.ollama_model, request.openai_model)