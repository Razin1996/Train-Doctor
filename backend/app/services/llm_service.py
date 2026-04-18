
from backend.app.services.diagnosis_service import _safe_load_findings, get_recommendations
from backend.core.llm_utils import (
    generate_rule_based_explanation,
    generate_ollama_explanation,
    generate_openai_explanation,
    build_llm_prompt,
)


def generate_explanation(run_id: str, backend: str, ollama_url: str | None, ollama_model: str | None, openai_model: str | None):
    findings, train_log, per_image, test_metrics, class_names = _load_findings(run_id)
    recs = get_recommendations(run_id)
    all_findings_df = findings["all_findings_df"]
    improved_recommendation_df = findings["improved_recommendation_df"]
    failure_group_summary = findings["failure_group_summary"]
    health_score = findings["health_score"]
    suggested_config = recs["suggested_config"]

    prompt = build_llm_prompt(
        all_findings_df,
        improved_recommendation_df,
        suggested_config,
        health_score,
        failure_group_summary,
    )

    if backend == "rule_based":
        text = generate_rule_based_explanation(
            all_findings_df,
            improved_recommendation_df,
            health_score,
            failure_group_summary,
        )
        return {"run_id": run_id, "backend": backend, "text": text, "prompt": prompt}

    if backend == "ollama":
        text, error = generate_ollama_explanation(prompt, ollama_model or "llama3.1:8b", ollama_url or "http://localhost:11434")
        return {"run_id": run_id, "backend": backend, "text": text if not error else error, "prompt": prompt}

    text, error = generate_openai_explanation(prompt, openai_model or "gpt-5.4-mini")
    return {"run_id": run_id, "backend": backend, "text": text if not error else error, "prompt": prompt}
