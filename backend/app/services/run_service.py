from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re

import pandas as pd

from backend.app.deps import RUNS_DIR, read_json, write_json


def _read_csv_records(path: Path | None):
    if not path or not path.exists():
        return []
    try:
        return pd.read_csv(path).to_dict(orient="records")
    except Exception:
        return []


def _read_csv_df(path: Path | None) -> pd.DataFrame:
    if not path or not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except Exception:
        return pd.DataFrame()


def _looks_like_output_dir(path: Path):
    if not path.exists() or not path.is_dir():
        return False
    return any(
        (path / name).exists()
        for name in ["train_log.csv", "test_metrics.csv", "per_image_metrics.csv"]
    )


def _pick_latest_output_dir(root: Path) -> Path | None:
    if not root.exists() or not root.is_dir():
        return None

    candidates = []
    for child in root.iterdir():
        if child.is_dir() and child.name.startswith("outputs_iter_"):
            candidates.append(child)

    if not candidates:
        return None

    def sort_key(p: Path):
        match = re.search(r"outputs_iter_(\d+)", p.name)
        return int(match.group(1)) if match else -1

    return sorted(candidates, key=sort_key)[-1]


def _normalize_path(value: str | None) -> Path | None:
    if not value:
        return None
    try:
        return Path(value).expanduser().resolve()
    except Exception:
        return None


def resolve_run_paths(run_id: str):
    run_dir = RUNS_DIR / run_id
    imported_meta = read_json(run_dir / "imported_source.json", {})

    source_root = _normalize_path(imported_meta.get("source_root"))
    best_output_dir = None

    final_summary = read_json(run_dir / "final_summary.json", {})
    best_output_from_summary = _normalize_path(final_summary.get("best_output_dir"))
    if best_output_from_summary and best_output_from_summary.exists():
        best_output_dir = best_output_from_summary

    if source_root is None:
        source_root = run_dir

    if best_output_dir is None:
        if _looks_like_output_dir(source_root):
            best_output_dir = source_root
        else:
            best_output_dir = _pick_latest_output_dir(source_root)

    if best_output_dir is None:
        if _looks_like_output_dir(run_dir):
            best_output_dir = run_dir
        else:
            best_output_dir = _pick_latest_output_dir(run_dir)

    return run_dir, source_root, best_output_dir


def _candidate_paths(run_id: str, artifact_name: str):
    run_dir, source_root, best_output_dir = resolve_run_paths(run_id)

    candidates: list[Path] = []

    if artifact_name == "class_balance":
        candidates.extend(
            [
                run_dir / "class_balance.csv",
                source_root / "class_balance.csv",
            ]
        )
        if best_output_dir:
            candidates.extend(
                [
                    best_output_dir / "class_balance.csv",
                    best_output_dir.parent / "class_balance.csv",
                ]
            )

    elif artifact_name == "split_summary":
        candidates.extend(
            [
                run_dir / "split_summary.csv",
                source_root / "split_summary.csv",
            ]
        )

    elif artifact_name == "mask_value_issues":
        candidates.extend(
            [
                run_dir / "mask_value_issues.csv",
                source_root / "mask_value_issues.csv",
            ]
        )

    elif artifact_name == "train_log":
        if best_output_dir:
            candidates.append(best_output_dir / "train_log.csv")
        candidates.extend(
            [
                run_dir / "train_log.csv",
                source_root / "train_log.csv",
            ]
        )

    elif artifact_name == "test_metrics":
        if best_output_dir:
            candidates.append(best_output_dir / "test_metrics.csv")
        candidates.extend(
            [
                run_dir / "test_metrics.csv",
                source_root / "test_metrics.csv",
            ]
        )

    elif artifact_name == "per_image_metrics":
        if best_output_dir:
            candidates.append(best_output_dir / "per_image_metrics.csv")
        candidates.extend(
            [
                run_dir / "per_image_metrics.csv",
                source_root / "per_image_metrics.csv",
            ]
        )

    elif artifact_name == "iteration_summaries":
        candidates.extend(
            [
                run_dir / "iteration_summaries.json",
                source_root / "iteration_summaries.json",
            ]
        )

    elif artifact_name == "pipeline_config":
        candidates.extend(
            [
                run_dir / "pipeline_config.json",
                source_root / "pipeline_config.json",
            ]
        )

    elif artifact_name == "final_summary":
        candidates.extend(
            [
                run_dir / "final_summary.json",
                source_root / "final_summary.json",
            ]
        )

    return candidates


def get_artifact_path(run_id: str, artifact_name: str) -> Path | None:
    seen = set()
    for candidate in _candidate_paths(run_id, artifact_name):
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists():
            return candidate
    return None


def inspect_run_artifacts(run_id: str):
    run_dir, source_root, best_output_dir = resolve_run_paths(run_id)

    available = {
        "class_balance": str(get_artifact_path(run_id, "class_balance") or ""),
        "train_log": str(get_artifact_path(run_id, "train_log") or ""),
        "test_metrics": str(get_artifact_path(run_id, "test_metrics") or ""),
        "per_image_metrics": str(get_artifact_path(run_id, "per_image_metrics") or ""),
        "split_summary": str(get_artifact_path(run_id, "split_summary") or ""),
        "mask_value_issues": str(get_artifact_path(run_id, "mask_value_issues") or ""),
        "pipeline_config": str(get_artifact_path(run_id, "pipeline_config") or ""),
        "iteration_summaries": str(get_artifact_path(run_id, "iteration_summaries") or ""),
        "final_summary": str(get_artifact_path(run_id, "final_summary") or ""),
    }

    required = ["test_metrics"]
    optional = [
        "class_balance",
        "train_log",
        "per_image_metrics",
        "split_summary",
        "mask_value_issues",
        "pipeline_config",
        "iteration_summaries",
        "final_summary",
    ]

    missing_required = [name for name in required if not available[name]]
    missing_optional = [name for name in optional if not available[name]]

    return {
        "run_id": run_id,
        "source_root": str(source_root),
        "best_output_dir": str(best_output_dir) if best_output_dir else None,
        "available": available,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
    }


def _infer_classes_from_pipeline_config(run_id: str):
    cfg_path = get_artifact_path(run_id, "pipeline_config")
    cfg = read_json(cfg_path, {}) if cfg_path else {}
    class_names = cfg.get("class_names", {})
    parsed = {}
    for k, v in class_names.items():
        try:
            parsed[int(k)] = str(v)
        except Exception:
            continue
    return parsed


def _infer_classes_from_class_balance(run_id: str):
    df = _read_csv_df(get_artifact_path(run_id, "class_balance"))
    if len(df) == 0 or "class_id" not in df.columns or "class_name" not in df.columns:
        return {}
    out = {}
    for _, row in df.iterrows():
        try:
            out[int(row["class_id"])] = str(row["class_name"])
        except Exception:
            continue
    return out


def _infer_classes_from_test_metrics(run_id: str):
    df = _read_csv_df(get_artifact_path(run_id, "test_metrics"))
    if len(df) == 0:
        return {}

    cols = list(df.columns)
    out = {}
    for col in cols:
        if col.endswith("_iou_mean"):
            name = col.replace("_iou_mean", "")
            if name == "mean":
                continue
            if name == "background":
                out[0] = "background"

    next_idx = 1
    for col in cols:
        if col.endswith("_iou_mean"):
            name = col.replace("_iou_mean", "")
            if name in {"mean", "background"}:
                continue
            out[next_idx] = name
            next_idx += 1

    if 0 not in out:
        out[0] = "background"
    return out


def get_run_classes(run_id: str):
    classes = _infer_classes_from_pipeline_config(run_id)
    source = "pipeline_config"

    if not classes:
        classes = _infer_classes_from_class_balance(run_id)
        source = "class_balance"

    if not classes:
        classes = _infer_classes_from_test_metrics(run_id)
        source = "test_metrics"

    if not classes:
        classes = {0: "background", 1: "class_1"}
        source = "fallback"

    return {
        "run_id": run_id,
        "source": source,
        "classes": [
            {"class_id": class_id, "class_name": class_name}
            for class_id, class_name in sorted(classes.items(), key=lambda x: x[0])
        ],
    }


def best_output_dir_for_run(run_id: str) -> Path:
    _, _, best_output_dir = resolve_run_paths(run_id)
    if best_output_dir:
        return best_output_dir
    raise FileNotFoundError(f"No output directory found for {run_id}")


def get_train_log(run_id: str):
    return _read_csv_records(get_artifact_path(run_id, "train_log"))


def get_test_metrics(run_id: str):
    return _read_csv_records(get_artifact_path(run_id, "test_metrics"))


def get_per_image_metrics(run_id: str):
    return _read_csv_records(get_artifact_path(run_id, "per_image_metrics"))


def get_class_balance(run_id: str):
    path = get_artifact_path(run_id, "class_balance")
    df = _read_csv_df(path)

    if len(df) == 0:
        return {
            "run_id": run_id,
            "class_balance": [],
            "missing": True,
            "path": None,
        }

    if "class_name" not in df.columns and "class_id" in df.columns:
        inferred = _infer_classes_from_pipeline_config(run_id)
        if inferred:
            df["class_name"] = df["class_id"].astype(int).map(inferred)

    return {
        "run_id": run_id,
        "class_balance": df.to_dict(orient="records"),
        "missing": False,
        "path": str(path),
    }


def get_iteration_summaries(run_id: str):
    path = get_artifact_path(run_id, "iteration_summaries")
    if not path:
        return {"iterations": []}
    return read_json(path, {"iterations": []})


def import_existing_run(directory_path: str, run_id: str | None = None):
    source = Path(directory_path).expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(f"Directory does not exist: {source}")
    if not source.is_dir():
        raise NotADirectoryError(f"Path is not a directory: {source}")

    if run_id is None or not run_id.strip():
        run_id = f"imported_{source.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    if _looks_like_output_dir(source):
        source_root = source.parent
        best_output_dir = source
    else:
        source_root = source
        best_output_dir = _pick_latest_output_dir(source_root)
        if best_output_dir is None and _looks_like_output_dir(source_root):
            best_output_dir = source_root

    pipeline_cfg_src = source_root / "pipeline_config.json"
    final_summary_src = source_root / "final_summary.json"

    imported_meta = {
        "source_root": str(source_root),
        "imported_from": str(source),
        "imported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    write_json(run_dir / "imported_source.json", imported_meta)

    write_json(
        run_dir / "pipeline_status.json",
        {
            "stage": "imported",
            "message": "Imported external results directory.",
            "progress": None,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
    )

    final_summary = read_json(final_summary_src, {})
    final_summary["best_output_dir"] = str(best_output_dir) if best_output_dir else None
    final_summary["source_root"] = str(source_root)
    write_json(run_dir / "final_summary.json", final_summary)

    if pipeline_cfg_src.exists():
        write_json(run_dir / "pipeline_config.json", read_json(pipeline_cfg_src, {}))

    artifacts = inspect_run_artifacts(run_id)

    return {
        "run_id": run_id,
        "status": "imported",
        "source_root": str(source_root),
        "best_output_dir": str(best_output_dir) if best_output_dir else None,
        "artifacts": artifacts,
        "classes": get_run_classes(run_id),
    }