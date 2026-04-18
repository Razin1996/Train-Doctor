import pandas as pd

from backend.app.deps import read_json
from backend.app.services.run_service import (
    get_artifact_path,
    inspect_run_artifacts,
    get_run_classes,
)
from backend.core.diagnosis_utils import build_findings, generate_next_config


def _class_names_from_run(run_id: str) -> dict[int, str]:
    classes_payload = get_run_classes(run_id)
    return {
        int(item["class_id"]): str(item["class_name"])
        for item in classes_payload["classes"]
    }


def _normalize_selected_class_ids(run_id: str, include_class_ids: list[int] | None):
    class_names = _class_names_from_run(run_id)
    available = {k for k in class_names.keys() if k != 0}

    if include_class_ids is None:
        return sorted(available)

    if len(include_class_ids) == 0:
        return sorted(available)

    selected = sorted([class_id for class_id in include_class_ids if class_id in available])
    return selected if selected else sorted(available)


def _class_balance_df(run_id: str):
    csv_path = get_artifact_path(run_id, "class_balance")
    if csv_path and csv_path.exists():
        try:
            return pd.read_csv(csv_path)
        except Exception:
            return None
    return None


def _safe_load_findings(run_id: str, include_class_ids: list[int] | None = None):
    artifacts = inspect_run_artifacts(run_id)

    train_log_path = get_artifact_path(run_id, "train_log")
    per_image_path = get_artifact_path(run_id, "per_image_metrics")
    test_metrics_path = get_artifact_path(run_id, "test_metrics")

    if not test_metrics_path:
        return None, "Missing required artifact: test_metrics.csv", artifacts, [], []

    selected_ids = _normalize_selected_class_ids(run_id, include_class_ids)
    class_names = _class_names_from_run(run_id)

    if not train_log_path or not per_image_path:
        return None, "Diagnosis needs train_log.csv and per_image_metrics.csv. Summary metrics can still be shown.", artifacts, selected_ids, [class_names[i] for i in selected_ids]

    try:
        train_log = pd.read_csv(train_log_path)
        per_image = pd.read_csv(per_image_path)
        test_metrics = pd.read_csv(test_metrics_path)
        class_balance_df = _class_balance_df(run_id)
        findings = build_findings(
            train_log,
            per_image,
            class_names,
            class_balance_df,
            active_class_ids=selected_ids,
        )
        return {
            "findings": findings,
            "train_log": train_log,
            "per_image": per_image,
            "test_metrics": test_metrics,
            "class_names": class_names,
        }, None, artifacts, selected_ids, findings["selected_class_names"]
    except Exception as exc:
        return None, f"Could not build diagnosis: {exc}", artifacts, selected_ids, [class_names[i] for i in selected_ids]


def get_diagnosis(run_id: str, include_class_ids: list[int] | None = None):
    loaded, error, artifacts, selected_ids, selected_names = _safe_load_findings(run_id, include_class_ids)
    if loaded is None:
        return {
            "run_id": run_id,
            "health_score": 0,
            "findings": [],
            "label_noise": [],
            "imbalance": [],
            "warning": error,
            "artifacts": artifacts,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
        }

    findings = loaded["findings"]
    return {
        "run_id": run_id,
        "health_score": findings["health_score"],
        "findings": findings["all_findings_df"].to_dict(orient="records") if len(findings["all_findings_df"]) else [],
        "label_noise": findings["label_noise_df"].to_dict(orient="records") if len(findings["label_noise_df"]) else [],
        "imbalance": findings["imbalance_df"].to_dict(orient="records") if len(findings["imbalance_df"]) else [],
        "warning": None,
        "artifacts": artifacts,
        "selected_class_ids": selected_ids,
        "selected_class_names": selected_names,
    }


def get_recommendations(run_id: str, include_class_ids: list[int] | None = None):
    loaded, error, artifacts, selected_ids, selected_names = _safe_load_findings(run_id, include_class_ids)
    if loaded is None:
        return {
            "run_id": run_id,
            "recommendations": [],
            "suggested_config": {},
            "notes": [error] if error else [],
            "warning": error,
            "artifacts": artifacts,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
        }

    findings = loaded["findings"]
    class_names = loaded["class_names"]

    run_cfg_path = get_artifact_path(run_id, "pipeline_config")
    run_cfg = read_json(run_cfg_path, {}) if run_cfg_path else {}

    current_config = {
        "model_name": run_cfg.get("model_name", "unet"),
        "num_classes": len(class_names),
        "image_size": run_cfg.get("image_size", 512),
        "batch_size": run_cfg.get("batch_size", 4),
        "epochs": run_cfg.get("epochs", 15),
        "learning_rate": run_cfg.get("learning_rate", 1e-4),
        "optimizer": "AdamW",
        "loss": "CrossEntropyLoss",
        "augmentation": {
            "horizontal_flip": True,
            "vertical_flip": True,
            "rotation": False,
            "brightness_contrast": False,
        },
        "class_weights": None,
        "analysis_class_names": selected_names,
    }

    suggested_config, notes = generate_next_config(
        current_config,
        findings["improved_diagnosis_df"],
        findings["imbalance_df"],
        findings["label_noise_df"],
    )

    return {
        "run_id": run_id,
        "recommendations": findings["improved_recommendation_df"].to_dict(orient="records") if len(findings["improved_recommendation_df"]) else [],
        "suggested_config": suggested_config,
        "notes": notes,
        "warning": None,
        "artifacts": artifacts,
        "selected_class_ids": selected_ids,
        "selected_class_names": selected_names,
    }


def get_failure_groups(run_id: str, include_class_ids: list[int] | None = None):
    loaded, error, artifacts, selected_ids, selected_names = _safe_load_findings(run_id, include_class_ids)
    if loaded is None:
        return {
            "run_id": run_id,
            "failure_groups": [],
            "worst_images": [],
            "warning": error,
            "artifacts": artifacts,
            "selected_class_ids": selected_ids,
            "selected_class_names": selected_names,
        }

    findings = loaded["findings"]
    return {
        "run_id": run_id,
        "failure_groups": findings["failure_group_summary"].to_dict(orient="records") if len(findings["failure_group_summary"]) else [],
        "worst_images": findings["worst_images_df"][["image_name", "mean_iou", "mean_dice", "failure_type"]].to_dict(orient="records") if len(findings["worst_images_df"]) else [],
        "warning": None,
        "artifacts": artifacts,
        "selected_class_ids": selected_ids,
        "selected_class_names": selected_names,
    }