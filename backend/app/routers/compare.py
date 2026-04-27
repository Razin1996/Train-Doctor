from fastapi import APIRouter, HTTPException
from backend.app.deps import RUNS_DIR, read_json
import pandas as pd
from pathlib import Path

router = APIRouter(prefix="/compare", tags=["compare"])


def safe_read_csv(path: Path):
    if not path.exists():
        return None
    try:
        return pd.read_csv(path)
    except Exception:
        return None


def get_run_metrics(run_id: str):
    run_dir = RUNS_DIR / run_id

    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    diagnosis_path = run_dir / "diagnosis.json"
    summary_path = run_dir / "summary.json"
    metrics_path = run_dir / "test_metrics.csv"

    diagnosis = read_json(diagnosis_path) if diagnosis_path.exists() else {}
    summary = read_json(summary_path) if summary_path.exists() else {}

    metrics_df = safe_read_csv(metrics_path)

    mean_iou = None
    mean_dice = None
    num_test_images = None

    if metrics_df is not None and len(metrics_df) > 0:
        row = metrics_df.iloc[0].to_dict()

        iou_cols = [c for c in row.keys() if c.endswith("_iou_mean")]
        dice_cols = [c for c in row.keys() if c.endswith("_dice_mean")]

        if iou_cols:
            vals = [row[c] for c in iou_cols if pd.notna(row[c])]
            mean_iou = float(sum(vals) / len(vals)) if vals else None

        if dice_cols:
            vals = [row[c] for c in dice_cols if pd.notna(row[c])]
            mean_dice = float(sum(vals) / len(vals)) if vals else None

        if "num_test_images" in row and pd.notna(row["num_test_images"]):
            num_test_images = int(row["num_test_images"])

    findings = diagnosis.get("findings", [])
    health_score = diagnosis.get("health_score", None)

    return {
        "run_id": run_id,
        "status": summary.get("status", "unknown"),
        "health_score": health_score,
        "mean_iou": mean_iou,
        "mean_dice": mean_dice,
        "num_test_images": num_test_images,
        "num_findings": len(findings),
        "top_findings": findings[:5],
    }


@router.get("")
def compare_runs(run_a: str, run_b: str):
    a = get_run_metrics(run_a)
    b = get_run_metrics(run_b)

    def delta(key):
        if a.get(key) is None or b.get(key) is None:
            return None
        return round(b[key] - a[key], 4)

    return {
        "run_a": a,
        "run_b": b,
        "delta": {
            "health_score": delta("health_score"),
            "mean_iou": delta("mean_iou"),
            "mean_dice": delta("mean_dice"),
            "num_findings": delta("num_findings"),
        },
        "summary": generate_summary(a, b),
    }


def generate_summary(a, b):
    messages = []

    if a.get("health_score") is not None and b.get("health_score") is not None:
        if b["health_score"] > a["health_score"]:
            messages.append("Health score improved after the second run.")
        elif b["health_score"] < a["health_score"]:
            messages.append("Health score decreased in the second run.")
        else:
            messages.append("Health score remained unchanged.")

    if a.get("mean_iou") is not None and b.get("mean_iou") is not None:
        if b["mean_iou"] > a["mean_iou"]:
            messages.append("Mean IoU improved, suggesting better segmentation quality.")
        elif b["mean_iou"] < a["mean_iou"]:
            messages.append("Mean IoU decreased, suggesting weaker segmentation performance.")

    if a.get("num_findings") is not None and b.get("num_findings") is not None:
        if b["num_findings"] < a["num_findings"]:
            messages.append("The number of diagnostic issues decreased.")
        elif b["num_findings"] > a["num_findings"]:
            messages.append("More diagnostic issues were found in the second run.")

    return " ".join(messages) if messages else "Not enough data available to generate comparison summary."