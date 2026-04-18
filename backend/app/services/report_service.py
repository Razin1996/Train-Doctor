
from backend.app.services.diagnosis_service import _load_findings, get_recommendations
from backend.core.report_utils import build_downloadable_report


def get_report_text(run_id: str, backend_name: str = "Rule-based", llm_explanation: str = "No explanation generated yet."):
    findings, train_log, per_image, test_metrics, class_names = _load_findings(run_id)
    recs = get_recommendations(run_id)
    return build_downloadable_report(
        test_metrics_df=test_metrics,
        improved_diagnosis_df=findings["improved_diagnosis_df"],
        recommendation_df=findings["improved_recommendation_df"],
        all_findings_df=findings["all_findings_df"],
        failure_group_df=findings["failure_group_summary"],
        health_score=findings["health_score"],
        backend_name=backend_name,
        suggested_config=recs["suggested_config"],
        llm_explanation=llm_explanation,
    )
