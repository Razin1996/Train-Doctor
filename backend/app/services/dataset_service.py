
from pathlib import Path

from backend.app.deps import RUNS_DIR
from backend.app.schemas import DatasetPrepareRequest
from backend.core.dataset_utils import prepare_dataset, audit_prepared_dataset


def prepare_dataset_and_audit(run_id: str, request: DatasetPrepareRequest):
    run_root = RUNS_DIR / run_id
    run_root.mkdir(parents=True, exist_ok=True)

    prepared_dir = prepare_dataset(
        output_root=run_root,
        image_dir=request.image_dir,
        annotation_mode=request.annotation_mode,
        mask_dir=request.mask_dir,
        coco_json_path=request.coco_json_path,
        split_seed=request.split_seed,
        train_frac=request.train_frac,
        val_frac=request.val_frac,
        test_frac=request.test_frac,
    )

    class_names = {int(k): v for k, v in request.class_names.items()}
    class_balance_df, split_summary, unique_value_issues_df, empty_masks = audit_prepared_dataset(prepared_dir, class_names)

    class_balance_df.to_csv(run_root / "class_balance.csv", index=False)
    split_summary.to_csv(run_root / "split_summary.csv", index=False)
    unique_value_issues_df.to_csv(run_root / "mask_value_issues.csv", index=False)

    return {
        "run_id": run_id,
        "prepared_dir": str(prepared_dir),
        "class_balance": class_balance_df.to_dict(orient="records"),
        "split_summary": split_summary.to_dict(orient="records"),
        "mask_value_issues": unique_value_issues_df.to_dict(orient="records") if len(unique_value_issues_df) else [],
        "empty_masks": empty_masks,
    }
