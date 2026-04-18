import json
import html
from pathlib import Path

import cv2
import numpy as np
import pandas as pd


def confidence_from_score(score: float) -> str:
    if score >= 0.80:
        return "High"
    if score >= 0.50:
        return "Medium"
    return "Low"


def confidence_badge(confidence: str) -> str:
    colors = {"High": "#2e7d32", "Medium": "#f9a825", "Low": "#d32f2f"}
    color = colors.get(confidence, "#616161")
    return (
        f'<span style="background-color:{color}; color:white; padding:4px 10px; '
        f'border-radius:12px; font-size:12px; font-weight:600; white-space:nowrap;">'
        f'{html.escape(confidence)}</span>'
    )


def confidence_border_color(confidence: str) -> str:
    return {"High": "#2e7d32", "Medium": "#f9a825", "Low": "#d32f2f"}.get(confidence, "#616161")


def find_image_path(stem: str, image_dir: Path):
    for ext in [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"]:
        candidate = image_dir / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    return None


def colorize_mask(mask):
    unique_classes = np.unique(mask)
    rng = np.random.default_rng(42)

    color_map = {
        int(cls): rng.integers(0, 255, size=3).tolist()
        for cls in unique_classes
    }

    out = np.zeros((mask.shape[0], mask.shape[1], 3), dtype=np.uint8)
    for cls_id, color in color_map.items():
        out[mask == cls_id] = color

    return out


def _selected_class_map(class_names, active_class_ids=None):
    if active_class_ids is None or len(active_class_ids) == 0:
        return {k: v for k, v in class_names.items() if k != 0}
    return {k: v for k, v in class_names.items() if k in set(active_class_ids) and k != 0}


def _selected_metric_values(row, selected_classes, metric_name):
    values = []
    for _, class_name in selected_classes.items():
        col = f"{class_name}_{metric_name}"
        if col in row.index and pd.notna(row[col]):
            values.append(float(row[col]))
    return values


def _selected_mean_for_row(row, selected_classes, metric_name, fallback_col):
    values = _selected_metric_values(row, selected_classes, metric_name)
    if values:
        return float(np.mean(values))
    fallback = row.get(fallback_col, np.nan)
    return float(fallback) if pd.notna(fallback) else np.nan


def classify_failure_type(row, selected_classes):
    selected_names = [name.lower() for name in selected_classes.values()]
    reasons = []

    mean_iou = row.get("selected_mean_iou", np.nan)

    # Generic behavior instead of hardcoding semantic classes
    class_names_lower = [v.lower() for v in selected_classes.values()]

    # Optional: soft heuristics instead of strict names
    water_name = next((v for v in selected_classes.values() if "water" in v.lower()), None)
    sky_name = next((v for v in selected_classes.values() if "sky" in v.lower()), None)
    snow_name = next((v for v in selected_classes.values() if "snow" in v.lower()), None)

    if mean_iou < 0.20:
        total_fp_fn = 0
        for _, cname in selected_classes.items():
            total_fp_fn += row.get(f"{cname}_fp", 0) + row.get(f"{cname}_fn", 0)
        if total_fp_fn > 5000:
            reasons.append("possible annotation noise")

    if snow_name:
        snow_iou = row.get(f"{snow_name}_iou", np.nan)
        if pd.notna(snow_iou) and snow_iou < 0.20:
            reasons.append("snow confusion")

    if water_name and sky_name:
        water_iou = row.get(f"{water_name}_iou", np.nan)
        sky_iou = row.get(f"{sky_name}_iou", np.nan)
        if pd.notna(water_iou) and pd.notna(sky_iou) and water_iou < 0.35 and sky_iou < 0.35:
            reasons.append("sky-water confusion")

    if mean_iou < 0.30 and len(reasons) == 0:
        reasons.append("low light or difficult scene")

    if len(reasons) == 0:
        reasons.append("general segmentation failure")

    return ", ".join(dict.fromkeys(reasons))


def generate_next_config(current_config, improved_diagnosis_df, imbalance_df, suspected_noise_df):
    next_config = json.loads(json.dumps(current_config))
    notes = []
    issues = improved_diagnosis_df["issue"].tolist() if len(improved_diagnosis_df) > 0 else []

    if "Overfitting" in issues:
        next_config["epochs"] = max(8, current_config["epochs"] - 3)
        next_config["augmentation"]["rotation"] = True
        next_config["augmentation"]["brightness_contrast"] = True
        notes.append("Reduced epochs and strengthened augmentation due to overfitting.")

    if "Underfitting" in issues:
        next_config["epochs"] = current_config["epochs"] + 5
        next_config["learning_rate"] = current_config["learning_rate"] * 1.25
        notes.append("Increased epochs and slightly raised learning rate due to underfitting.")

    if "Validation plateau" in issues or "Unstable validation performance" in issues:
        next_config["learning_rate"] = current_config["learning_rate"] * 0.5
        notes.append("Reduced learning rate due to plateau/instability.")

    if next_config.get("class_weights") is None:
        next_config["class_weights"] = {}
        for class_name in current_config.get("analysis_class_names", []):
            next_config["class_weights"][class_name] = 1.0

    for _, row in imbalance_df.iterrows():
        issue = str(row["issue"]).lower()
        for class_name in list(next_config["class_weights"].keys()):
            if class_name.lower() in issue:
                next_config["class_weights"][class_name] = 2.0
                notes.append(f"Raised '{class_name}' class weight.")

    if len(suspected_noise_df) > 0:
        next_config["label_review_required"] = True
        next_config["max_flagged_images_to_review"] = min(20, len(suspected_noise_df))
        notes.append("Flagged suspicious images for manual review.")

    return next_config, list(dict.fromkeys(notes))


def build_findings(train_log, per_image, class_names, class_balance_df=None, active_class_ids=None):
    selected_classes = _selected_class_map(class_names, active_class_ids)

    per_image = per_image.copy()
    per_image["selected_mean_iou"] = per_image.apply(
        lambda row: _selected_mean_for_row(row, selected_classes, "iou", "mean_iou"),
        axis=1,
    )
    per_image["selected_mean_dice"] = per_image.apply(
        lambda row: _selected_mean_for_row(row, selected_classes, "dice", "mean_dice"),
        axis=1,
    )

    worst_images_df = per_image.sort_values("selected_mean_iou").head(50).copy()
    worst_images_df["mean_iou"] = worst_images_df["selected_mean_iou"]
    worst_images_df["mean_dice"] = worst_images_df["selected_mean_dice"]
    worst_images_df["failure_type"] = worst_images_df.apply(
        lambda row: classify_failure_type(row, selected_classes), axis=1
    )
    failure_group_summary = worst_images_df["failure_type"].value_counts().reset_index()
    failure_group_summary.columns = ["failure_type", "count"]

    imbalance_findings = []
    if class_balance_df is not None and len(class_balance_df) > 0:
        active_ids = set(selected_classes.keys())
        filtered_balance = class_balance_df[class_balance_df["class_id"].isin(active_ids)].copy()

        for _, row in filtered_balance.iterrows():
            cls = row["class_name"]
            pixel_fraction = row["pixel_fraction"]
            image_fraction = row["image_fraction"]
            score = 0.0
            evidence_parts = []
            if pixel_fraction < 0.03:
                score += 0.6
                evidence_parts.append(f"very low pixel fraction ({pixel_fraction:.3f})")
            elif pixel_fraction < 0.07:
                score += 0.3
                evidence_parts.append(f"low pixel fraction ({pixel_fraction:.3f})")
            if image_fraction < 0.15:
                score += 0.4
                evidence_parts.append(f"appears in few images ({image_fraction:.3f})")
            elif image_fraction < 0.30:
                score += 0.2
                evidence_parts.append(f"limited image presence ({image_fraction:.3f})")
            if score > 0:
                imbalance_findings.append({
                    "issue": f"Class imbalance: {cls}",
                    "evidence": ", ".join(evidence_parts),
                    "confidence_score": min(score, 1.0),
                    "confidence": confidence_from_score(min(score, 1.0)),
                })
    imbalance_df = pd.DataFrame(imbalance_findings)

    noise_flags = []
    iou_q10 = per_image["selected_mean_iou"].quantile(0.10)
    dice_q10 = per_image["selected_mean_dice"].quantile(0.10)
    class_text_names = list(selected_classes.values())

    for _, row in per_image.iterrows():
        score = 0.0
        evidence_parts = []
        if row["selected_mean_iou"] <= iou_q10:
            score += 0.25
            evidence_parts.append(f"mean IoU in bottom 10% ({row['selected_mean_iou']:.3f})")
        if row["selected_mean_dice"] <= dice_q10:
            score += 0.25
            evidence_parts.append(f"mean Dice in bottom 10% ({row['selected_mean_dice']:.3f})")
        for cls in class_text_names:
            for field, cutoff in [("iou", 0.10), ("recall", 0.10), ("precision", 0.10)]:
                val = row.get(f"{cls}_{field}", np.nan)
                if pd.notna(val) and val < cutoff:
                    score += 0.10
                    evidence_parts.append(f"{cls} {field} extremely low ({val:.3f})")
        if score >= 0.50:
            noise_flags.append({
                "image_name": row["image_name"],
                "possible_issue": "Possible label noise or highly difficult sample",
                "evidence": "; ".join(evidence_parts[:6]),
                "confidence_score": min(score, 1.0),
                "confidence": confidence_from_score(min(score, 1.0)),
            })
    label_noise_df = (
        pd.DataFrame(noise_flags).sort_values("confidence_score", ascending=False).reset_index(drop=True)
        if noise_flags
        else pd.DataFrame()
    )

    final = train_log.iloc[-1]
    best_val_idx = train_log["val_iou"].idxmax()
    best_val_epoch = int(train_log.loc[best_val_idx, "epoch"])
    final_train_iou = float(final["train_iou"])
    final_val_iou = float(final["val_iou"])
    final_train_loss = float(final["train_loss"])
    final_val_loss = float(final["val_loss"])

    improved_diagnosis = []

    score, evidence = 0.0, []
    gap = final_train_iou - final_val_iou
    if gap > 0.15:
        score += 0.6
        evidence.append(f"large train-val IoU gap ({gap:.3f})")
    elif gap > 0.08:
        score += 0.3
        evidence.append(f"moderate train-val IoU gap ({gap:.3f})")
    if final_train_loss < final_val_loss:
        score += 0.2
        evidence.append("train loss is lower than validation loss")
    if best_val_epoch < len(train_log) - 3:
        score += 0.2
        evidence.append(f"best validation IoU occurred early at epoch {best_val_epoch}")
    if score > 0:
        improved_diagnosis.append({
            "issue": "Overfitting",
            "evidence": ", ".join(evidence),
            "confidence_score": min(score, 1.0),
            "confidence": confidence_from_score(min(score, 1.0)),
        })

    score, evidence = 0.0, []
    if final_train_iou < 0.50:
        score += 0.4
        evidence.append(f"train IoU is low ({final_train_iou:.3f})")
    if final_val_iou < 0.50:
        score += 0.4
        evidence.append(f"validation IoU is low ({final_val_iou:.3f})")
    if abs(final_train_iou - final_val_iou) < 0.05:
        score += 0.2
        evidence.append("train and validation IoU are similarly low")
    if score >= 0.5:
        improved_diagnosis.append({
            "issue": "Underfitting",
            "evidence": ", ".join(evidence),
            "confidence_score": min(score, 1.0),
            "confidence": confidence_from_score(min(score, 1.0)),
        })

    score, evidence = 0.0, []
    epochs_since_best = len(train_log) - best_val_epoch
    if epochs_since_best >= 4:
        score += 0.6
        evidence.append(f"no validation IoU improvement for {epochs_since_best} epochs")
    elif epochs_since_best >= 2:
        score += 0.3
        evidence.append(f"limited validation improvement after epoch {best_val_epoch}")
    recent_val = train_log["val_iou"].tail(5)
    if len(recent_val) >= 3 and (recent_val.max() - recent_val.min()) < 0.01:
        score += 0.2
        evidence.append("recent validation IoU is nearly flat")
    if score > 0:
        improved_diagnosis.append({
            "issue": "Validation plateau",
            "evidence": ", ".join(evidence),
            "confidence_score": min(score, 1.0),
            "confidence": confidence_from_score(min(score, 1.0)),
        })

    score, evidence = 0.0, []
    val_std = float(train_log["val_iou"].std())
    if val_std > 0.10:
        score += 0.7
        evidence.append(f"validation IoU std is high ({val_std:.3f})")
    elif val_std > 0.06:
        score += 0.4
        evidence.append(f"validation IoU std is moderately high ({val_std:.3f})")
    if score > 0:
        improved_diagnosis.append({
            "issue": "Unstable validation performance",
            "evidence": ", ".join(evidence),
            "confidence_score": min(score, 1.0),
            "confidence": confidence_from_score(min(score, 1.0)),
        })

    low_iou_fraction = float((per_image["selected_mean_iou"] < 0.40).mean())
    score, evidence = 0.0, []
    if low_iou_fraction > 0.30:
        score += 0.7
        evidence.append(f"{low_iou_fraction * 100:.1f}% of selected-class test images have mean IoU below 0.40")
    elif low_iou_fraction > 0.15:
        score += 0.4
        evidence.append(f"{low_iou_fraction * 100:.1f}% of selected-class test images have mean IoU below 0.40")
    if score > 0:
        improved_diagnosis.append({
            "issue": "Many poor-performing images",
            "evidence": ", ".join(evidence),
            "confidence_score": min(score, 1.0),
            "confidence": confidence_from_score(min(score, 1.0)),
        })

    for cls_id, cls_name in selected_classes.items():
        cls_mean_iou = float(per_image[f"{cls_name}_iou"].mean()) if f"{cls_name}_iou" in per_image.columns else np.nan
        cls_mean_recall = float(per_image[f"{cls_name}_recall"].mean()) if f"{cls_name}_recall" in per_image.columns else np.nan
        cls_mean_precision = float(per_image[f"{cls_name}_precision"].mean()) if f"{cls_name}_precision" in per_image.columns else np.nan
        score, evidence = 0.0, []
        if pd.notna(cls_mean_iou):
            if cls_mean_iou < 0.30:
                score += 0.5
                evidence.append(f"mean {cls_name} IoU is very low ({cls_mean_iou:.3f})")
            elif cls_mean_iou < 0.45:
                score += 0.3
                evidence.append(f"mean {cls_name} IoU is low ({cls_mean_iou:.3f})")
        if pd.notna(cls_mean_recall) and cls_mean_recall < 0.40:
            score += 0.2
            evidence.append(f"{cls_name} recall is weak ({cls_mean_recall:.3f})")
        if pd.notna(cls_mean_precision) and cls_mean_precision < 0.40:
            score += 0.2
            evidence.append(f"{cls_name} precision is weak ({cls_mean_precision:.3f})")
        if score > 0:
            improved_diagnosis.append({
                "issue": f"Weak {cls_name} segmentation",
                "evidence": ", ".join(evidence),
                "confidence_score": min(score, 1.0),
                "confidence": confidence_from_score(min(score, 1.0)),
            })

    improved_diagnosis_df = (
        pd.DataFrame(improved_diagnosis).sort_values("confidence_score", ascending=False).reset_index(drop=True)
        if improved_diagnosis
        else pd.DataFrame()
    )

    improved_recommendations = []
    issues = improved_diagnosis_df["issue"].tolist() if len(improved_diagnosis_df) > 0 else []
    if "Overfitting" in issues:
        improved_recommendations += [
            "Apply stronger augmentation to improve generalization.",
            "Use early stopping based on validation IoU.",
            "Reduce training epochs if validation has already plateaued.",
        ]
    if "Underfitting" in issues:
        improved_recommendations += [
            "Train longer or try a stronger model backbone.",
            "Check whether the learning rate is too low.",
            "Inspect whether resizing removes important details.",
        ]
    if "Validation plateau" in issues:
        improved_recommendations += [
            "Save and use the best validation checkpoint instead of the final epoch.",
            "Add a learning rate scheduler to help escape flat optimization behavior.",
        ]
    if "Unstable validation performance" in issues:
        improved_recommendations += [
            "Lower the learning rate and rerun training.",
            "Check training masks for noisy or inconsistent labels.",
            "Increase batch size if memory allows.",
        ]
    if "Many poor-performing images" in issues:
        improved_recommendations += [
            "Inspect the lowest-IoU images visually and group them by failure type.",
            "Add more examples of the most difficult scene conditions to training.",
        ]
    for _, cls_name in selected_classes.items():
        if f"Weak {cls_name} segmentation" in issues:
            improved_recommendations += [
                f"Review mask quality and annotation consistency for '{cls_name}'.",
                f"Add more representative training images for '{cls_name}'.",
                f"Consider class-weighted loss or focal-style loss for '{cls_name}'.",
            ]
    if len(label_noise_df) > 0:
        improved_recommendations += [
            "Manually inspect the top suspicious images flagged for possible label noise.",
            "Correct or remove masks that are clearly inconsistent with the scene.",
        ]

    improved_recommendations = list(dict.fromkeys(improved_recommendations))
    improved_recommendation_df = pd.DataFrame({"recommendation": improved_recommendations})

    all_findings = []
    for _, row in improved_diagnosis_df.iterrows():
        all_findings.append({
            "type": "Training Diagnosis",
            "issue": row["issue"],
            "evidence": row["evidence"],
            "confidence": row["confidence"],
            "confidence_score": row["confidence_score"],
        })
    for _, row in imbalance_df.iterrows():
        all_findings.append({
            "type": "Class Balance",
            "issue": row["issue"],
            "evidence": row["evidence"],
            "confidence": row["confidence"],
            "confidence_score": row["confidence_score"],
        })
    if len(label_noise_df) > 0:
        for _, row in label_noise_df.head(15).iterrows():
            all_findings.append({
                "type": "Possible Label Noise",
                "issue": row["possible_issue"],
                "evidence": f"{row['image_name']}: {row['evidence']}",
                "confidence": row["confidence"],
                "confidence_score": row["confidence_score"],
            })

    all_findings_df = (
        pd.DataFrame(all_findings).sort_values("confidence_score", ascending=False).reset_index(drop=True)
        if all_findings
        else pd.DataFrame()
    )

    health_score = 100
    health_score -= min(30, len(label_noise_df))
    health_score -= int(low_iou_fraction * 50)
    health_score -= len(imbalance_df) * 5
    health_score = max(0, health_score)

    return {
        "worst_images_df": worst_images_df,
        "failure_group_summary": failure_group_summary,
        "imbalance_df": imbalance_df,
        "label_noise_df": label_noise_df,
        "improved_diagnosis_df": improved_diagnosis_df,
        "improved_recommendation_df": improved_recommendation_df,
        "all_findings_df": all_findings_df,
        "health_score": health_score,
        "selected_class_ids": list(selected_classes.keys()),
        "selected_class_names": list(selected_classes.values()),
    }