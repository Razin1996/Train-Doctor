import json
from datetime import datetime


def build_downloadable_report(
    test_metrics_df,
    improved_diagnosis_df,
    recommendation_df,
    all_findings_df,
    failure_group_df,
    health_score,
    backend_name,
    suggested_config=None,
    llm_explanation="No explanation generated yet.",
):
    lines = []
    lines.append("SAM3-TrainDoctor Report")
    lines.append("=" * 60)
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append(f"Dataset Health Score: {health_score}/100")
    lines.append("")
    lines.append("Overall Test Metrics")
    lines.append("-" * 25)
    lines.append(test_metrics_df.to_string(index=False))
    lines.append("")
    lines.append("Diagnosis")
    lines.append("-" * 25)
    if len(improved_diagnosis_df) == 0:
        lines.append("No major diagnosis findings.")
    else:
        for _, row in improved_diagnosis_df.iterrows():
            lines.append(f"- {row['issue']} [{row['confidence']}]")
            lines.append(f"  Evidence: {row['evidence']}")
    lines.append("")
    lines.append("Top Failure Types")
    lines.append("-" * 25)
    lines.append(failure_group_df.to_string(index=False) if len(failure_group_df) else "No grouped failures.")
    lines.append("")
    lines.append("Recommendations")
    lines.append("-" * 25)
    for _, row in recommendation_df.iterrows():
        lines.append(f"- {row['recommendation']}")
    lines.append("")
    lines.append(f"Explanation Backend: {backend_name}")
    lines.append("")
    lines.append("Generated Explanation")
    lines.append("-" * 25)
    lines.append(llm_explanation)
    lines.append("")
    lines.append("Suggested Next Config")
    lines.append("-" * 25)
    lines.append(json.dumps(suggested_config, indent=2) if suggested_config is not None else "No config suggestion.")
    return "\n".join(lines)
