from pathlib import Path
import cv2
import numpy as np
import pandas as pd


def compute_class_metrics(pred, target, num_classes):
    rows = {}
    eps = 1e-7
    ious, dices = [], []

    for cls in range(num_classes):
        p = pred == cls
        t = target == cls

        tp = int((p & t).sum())
        fp = int((p & ~t).sum())
        fn = int((~p & t).sum())

        iou = tp / (tp + fp + fn + eps)
        dice = (2 * tp) / (2 * tp + fp + fn + eps)
        precision = tp / (tp + fp + eps)
        recall = tp / (tp + fn + eps)

        rows[f"class_{cls}_tp"] = tp
        rows[f"class_{cls}_fp"] = fp
        rows[f"class_{cls}_fn"] = fn
        rows[f"class_{cls}_iou"] = iou
        rows[f"class_{cls}_dice"] = dice
        rows[f"class_{cls}_precision"] = precision
        rows[f"class_{cls}_recall"] = recall

        ious.append(iou)
        dices.append(dice)

    rows["mean_iou"] = float(np.mean(ious))
    rows["mean_dice"] = float(np.mean(dices))
    return rows


class SegMaskDataset:
    def __init__(self, records, image_size):
        self.records = records
        self.image_size = image_size

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        import torch

        row = self.records[idx]

        img = cv2.imread(str(row["image_path"]))
        if img is None:
            raise FileNotFoundError(f"Could not read image: {row['image_path']}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        mask = cv2.imread(str(row["mask_path"]), cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise FileNotFoundError(f"Could not read mask: {row['mask_path']}")

        img = cv2.resize(
            img,
            (self.image_size, self.image_size),
            interpolation=cv2.INTER_LINEAR,
        )
        mask = cv2.resize(
            mask,
            (self.image_size, self.image_size),
            interpolation=cv2.INTER_NEAREST,
        )

        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))

        return (
            torch.tensor(img, dtype=torch.float32),
            torch.tensor(mask, dtype=torch.long),
            row["image_name"],
        )


def build_model(model_name, num_classes, device):
    model_name = model_name.lower()

    if model_name == "unet":
        import segmentation_models_pytorch as smp

        model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights="imagenet",
            in_channels=3,
            classes=num_classes,
        )
        return model.to(device), "smp"

    if model_name == "deeplabv3plus":
        import segmentation_models_pytorch as smp

        model = smp.DeepLabV3Plus(
            encoder_name="resnet34",
            encoder_weights="imagenet",
            in_channels=3,
            classes=num_classes,
        )
        return model.to(device), "smp"

    if model_name == "segformer":
        from transformers import SegformerForSemanticSegmentation

        model = SegformerForSemanticSegmentation.from_pretrained(
            "nvidia/segformer-b0-finetuned-ade-512-512",
            num_labels=num_classes,
            ignore_mismatched_sizes=True,
        )
        return model.to(device), "hf"

    raise ValueError(f"Unsupported built-in model: {model_name}")


def _collect_records(prepared_dir: Path):
    records = {"train": [], "val": [], "test": []}

    for split_name in ["train", "val", "test"]:
        img_dir = prepared_dir / split_name / "images"
        mask_dir = prepared_dir / split_name / "masks"

        for mask_path in sorted(mask_dir.glob("*.png")):
            stem = mask_path.stem
            image_path = None

            for ext in [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"]:
                candidate = img_dir / f"{stem}{ext}"
                if candidate.exists():
                    image_path = candidate
                    break

            if image_path is not None:
                records[split_name].append(
                    {
                        "image_path": image_path,
                        "mask_path": mask_path,
                        "image_name": image_path.name,
                    }
                )

    return records


def _save_history_csv(history, output_dir: Path):
    if len(history) > 0:
        pd.DataFrame(history).to_csv(output_dir / "train_log.csv", index=False)


def _safe_update_stage(update_stage, run_dir, stage, message, progress=None, extra=None):
    try:
        update_stage(run_dir, stage, message, progress=progress, extra=extra)
    except TypeError:
        update_stage(run_dir, stage, message, progress=progress)


def run_training_iteration(run_dir, prepared_dir, cfg, update_stage, should_stop):
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader

    output_dir = run_dir / f"outputs_iter_{cfg['iteration']}"
    pred_dir = output_dir / "predictions"
    output_dir.mkdir(parents=True, exist_ok=True)
    pred_dir.mkdir(parents=True, exist_ok=True)

    # ---- stop before anything expensive
    if should_stop(run_dir):
        _safe_update_stage(
            update_stage,
            run_dir,
            "stopped",
            f"Stopped before training iteration {cfg['iteration']} started.",
            progress=None,
        )
        return None

    records = _collect_records(prepared_dir)
    train_records = records["train"]
    val_records = records["val"]
    test_records = records["test"]

    image_size = int(cfg["image_size"])
    batch_size = int(cfg["batch_size"])
    epochs = int(cfg["epochs"])
    learning_rate = float(cfg["learning_rate"])
    num_classes = int(cfg["num_classes"])
    use_amp = bool(cfg.get("use_amp", False))
    patience = int(cfg.get("patience", 5))
    model_name = cfg["model_name"]

    train_ds = SegMaskDataset(train_records, image_size)
    val_ds = SegMaskDataset(val_records, image_size)
    test_ds = SegMaskDataset(test_records, image_size)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=1, shuffle=False, num_workers=0)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, family = build_model(model_name, num_classes, device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
    loss_fn = nn.CrossEntropyLoss()

    amp_enabled = use_amp and device == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=amp_enabled)

    best_val_iou = -1.0
    epochs_without_improve = 0
    history = []

    def forward_pass(images):
        if family == "smp":
            return model(images)

        logits = model(pixel_values=images).logits
        if logits.shape[-1] != image_size or logits.shape[-2] != image_size:
            logits = torch.nn.functional.interpolate(
                logits,
                size=(image_size, image_size),
                mode="bilinear",
                align_corners=False,
            )
        return logits

    # =========================
    # TRAIN / VALIDATE
    # =========================
    for epoch in range(1, epochs + 1):
        # stop before epoch
        if should_stop(run_dir):
            _save_history_csv(history, output_dir)
            _safe_update_stage(
                update_stage,
                run_dir,
                "stopped",
                f"Stopped before epoch {epoch} of iteration {cfg['iteration']}.",
                progress=None,
            )
            return None

        model.train()
        tr_loss = 0.0
        tr_ious, tr_dices = [], []

        for batch_idx, (images, masks, _) in enumerate(train_loader, start=1):
            # stop during training batch loop
            if should_stop(run_dir):
                _save_history_csv(history, output_dir)
                _safe_update_stage(
                    update_stage,
                    run_dir,
                    "stopped",
                    f"Stopped during training batch {batch_idx} of epoch {epoch}, iteration {cfg['iteration']}.",
                    progress=None,
                )
                return None

            images, masks = images.to(device), masks.to(device)
            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=amp_enabled):
                logits = forward_pass(images)
                loss = loss_fn(logits, masks)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            tr_loss += float(loss.item()) * images.size(0)

            preds = torch.argmax(logits, dim=1).detach().cpu().numpy()
            tgts = masks.detach().cpu().numpy()

            for p, t in zip(preds, tgts):
                m = compute_class_metrics(p, t, num_classes)
                tr_ious.append(m["mean_iou"])
                tr_dices.append(m["mean_dice"])

        train_loss = tr_loss / max(1, len(train_ds))
        train_iou = float(np.mean(tr_ious)) if tr_ious else 0.0
        train_dice = float(np.mean(tr_dices)) if tr_dices else 0.0

        # stop after training epoch, before validation
        if should_stop(run_dir):
            history.append(
                {
                    "epoch": epoch,
                    "train_loss": train_loss,
                    "val_loss": np.nan,
                    "train_iou": train_iou,
                    "val_iou": np.nan,
                    "train_dice": train_dice,
                    "val_dice": np.nan,
                }
            )
            _save_history_csv(history, output_dir)
            _safe_update_stage(
                update_stage,
                run_dir,
                "stopped",
                f"Stopped after training phase of epoch {epoch}, before validation, iteration {cfg['iteration']}.",
                progress=None,
            )
            return None

        model.eval()
        va_loss = 0.0
        va_ious, va_dices = [], []

        with torch.no_grad():
            for val_batch_idx, (images, masks, _) in enumerate(val_loader, start=1):
                # stop during validation loop
                if should_stop(run_dir):
                    history.append(
                        {
                            "epoch": epoch,
                            "train_loss": train_loss,
                            "val_loss": np.nan,
                            "train_iou": train_iou,
                            "val_iou": np.nan,
                            "train_dice": train_dice,
                            "val_dice": np.nan,
                        }
                    )
                    _save_history_csv(history, output_dir)
                    _safe_update_stage(
                        update_stage,
                        run_dir,
                        "stopped",
                        f"Stopped during validation batch {val_batch_idx} of epoch {epoch}, iteration {cfg['iteration']}.",
                        progress=None,
                    )
                    return None

                images, masks = images.to(device), masks.to(device)
                logits = forward_pass(images)
                loss = loss_fn(logits, masks)
                va_loss += float(loss.item()) * images.size(0)

                preds = torch.argmax(logits, dim=1).cpu().numpy()
                tgts = masks.cpu().numpy()

                for p, t in zip(preds, tgts):
                    m = compute_class_metrics(p, t, num_classes)
                    va_ious.append(m["mean_iou"])
                    va_dices.append(m["mean_dice"])

        val_loss = va_loss / max(1, len(val_ds))
        val_iou = float(np.mean(va_ious)) if va_ious else 0.0
        val_dice = float(np.mean(va_dices)) if va_dices else 0.0

        history.append(
            {
                "epoch": epoch,
                "train_loss": train_loss,
                "val_loss": val_loss,
                "train_iou": train_iou,
                "val_iou": val_iou,
                "train_dice": train_dice,
                "val_dice": val_dice,
            }
        )

        _save_history_csv(history, output_dir)

        _safe_update_stage(
            update_stage,
            run_dir,
            "training",
            f"Iteration {cfg['iteration']} epoch {epoch}/{epochs}",
            progress=0.20 + 0.45 * (epoch / epochs),
            extra={"iteration": cfg["iteration"], "epoch": epoch, "epochs": epochs},
        )

        if val_iou > best_val_iou:
            best_val_iou = val_iou
            epochs_without_improve = 0
            torch.save(model.state_dict(), output_dir / "best_model.pt")
        else:
            epochs_without_improve += 1

        if epochs_without_improve >= patience:
            break

    _save_history_csv(history, output_dir)

    # =========================
    # LOAD BEST MODEL
    # =========================
    if should_stop(run_dir):
        _safe_update_stage(
            update_stage,
            run_dir,
            "stopped",
            f"Stopped after training loop of iteration {cfg['iteration']}, before best model loading.",
            progress=None,
        )
        return None

    if (output_dir / "best_model.pt").exists():
        state = torch.load(output_dir / "best_model.pt", map_location=device)
        model.load_state_dict(state)

    _safe_update_stage(
        update_stage,
        run_dir,
        "evaluation",
        f"Evaluating iteration {cfg['iteration']}",
        progress=0.75,
    )

    # =========================
    # TEST EVALUATION
    # =========================
    per_image_rows = []
    class_agg = {
        cls: {"iou": [], "dice": [], "precision": [], "recall": []}
        for cls in range(num_classes)
    }

    model.eval()
    with torch.no_grad():
        for test_batch_idx, (images, masks, image_names) in enumerate(test_loader, start=1):
            # stop during test evaluation
            if should_stop(run_dir):
                if len(per_image_rows) > 0:
                    per_image_df = pd.DataFrame(per_image_rows)
                    per_image_df.to_csv(output_dir / "per_image_metrics.csv", index=False)

                _safe_update_stage(
                    update_stage,
                    run_dir,
                    "stopped",
                    f"Stopped during test evaluation batch {test_batch_idx} of iteration {cfg['iteration']}.",
                    progress=None,
                )
                return None

            images, masks = images.to(device), masks.to(device)
            logits = forward_pass(images)
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            tgts = masks.cpu().numpy()

            for pred, tgt, image_name in zip(preds, tgts, image_names):
                row = {"image_name": image_name}
                metrics = compute_class_metrics(pred, tgt, num_classes)
                row.update(metrics)

                for cls in range(num_classes):
                    cname = cfg["class_names"][str(cls)]

                    class_agg[cls]["iou"].append(metrics[f"class_{cls}_iou"])
                    class_agg[cls]["dice"].append(metrics[f"class_{cls}_dice"])
                    class_agg[cls]["precision"].append(metrics[f"class_{cls}_precision"])
                    class_agg[cls]["recall"].append(metrics[f"class_{cls}_recall"])

                    row[f"{cname}_iou"] = metrics[f"class_{cls}_iou"]
                    row[f"{cname}_dice"] = metrics[f"class_{cls}_dice"]
                    row[f"{cname}_precision"] = metrics[f"class_{cls}_precision"]
                    row[f"{cname}_recall"] = metrics[f"class_{cls}_recall"]
                    row[f"{cname}_fp"] = metrics[f"class_{cls}_fp"]
                    row[f"{cname}_fn"] = metrics[f"class_{cls}_fn"]
                    row[f"{cname}_tp"] = metrics[f"class_{cls}_tp"]

                per_image_rows.append(row)
                cv2.imwrite(str(pred_dir / f"{Path(image_name).stem}.png"), pred.astype(np.uint8))

    # =========================
    # SAVE FINAL TEST OUTPUTS
    # =========================
    per_image_df = pd.DataFrame(per_image_rows)
    per_image_df.to_csv(output_dir / "per_image_metrics.csv", index=False)

    test_summary = {
        "num_test_images": len(per_image_df),
        "mean_iou": float(per_image_df["mean_iou"].mean()) if len(per_image_df) else 0.0,
        "mean_dice": float(per_image_df["mean_dice"].mean()) if len(per_image_df) else 0.0,
    }

    for cls in range(num_classes):
        cname = cfg["class_names"][str(cls)]
        test_summary[f"{cname}_iou_mean"] = (
            float(np.mean(class_agg[cls]["iou"])) if class_agg[cls]["iou"] else 0.0
        )
        test_summary[f"{cname}_dice_mean"] = (
            float(np.mean(class_agg[cls]["dice"])) if class_agg[cls]["dice"] else 0.0
        )
        test_summary[f"{cname}_precision_mean"] = (
            float(np.mean(class_agg[cls]["precision"])) if class_agg[cls]["precision"] else 0.0
        )
        test_summary[f"{cname}_recall_mean"] = (
            float(np.mean(class_agg[cls]["recall"])) if class_agg[cls]["recall"] else 0.0
        )

    pd.DataFrame([test_summary]).to_csv(output_dir / "test_metrics.csv", index=False)

    return output_dir