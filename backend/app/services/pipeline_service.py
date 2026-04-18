from pathlib import Path
import subprocess
import sys
from datetime import datetime

from backend.app.deps import RUNS_DIR, read_json, write_json


def create_run_id(prefix: str = "run") -> str:
    return f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


def start_pipeline_worker(run_id: str, cfg: dict):
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    cfg_path = run_dir / "pipeline_config.json"
    write_json(cfg_path, cfg)

    write_json(
        run_dir / "pipeline_status.json",
        {
            "stage": "queued",
            "message": "Queued",
            "progress": 0.0,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
    )

    worker_path = Path(__file__).resolve().parents[2] / "core" / "pipeline_worker.py"
    command = [sys.executable, str(worker_path), "--config", str(cfg_path)]
    proc = subprocess.Popen(command, cwd=str(run_dir))

    write_json(
        run_dir / "launcher_info.json",
        {
            "pid": proc.pid,
            "command": command,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
    )

    return {
        "run_id": run_id,
        "pid": proc.pid,
        "run_dir": str(run_dir),
    }


def get_pipeline_status(run_id: str):
    run_dir = RUNS_DIR / run_id
    status = read_json(run_dir / "pipeline_status.json", {})

    extra = {
        k: v
        for k, v in status.items()
        if k not in {"stage", "message", "progress", "updated_at"}
    }

    return {
        "run_id": run_id,
        "stage": status.get("stage", "unknown"),
        "message": status.get("message", "No status available"),
        "progress": status.get("progress"),
        "updated_at": status.get("updated_at"),
        "extra": extra,
    }


def stop_pipeline(run_id: str):
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # cooperative stop signal
    (run_dir / "STOP").write_text("stop", encoding="utf-8")

    # immediately update status so frontend sees the request
    current = read_json(run_dir / "pipeline_status.json", {})
    current["stage"] = "stop_requested"
    current["message"] = "Stop requested. Waiting for worker to stop safely."
    current["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if "progress" not in current:
        current["progress"] = None

    write_json(run_dir / "pipeline_status.json", current)

    return {
        "run_id": run_id,
        "status": "stop_requested",
    }


def list_runs():
    runs = []
    for path in RUNS_DIR.glob("*"):
        if not path.is_dir():
            continue

        status = read_json(path / "pipeline_status.json", {})
        final_summary = read_json(path / "final_summary.json", {})

        updated_at = status.get("updated_at") or ""

        runs.append(
            {
                "run_id": path.name,
                "status": status.get("stage", "unknown"),
                "message": status.get("message"),
                "progress": status.get("progress"),
                "best_output_dir": final_summary.get("best_output_dir"),
                "updated_at": updated_at,
            }
        )

    runs.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return runs


def get_run_summary(run_id: str):
    run_dir = RUNS_DIR / run_id
    status = read_json(run_dir / "pipeline_status.json", {})
    final_summary = read_json(run_dir / "final_summary.json", {})

    return {
        "run_id": run_id,
        "status": status.get("stage", "unknown"),
        "best_output_dir": final_summary.get("best_output_dir"),
        "summary": final_summary,
    }