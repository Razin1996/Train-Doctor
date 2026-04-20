from typing import Literal, Optional
from pydantic import BaseModel, Field

AnnotationMode = Literal["COCO JSON", "Mask folder"]
ModelName = Literal["unet", "deeplabv3plus", "segformer"]


class DatasetPrepareRequest(BaseModel):
    image_dir: str
    annotation_mode: AnnotationMode
    mask_dir: str = ""
    coco_json_path: str = ""
    split_seed: int = 42
    train_frac: float = 0.7
    val_frac: float = 0.15
    test_frac: float = 0.15
    class_names: dict[str, str] = Field(default_factory=dict)


class FullPipelineStartRequest(DatasetPrepareRequest):
    model_name: ModelName = "unet"
    image_size: int = 512
    batch_size: int = 4
    epochs: int = 15
    learning_rate: float = 1e-4
    patience: int = 5
    use_amp: bool = True
    max_iterations: int = 3
    target_mean_iou: float = 0.80


class ExplanationRequest(BaseModel):
    backend: Literal["rule_based", "ollama", "openai"] = "rule_based"
    ollama_url: Optional[str] = "http://localhost:11434"
    ollama_model: Optional[str] = "llama3.1:8b"
    openai_model: Optional[str] = "gpt-5.4-mini"
    openai_api_key: Optional[str] = None
    include_class_ids: Optional[list[int]] = None


class ExistingRunImportRequest(BaseModel):
    directory_path: str
    run_id: Optional[str] = None