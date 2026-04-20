from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pandas as pd

from backend.app.deps import read_json, write_json
from backend.app.services.run_service import (
    get_artifact_path,
    get_run_classes,
    inspect_run_artifacts,
    resolve_run_paths,
)


def _safe_read_csv(path: Path | None) -> pd.DataFrame:
    if not path or not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except Exception:
        return pd.DataFrame()


def _clean_dict(data: dict) -> dict:
    cleaned = {}
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, str) and value.strip().lower() == "unknown":
            continue
        if isinstance(value, dict):
            nested = _clean_dict(value)
            if nested:
                cleaned[key] = nested
            continue
        cleaned[key] = value
    return cleaned


def _infer_prediction_mask_files(predictions_dir: Path):
    if not predictions_dir.exists() or not predictions_dir.is_dir():
        return []

    exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
    files = []
    for p in predictions_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts:
            files.append(p)
    return sorted(files)


def _reconstruct_pipeline_config(run_dir: Path, run_id: str):
    existing = read_json(run_dir / "pipeline_config.json", {})
    if existing:
        return {"created": False, "path": str(run_dir / "pipeline_config.json")}

    classes_payload = get_run_classes(run_id)
    classes = {
        str(item["class_id"]): item["class_name"]
        for item in classes_payload["classes"]
    }

    test_metrics = _safe_read_csv(get_artifact_path(run_id, "test_metrics"))
    train_log = _safe_read_csv(get_artifact_path(run_id, "train_log"))

    reconstructed = {
        "reconstructed": True,
        "epochs": int(len(train_log)) if len(train_log) else None,
        "num_test_images": (
            test_metrics.iloc[0].to_dict().get("num_test_images")
            if len(test_metrics)
            else None
        ),
        "class_names": classes if classes else None,
        "notes": [
            "This file was reconstructed from available outputs.",
            "Some original training settings were not available and were omitted."
        ],
    }

    reconstructed = _clean_dict(reconstructed)
    write_json(run_dir / "pipeline_config.json", reconstructed)
    return {"created": True, "path": str(run_dir / "pipeline_config.json")}


def _reconstruct_iteration_summaries(run_dir: Path, run_id: str):
    existing = read_json(run_dir / "iteration_summaries.json", {})
    if existing:
        return {"created": False, "path": str(run_dir / "iteration_summaries.json")}

    test_metrics = _safe_read_csv(get_artifact_path(run_id, "test_metrics"))
    train_log = _safe_read_csv(get_artifact_path(run_id, "train_log"))
    _, source_root, best_output_dir = resolve_run_paths(run_id)

    if len(test_metrics) == 0:
        return {"created": False, "reason": "test_metrics.csv not found"}

    row = test_metrics.iloc[0].to_dict()

    mean_iou = row.get("mean_iou")
    mean_dice = row.get("mean_dice", row.get("dice_mean"))
    best_val_iou = None
    if len(train_log) and "val_iou" in train_log.columns:
        try:
            best_val_iou = float(train_log["val_iou"].max())
        except Exception:
            best_val_iou = None

    payload = {
        "reconstructed": True,
        "iterations": [
            _clean_dict(
                {
                    "iteration": 1,
                    "output_dir": str(best_output_dir) if best_output_dir else str(source_root),
                    "mean_iou": mean_iou,
                    "mean_dice": mean_dice,
                    "best_val_iou": best_val_iou,
                    "issues": [],
                }
            )
        ],
    }

    write_json(run_dir / "iteration_summaries.json", payload)
    return {"created": True, "path": str(run_dir / "iteration_summaries.json")}


def _reconstruct_final_summary(run_dir: Path, run_id: str):
    existing = read_json(run_dir / "final_summary.json", {})
    if existing and existing.get("best_output_dir") is not None:
        return {"created": False, "path": str(run_dir / "final_summary.json")}

    iteration_data = read_json(run_dir / "iteration_summaries.json", {})
    _, source_root, best_output_dir = resolve_run_paths(run_id)

    payload = _clean_dict(
        {
            "reconstructed": True,
            "best_output_dir": str(best_output_dir) if best_output_dir else str(source_root),
            "iterations": iteration_data.get("iterations", []),
        }
    )

    write_json(run_dir / "final_summary.json", payload)
    return {"created": True, "path": str(run_dir / "final_summary.json")}


def _reconstruct_class_balance_from_predictions(run_dir: Path, run_id: str):
    existing_path = run_dir / "class_balance.csv"
    if existing_path.exists():
        return {"created": False, "path": str(existing_path), "mode": "existing"}

    _, _, best_output_dir = resolve_run_paths(run_id)
    if not best_output_dir:
        return {"created": False, "reason": "No best_output_dir found"}

    predictions_dir = best_output_dir / "predictions"
    mask_files = _infer_prediction_mask_files(predictions_dir)
    if not mask_files:
        return {"created": False, "reason": "No prediction mask files found in predictions/"}

    classes_payload = get_run_classes(run_id)
    class_map = {
        int(item["class_id"]): item["class_name"]
        for item in classes_payload["classes"]
    }

    pixel_counter = {cls_id: 0 for cls_id in class_map.keys()}
    image_presence_counter = {cls_id: 0 for cls_id in class_map.keys()}

    valid_masks = 0
    for mask_path in mask_files:
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        if mask is None:
            continue

        valid_masks += 1
        values, counts = np.unique(mask, return_counts=True)
        present = set()

        for v, c in zip(values, counts):
            cls_id = int(v)
            pixel_counter[cls_id] = pixel_counter.get(cls_id, 0) + int(c)
            if cls_id != 0 and c > 0:
                present.add(cls_id)

        for cls_id in present:
            image_presence_counter[cls_id] = image_presence_counter.get(cls_id, 0) + 1

    if valid_masks == 0:
        return {"created": False, "reason": "Prediction mask files could not be read"}

    total_pixels = sum(pixel_counter.values())
    rows = []
    for cls_id, cls_name in sorted(class_map.items(), key=lambda x: x[0]):
        rows.append(
            {
                "class_id": cls_id,
                "class_name": cls_name,
                "pixel_count": pixel_counter.get(cls_id, 0),
                "pixel_fraction": (pixel_counter.get(cls_id, 0) / total_pixels) if total_pixels > 0 else 0,
                "images_present": image_presence_counter.get(cls_id, 0),
                "image_fraction": (image_presence_counter.get(cls_id, 0) / valid_masks) if valid_masks > 0 else 0,
                "source": "reconstructed_from_predictions",
            }
        )

    pd.DataFrame(rows).to_csv(existing_path, index=False)
    return {
        "created": True,
        "path": str(existing_path),
        "mode": "reconstructed_from_predictions",
    }


def reconstruct_missing_artifacts(run_id: str):
    run_dir, _, _ = resolve_run_paths(run_id)

    results = {
        "pipeline_config": _reconstruct_pipeline_config(run_dir, run_id),
        "iteration_summaries": _reconstruct_iteration_summaries(run_dir, run_id),
        "final_summary": _reconstruct_final_summary(run_dir, run_id),
        "class_balance": _reconstruct_class_balance_from_predictions(run_dir, run_id),
        "split_summary": {
            "created": False,
            "reason": "Cannot reconstruct faithfully without original dataset split information.",
        },
        "mask_value_issues": {
            "created": False,
            "reason": "Cannot reconstruct without original ground-truth masks.",
        },
    }

    return {
        "run_id": run_id,
        "reconstruction": results,
        "artifacts_after": inspect_run_artifacts(run_id),
    }