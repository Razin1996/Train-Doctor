import argparse
from pathlib import Path

from config_utils import read_json, write_json, update_stage, should_stop
from dataset_utils import (
    prepare_dataset,
    audit_prepared_dataset,
    infer_class_names_from_coco,
)
from training_utils import run_training_iteration
from diagnosis_utils import build_findings, generate_next_config


def stop_and_exit(run_dir: Path, message: str, progress=None):
    update_stage(run_dir, "stopped", message, progress=progress)
    return


def run_autopipeline(config_path: str):
    cfg = read_json(Path(config_path))
    run_dir = Path(cfg["run_dir"])
    run_dir.mkdir(parents=True, exist_ok=True)

    provided_class_names = {
        int(k): v for k, v in (cfg.get("class_names") or {}).items()
    }

    if cfg["annotation_mode"] == "COCO JSON" and cfg.get("coco_json_path"):
        inferred = infer_class_names_from_coco(cfg["coco_json_path"])
        class_names = inferred if inferred else provided_class_names
    else:
        class_names = provided_class_names

    if not class_names:
        class_names = {0: "background", 1: "class_1"}

    cfg["class_names"] = {str(k): v for k, v in class_names.items()}
    write_json(run_dir / "pipeline_config.json", cfg)

    try:
        # -----------------------------------
        # Stop before doing anything
        # -----------------------------------
        if should_stop(run_dir):
            return stop_and_exit(
                run_dir,
                "Pipeline stopped by user before dataset preparation.",
                progress=0.0,
            )

        # -----------------------------------
        # Dataset preparation
        # -----------------------------------
        update_stage(
            run_dir,
            "dataset_preparation",
            "Preparing and normalizing dataset",
            progress=0.05,
        )

        prepared_dir = prepare_dataset(
            output_root=run_dir,
            image_dir=cfg["image_dir"],
            annotation_mode=cfg["annotation_mode"],
            mask_dir=cfg.get("mask_dir", ""),
            coco_json_path=cfg.get("coco_json_path", ""),
            split_seed=int(cfg.get("split_seed", 42)),
            train_frac=float(cfg.get("train_frac", 0.7)),
            val_frac=float(cfg.get("val_frac", 0.15)),
            test_frac=float(cfg.get("test_frac", 0.15)),
        )

        if should_stop(run_dir):
            return stop_and_exit(
                run_dir,
                "Pipeline stopped by user after dataset preparation.",
                progress=0.10,
            )

        # -----------------------------------
        # Dataset audit
        # -----------------------------------
        update_stage(
            run_dir,
            "dataset_audit",
            "Auditing prepared dataset",
            progress=0.10,
        )

        class_balance_df, split_summary, unique_value_issues_df, empty_masks = audit_prepared_dataset(
            prepared_dir,
            class_names,
        )

        class_balance_df.to_csv(run_dir / "class_balance.csv", index=False)
        split_summary.to_csv(run_dir / "split_summary.csv", index=False)
        unique_value_issues_df.to_csv(run_dir / "mask_value_issues.csv", index=False)
        write_json(run_dir / "empty_masks.json", {"empty_masks": empty_masks})

        if should_stop(run_dir):
            return stop_and_exit(
                run_dir,
                "Pipeline stopped by user after dataset audit.",
                progress=0.10,
            )

        # -----------------------------------
        # Training config
        # -----------------------------------
        working_cfg = {
            "iteration": 1,
            "model_name": cfg["model_name"],
            "image_size": cfg["image_size"],
            "batch_size": cfg["batch_size"],
            "epochs": cfg["epochs"],
            "learning_rate": cfg["learning_rate"],
            "num_classes": len(class_names),
            "class_names": {str(k): v for k, v in class_names.items()},
            "use_amp": cfg.get("use_amp", True),
            "patience": cfg.get("patience", 5),
            "class_weights": None,
        }

        from config_utils import load_run_outputs

        max_iterations = int(cfg.get("max_iterations", 3))
        target_mean_iou = float(cfg.get("target_mean_iou", 0.80))

        best_score = -1e9
        best_output_dir = None
        iteration_summaries = []

        # -----------------------------------
        # Main iteration loop
        # -----------------------------------
        for iteration in range(1, max_iterations + 1):
            if should_stop(run_dir):
                return stop_and_exit(
                    run_dir,
                    f"Pipeline stopped by user before iteration {iteration}.",
                    progress=None,
                )

            working_cfg["iteration"] = iteration

            output_dir = run_training_iteration(
                run_dir=run_dir,
                prepared_dir=prepared_dir,
                cfg=working_cfg,
                update_stage=update_stage,
                should_stop=should_stop,
            )

            # IMPORTANT:
            # training_utils returns None when stop happened during training/eval
            if output_dir is None:
                return stop_and_exit(
                    run_dir,
                    f"Pipeline stopped by user during iteration {iteration}.",
                    progress=None,
                )

            if should_stop(run_dir):
                return stop_and_exit(
                    run_dir,
                    f"Pipeline stopped by user after iteration {iteration}.",
                    progress=None,
                )

            # -----------------------------------
            # Load outputs from completed iteration
            # -----------------------------------
            train_log, per_image, test_metrics = load_run_outputs(output_dir)
            findings = build_findings(train_log, per_image, class_names, class_balance_df)

            score = float(test_metrics["mean_iou"].iloc[0]) + 0.2 * float(
                test_metrics["mean_dice"].iloc[0]
            )

            summary = {
                "iteration": iteration,
                "output_dir": str(output_dir),
                "mean_iou": float(test_metrics["mean_iou"].iloc[0]),
                "mean_dice": float(test_metrics["mean_dice"].iloc[0]),
                "health_score": findings["health_score"],
                "issues": (
                    findings["improved_diagnosis_df"]["issue"].tolist()
                    if len(findings["improved_diagnosis_df"])
                    else []
                ),
            }
            iteration_summaries.append(summary)

            write_json(
                run_dir / "iteration_summaries.json",
                {"iterations": iteration_summaries},
            )

            if score > best_score:
                best_score = score
                best_output_dir = output_dir

            # early success stop
            if float(test_metrics["mean_iou"].iloc[0]) >= target_mean_iou:
                break

            # -----------------------------------
            # Auto-tuning between iterations
            # -----------------------------------
            if iteration < max_iterations:
                if should_stop(run_dir):
                    return stop_and_exit(
                        run_dir,
                        f"Pipeline stopped by user before auto-tuning after iteration {iteration}.",
                        progress=None,
                    )

                update_stage(
                    run_dir,
                    "auto_tuning",
                    f"Adjusting hyperparameters after iteration {iteration}",
                    progress=0.85,
                )

                next_cfg, notes = generate_next_config(
                    working_cfg,
                    findings["improved_diagnosis_df"],
                    findings["imbalance_df"],
                    findings["label_noise_df"],
                )

                write_json(
                    run_dir / f"autotune_iteration_{iteration}.json",
                    {
                        "before": working_cfg,
                        "after": next_cfg,
                        "notes": notes,
                    },
                )

                # no useful config change and health already good
                if (
                    next_cfg["learning_rate"] == working_cfg["learning_rate"]
                    and next_cfg["epochs"] == working_cfg["epochs"]
                    and findings["health_score"] >= 85
                ):
                    break

                working_cfg = next_cfg

        # -----------------------------------
        # Final stop check before completion
        # -----------------------------------
        if should_stop(run_dir):
            return stop_and_exit(
                run_dir,
                "Pipeline stopped by user before finalization.",
                progress=None,
            )

        # -----------------------------------
        # Completed normally
        # -----------------------------------
        update_stage(
            run_dir,
            "completed",
            "Full pipeline completed",
            progress=1.0,
            extra={
                "best_output_dir": str(best_output_dir) if best_output_dir else None
            },
        )

        write_json(
            run_dir / "final_summary.json",
            {
                "best_output_dir": str(best_output_dir) if best_output_dir else None,
                "iterations": iteration_summaries,
            },
        )

    except Exception as e:
        # Only real errors should be marked failed
        update_stage(run_dir, "failed", f"{type(e).__name__}: {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    run_autopipeline(args.config)