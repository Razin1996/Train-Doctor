import json
import re

from backend.app.services.diagnosis_service import _safe_load_findings, get_recommendations
from backend.core.llm_utils import (
    generate_rule_based_explanation,
    generate_ollama_explanation,
    generate_openai_explanation,
    build_llm_prompt,
)


def _extract_between(text: str, start_marker: str, end_marker: str):
    if not text:
        return ""
    pattern = re.escape(start_marker) + r"(.*?)" + re.escape(end_marker)
    match = re.search(pattern, text, flags=re.DOTALL)
    return match.group(1).strip() if match else ""


def _clean_config(config):
    if not isinstance(config, dict):
        return {}
    cleaned = {}
    for key, value in config.items():
        if value is None:
            continue
        if isinstance(value, dict):
            nested = {k: v for k, v in value.items() if v is not None}
            cleaned[key] = nested
        else:
            cleaned[key] = value
    return cleaned


def _parse_structured_json(text: str):
    raw_json = _extract_between(text, "STRUCTURED_JSON_START", "STRUCTURED_JSON_END")
    if not raw_json:
        return None

    try:
        return json.loads(raw_json)
    except Exception:
        return None


def _parse_analysis_markdown(text: str):
    parsed = _extract_between(text, "ANALYSIS_MARKDOWN_START", "ANALYSIS_MARKDOWN_END")
    return parsed.strip() if parsed else text.strip()


def generate_explanation(
    run_id: str,
    backend: str,
    ollama_url: str | None,
    ollama_model: str | None,
    openai_model: str | None,
    openai_api_key: str | None = None,
    include_class_ids: list[int] | None = None,
):
    loaded, error, artifacts, selected_ids, selected_names = _safe_load_findings(
        run_id,
        include_class_ids=include_class_ids,
    )

    if loaded is None:
        return {
            "run_id": run_id,
            "backend": backend,
            "explanation": "",
            "warning": error,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
            "artifacts": artifacts,
            "suggested_config": {},
            "recommendations": [],
            "notes": [],
        }

    findings = loaded["findings"]
    recs = get_recommendations(run_id, include_class_ids=include_class_ids)

    all_findings_df = findings["all_findings_df"]
    improved_recommendation_df = findings["improved_recommendation_df"]
    failure_group_summary = findings["failure_group_summary"]
    health_score = findings["health_score"]

    fallback_suggested_config = _clean_config(recs.get("suggested_config", {}))
    fallback_recommendations = [
        {"recommendation": row["recommendation"]}
        for _, row in improved_recommendation_df.iterrows()
    ] if len(improved_recommendation_df) else recs.get("recommendations", [])
    fallback_notes = recs.get("notes", [])

    prompt = build_llm_prompt(
        all_findings_df,
        improved_recommendation_df,
        fallback_suggested_config,
        health_score,
        failure_group_summary,
    )

    if backend == "rule_based":
        explanation = generate_rule_based_explanation(
            all_findings_df,
            improved_recommendation_df,
            health_score,
            failure_group_summary,
        )
        return {
            "run_id": run_id,
            "backend": backend,
            "explanation": explanation,
            "warning": None,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
            "artifacts": artifacts,
            "suggested_config": fallback_suggested_config,
            "recommendations": fallback_recommendations,
            "notes": fallback_notes,
        }

    if backend == "ollama":
        raw_text, llm_error = generate_ollama_explanation(
            prompt,
            ollama_model or "llama3.1:8b",
            ollama_url or "http://localhost:11434",
        )
    else:
        raw_text, llm_error = generate_openai_explanation(
            prompt,
            openai_model or "gpt-5.4-mini",
            openai_api_key=openai_api_key,
        )

    if llm_error:
        return {
            "run_id": run_id,
            "backend": backend,
            "explanation": "",
            "warning": llm_error,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
            "artifacts": artifacts,
            "suggested_config": fallback_suggested_config,
            "recommendations": fallback_recommendations,
            "notes": fallback_notes,
        }

    structured = _parse_structured_json(raw_text) or {}
    explanation = _parse_analysis_markdown(raw_text)

    llm_recommendations = [
        {"recommendation": item}
        for item in structured.get("recommended_actions", [])
        if isinstance(item, str) and item.strip()
    ]

    llm_notes = [
        item
        for item in structured.get("notes", [])
        if isinstance(item, str) and item.strip()
    ]

    llm_suggested_config = _clean_config(structured.get("suggested_config", {}))

    return {
        "run_id": run_id,
        "backend": backend,
        "explanation": explanation,
        "warning": None,
        "selected_class_ids": selected_ids,
        "selected_class_names": selected_names,
        "artifacts": artifacts,
        "suggested_config": llm_suggested_config or fallback_suggested_config,
        "recommendations": llm_recommendations or fallback_recommendations,
        "notes": llm_notes or fallback_notes,
    }