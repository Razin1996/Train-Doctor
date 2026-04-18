import json
from datetime import datetime
from pathlib import Path


def write_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def read_json(path: Path, default=None):
    if not path.exists():
        return {} if default is None else default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {} if default is None else default


def timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def update_stage(run_dir: Path, stage: str, message: str, progress: float | None = None, extra: dict | None = None):
    payload = {
        "stage": stage,
        "message": message,
        "progress": progress,
        "updated_at": timestamp(),
    }
    if extra:
        payload.update(extra)
    write_json(run_dir / "pipeline_status.json", payload)


def should_stop(run_dir: Path) -> bool:
    return (run_dir / "STOP").exists()


def clear_stop(run_dir: Path):
    stop = run_dir / "STOP"
    if stop.exists():
        stop.unlink()


def load_run_outputs(output_dir: Path):
    import pandas as pd
    train_log = pd.read_csv(output_dir / "train_log.csv")
    per_image = pd.read_csv(output_dir / "per_image_metrics.csv")
    test_metrics = pd.read_csv(output_dir / "test_metrics.csv")
    return train_log, per_image, test_metrics
