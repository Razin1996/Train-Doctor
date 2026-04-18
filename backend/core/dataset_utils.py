import json
import shutil
import random
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw

CLASS_NAMES_DEFAULT = {0: "background", 1: "class_1"}


def parse_class_map_text(text: str):
    out = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        k, v = line.split(":", 1)
        out[int(k.strip())] = v.strip()
    return out if out else CLASS_NAMES_DEFAULT.copy()


def detect_images(image_dir: str | Path):
    image_dir = Path(image_dir)
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    if not image_dir.exists():
        return []
    return sorted([p for p in image_dir.iterdir() if p.suffix.lower() in exts])


def infer_class_names_from_coco(coco_json_path: str | Path):
    coco_json_path = Path(coco_json_path)
    if not coco_json_path.exists():
        return {}

    with open(coco_json_path, "r", encoding="utf-8") as f:
        coco = json.load(f)

    categories = coco.get("categories", [])
    if not categories:
        return {}

    inferred = {0: "background"}
    sorted_categories = sorted(categories, key=lambda c: c["id"])

    for idx, category in enumerate(sorted_categories, start=1):
        inferred[idx] = str(category.get("name", f"class_{idx}"))

    return inferred


def draw_coco_polygon_mask(image_size, segmentation):
    w, h = image_size
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    if isinstance(segmentation, list):
        for poly in segmentation:
            if len(poly) >= 6:
                xy = [(poly[i], poly[i + 1]) for i in range(0, len(poly), 2)]
                draw.polygon(xy, outline=1, fill=1)
    return np.array(img, dtype=np.uint8)


def normalize_copy(image_src: Path, mask_src: Path, out_image: Path, out_mask: Path):
    shutil.copy2(image_src, out_image)
    mask = cv2.imread(str(mask_src), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        raise FileNotFoundError(f"Could not read mask: {mask_src}")
    cv2.imwrite(str(out_mask), mask.astype(np.uint8))


def prepare_dataset(
    output_root: Path,
    image_dir: str,
    annotation_mode: str,
    mask_dir: str = "",
    coco_json_path: str = "",
    split_seed: int = 42,
    train_frac: float = 0.7,
    val_frac: float = 0.15,
    test_frac: float = 0.15,
):
    output_root.mkdir(parents=True, exist_ok=True)
    prepared_dir = output_root / "prepared_dataset"
    if prepared_dir.exists():
        shutil.rmtree(prepared_dir)
    for split in ["train", "val", "test"]:
        (prepared_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (prepared_dir / split / "masks").mkdir(parents=True, exist_ok=True)

    images = detect_images(image_dir)
    if not images:
        raise ValueError("No images found in the image directory.")

    items = []
    if annotation_mode == "Mask folder":
        mask_dir_path = Path(mask_dir)
        for img_path in images:
            mask_path = mask_dir_path / f"{img_path.stem}.png"
            if mask_path.exists():
                items.append((img_path, mask_path, img_path.name))
    else:
        with open(coco_json_path, "r", encoding="utf-8") as f:
            coco = json.load(f)

        image_meta = {im["id"]: im for im in coco.get("images", [])}
        anns_by_image = {}
        for ann in coco.get("annotations", []):
            anns_by_image.setdefault(ann["image_id"], []).append(ann)

        cat_map = {0: 0}
        next_idx = 1
        for cid in sorted({c["id"] for c in coco.get("categories", [])}):
            cat_map[cid] = next_idx
            next_idx += 1

        temp_mask_dir = output_root / "_temp_masks"
        if temp_mask_dir.exists():
            shutil.rmtree(temp_mask_dir)
        temp_mask_dir.mkdir(parents=True, exist_ok=True)

        image_lookup = {p.name: p for p in images}
        for image_id, meta in image_meta.items():
            file_name = meta["file_name"]
            if file_name not in image_lookup:
                continue
            img_path = image_lookup[file_name]
            width = int(meta["width"])
            height = int(meta["height"])
            mask = np.zeros((height, width), dtype=np.uint8)
            for ann in anns_by_image.get(image_id, []):
                seg = ann.get("segmentation", [])
                cls_val = cat_map.get(ann["category_id"], 0)
                poly_mask = draw_coco_polygon_mask((width, height), seg)
                mask[poly_mask > 0] = cls_val
            mask_path = temp_mask_dir / f"{Path(file_name).stem}.png"
            cv2.imwrite(str(mask_path), mask)
            items.append((img_path, mask_path, img_path.name))

    if not items:
        raise ValueError("No matched image/mask pairs found.")

    rng = random.Random(split_seed)
    rng.shuffle(items)
    n = len(items)
    n_train = max(1, int(round(n * train_frac)))
    n_val = max(1, int(round(n * val_frac)))
    if n_train + n_val >= n:
        n_val = max(1, n - n_train - 1)
    n_test = n - n_train - n_val
    if n_test <= 0:
        n_test = 1
        n_train = max(1, n_train - 1)

    splits = {
        "train": items[:n_train],
        "val": items[n_train:n_train + n_val],
        "test": items[n_train + n_val:],
    }

    for split_name, split_items in splits.items():
        for img_src, mask_src, file_name in split_items:
            out_img = prepared_dir / split_name / "images" / img_src.name
            out_mask = prepared_dir / split_name / "masks" / f"{Path(file_name).stem}.png"
            normalize_copy(img_src, mask_src, out_img, out_mask)

    return prepared_dir


def audit_prepared_dataset(prepared_dir: Path, class_names: dict[int, str]):
    pixel_counter = {int(k): 0 for k in class_names.keys()}
    image_presence_counter = {int(k): 0 for k in class_names.keys()}
    empty_masks = []
    unique_value_issues = []

    mask_files = []
    for split in ["train", "val", "test"]:
        mask_files.extend(sorted((prepared_dir / split / "masks").glob("*.png")))

    for mask_path in mask_files:
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        if mask is None:
            continue
        values, counts = np.unique(mask, return_counts=True)
        if np.max(mask) == 0:
            empty_masks.append(mask_path.name)
        present_classes = set()
        for v, c in zip(values, counts):
            pixel_counter[int(v)] = pixel_counter.get(int(v), 0) + int(c)
            if int(v) != 0 and c > 0:
                present_classes.add(int(v))
            if int(v) not in class_names:
                unique_value_issues.append({"mask": mask_path.name, "unexpected_value": int(v)})
        for cls in present_classes:
            image_presence_counter[cls] = image_presence_counter.get(cls, 0) + 1

    total_pixels = sum(pixel_counter.values()) if pixel_counter else 0
    total_masks = len(mask_files)
    rows = []
    for cls_id, cls_name in class_names.items():
        rows.append({
            "class_id": cls_id,
            "class_name": cls_name,
            "pixel_count": pixel_counter.get(cls_id, 0),
            "pixel_fraction": (pixel_counter.get(cls_id, 0) / total_pixels) if total_pixels > 0 else 0,
            "images_present": image_presence_counter.get(cls_id, 0),
            "image_fraction": (image_presence_counter.get(cls_id, 0) / total_masks) if total_masks > 0 else 0,
        })

    split_summary = pd.DataFrame([
        {"split": "train", "num_images": len(list((prepared_dir / "train" / "images").glob("*")))},
        {"split": "val", "num_images": len(list((prepared_dir / "val" / "images").glob("*")))},
        {"split": "test", "num_images": len(list((prepared_dir / "test" / "images").glob("*")))},
    ])
    return pd.DataFrame(rows), split_summary, pd.DataFrame(unique_value_issues), empty_masks