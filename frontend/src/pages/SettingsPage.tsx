import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Play, FolderOpen, Square, Database } from "lucide-react";
import {
  startPipeline,
  getPipelineStatus,
  stopPipeline,
  importExistingRun,
} from "@/api/traindoctor";

type WorkflowMode = "Dataset Audit Only" | "Run Diagnosis" | "Full Pipeline";
type AnnotationType = "COCO JSON" | "Mask folder";
type ModelName = "unet" | "deeplabv3plus" | "segformer";

type PipelineStatus = {
  run_id?: string;
  stage?: string;
  message?: string;
  progress?: number | null;
  updated_at?: string;
  extra?: Record<string, unknown>;
};

const RUN_ID_KEY = "traindoctor_run_id";
const EXISTING_DIR_KEY = "traindoctor_existing_dir";
const EXISTING_RUN_ID_KEY = "traindoctor_existing_run_id";
const IMAGE_DIR_KEY = "traindoctor_image_dir";
const MASK_DIR_KEY = "traindoctor_mask_dir";
const COCO_JSON_KEY = "traindoctor_coco_json_path";

export default function SettingsPage() {
  const [workflow, setWorkflow] = useState<WorkflowMode>("Full Pipeline");

  const [imageDir, setImageDir] = useState(
    localStorage.getItem(IMAGE_DIR_KEY) || "",
  );
  const [annotationType, setAnnotationType] =
    useState<AnnotationType>("COCO JSON");
  const [maskDir, setMaskDir] = useState(
    localStorage.getItem(MASK_DIR_KEY) || "",
  );
  const [cocoJsonPath, setCocoJsonPath] = useState(
    localStorage.getItem(COCO_JSON_KEY) || "",
  );

  const [modelName, setModelName] = useState<ModelName>("unet");
  const [imageSize, setImageSize] = useState("512");
  const [batchSize, setBatchSize] = useState("4");
  const [epochs, setEpochs] = useState("15");
  const [learningRate, setLearningRate] = useState("0.0001");
  const [patience, setPatience] = useState("5");
  const [useAmp, setUseAmp] = useState(true);

  const [existingDir, setExistingDir] = useState(
    localStorage.getItem(EXISTING_DIR_KEY) || "",
  );
  const [existingRunId, setExistingRunId] = useState(
    localStorage.getItem(EXISTING_RUN_ID_KEY) || "",
  );

  const [runId, setRunId] = useState<string | null>(
    localStorage.getItem(RUN_ID_KEY),
  );
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const currentStage = (status?.stage || "").toLowerCase();

  const isRunning = useMemo(() => {
    return !!runId && !["completed", "failed", "stopped", "stop_requested", "imported"].includes(currentStage);
  }, [runId, currentStage]);

  const canRunFullPipeline = workflow === "Full Pipeline";

  const fetchStatus = async (id: string) => {
    try {
      const res = await getPipelineStatus(id);
      setStatus(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch status:", err);
      return null;
    }
  };

  useEffect(() => {
    localStorage.setItem(EXISTING_DIR_KEY, existingDir);
  }, [existingDir]);

  useEffect(() => {
    localStorage.setItem(EXISTING_RUN_ID_KEY, existingRunId);
  }, [existingRunId]);

  useEffect(() => {
    localStorage.setItem(IMAGE_DIR_KEY, imageDir);
  }, [imageDir]);

  useEffect(() => {
    localStorage.setItem(MASK_DIR_KEY, maskDir);
  }, [maskDir]);

  useEffect(() => {
    localStorage.setItem(COCO_JSON_KEY, cocoJsonPath);
  }, [cocoJsonPath]);

  useEffect(() => {
    if (!runId) return;

    let interval: number | undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getPipelineStatus(runId);
        if (cancelled) return;

        const data = res.data;
        setStatus(data);

        const terminalStages = ["completed", "failed", "stopped", "imported"];
        if (terminalStages.includes((data.stage || "").toLowerCase())) {
          if (interval) window.clearInterval(interval);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch status:", err);
        }
      }
    };

    poll();
    interval = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [runId]);

  const handleImportExisting = async () => {
    setError(null);
    setImportResult(null);

    if (!existingDir.trim()) {
      setError("Please provide an existing run or output directory path.");
      return;
    }

    try {
      setIsImporting(true);
      const res = await importExistingRun(
        existingDir.trim(),
        existingRunId.trim() || undefined,
      );

      const newRunId = res.data.run_id;
      setRunId(newRunId);
      localStorage.setItem(RUN_ID_KEY, newRunId);
      setImportResult(res.data);
      await fetchStatus(newRunId);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to import existing directory.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleStart = async () => {
    setError(null);
    setImportResult(null);

    if (!canRunFullPipeline) {
      setError("This button currently starts only the Full Pipeline workflow.");
      return;
    }

    if (!imageDir.trim()) {
      setError("Please provide the image folder path.");
      return;
    }

    if (annotationType === "COCO JSON" && !cocoJsonPath.trim()) {
      setError("Please provide the COCO JSON path.");
      return;
    }

    if (annotationType === "Mask folder" && !maskDir.trim()) {
      setError("Please provide the mask folder path.");
      return;
    }

    const payload = {
      image_dir: imageDir,
      annotation_mode: annotationType,
      mask_dir: annotationType === "Mask folder" ? maskDir : "",
      coco_json_path: annotationType === "COCO JSON" ? cocoJsonPath : "",
      split_seed: 42,
      train_frac: 0.7,
      val_frac: 0.15,
      test_frac: 0.15,
      model_name: modelName,
      image_size: Number(imageSize),
      batch_size: Number(batchSize),
      epochs: Number(epochs),
      learning_rate: Number(learningRate),
      patience: Number(patience),
      use_amp: useAmp,
      max_iterations: 3,
      target_mean_iou: 0.8,
      class_names: {},
    };

    try {
      setIsStarting(true);

      const res = await startPipeline(payload);
      const newRunId = res.data.run_id;

      setRunId(newRunId);
      localStorage.setItem(RUN_ID_KEY, newRunId);

      await fetchStatus(newRunId);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to start pipeline.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!runId) return;

    try {
      setIsStopping(true);
      await stopPipeline(runId);

      setStatus((prev) => ({
        ...prev,
        run_id: runId,
        stage: "stop_requested",
        message: "Stop requested. Waiting for worker to stop safely.",
        progress: prev?.progress ?? null,
        updated_at: new Date().toLocaleString(),
        extra: {},
      }));
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to stop pipeline.",
      );
    } finally {
      setIsStopping(false);
    }
  };

  const renderStatusBadge = () => {
    const stage = status?.stage || "unknown";
    return (
      <span className="inline-flex rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground">
        {stage}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-3xl"
    >
      <div>
        <h2 className="text-2xl font-heading font-bold">Configuration</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pipeline settings and dataset configuration
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Load Existing Results Directory</h3>
        </div>

        <div className="space-y-2">
          <Label>Existing Run Root or Output Directory</Label>
          <Input
            value={existingDir}
            onChange={(e) => setExistingDir(e.target.value)}
            placeholder="C:/path/to/previous/run OR C:/path/to/outputs_iter_1"
            className="bg-secondary border-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Optional Imported Run ID</Label>
          <Input
            value={existingRunId}
            onChange={(e) => setExistingRunId(e.target.value)}
            placeholder="Leave blank to auto-generate"
            className="bg-secondary border-border"
          />
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={handleImportExisting}
          disabled={isImporting}
        >
          <FolderOpen className="h-4 w-4" />
          {isImporting ? "Importing..." : "Use Existing Directory"}
        </Button>

        {importResult && (
          <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Imported run ID:</span>{" "}
              {importResult.run_id}
            </p>
            <p>
              <span className="text-muted-foreground">Best output dir:</span>{" "}
              {importResult.best_output_dir ?? "Not found"}
            </p>
            <p>
              <span className="text-muted-foreground">Missing required:</span>{" "}
              {importResult.artifacts?.missing_required?.length
                ? importResult.artifacts.missing_required.join(", ")
                : "None"}
            </p>
            <p>
              <span className="text-muted-foreground">Missing optional:</span>{" "}
              {importResult.artifacts?.missing_optional?.length
                ? importResult.artifacts.missing_optional.join(", ")
                : "None"}
            </p>
          </div>
        )}
      </div>

      <div className="glass-card p-6 space-y-5">
        <h3 className="font-heading font-semibold">Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["Dataset Audit Only", "Run Diagnosis", "Full Pipeline"] as WorkflowMode[]).map(
            (mode) => {
              const active = workflow === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkflow(mode)}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/60"
                  }`}
                >
                  <p className="font-medium text-foreground text-sm">{mode}</p>
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h3 className="font-heading font-semibold">Dataset Inputs</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Image Folder</Label>
            <div className="flex gap-2">
              <Input
                value={imageDir}
                onChange={(e) => setImageDir(e.target.value)}
                placeholder="C:/path/to/images"
                className="bg-secondary border-border"
              />
              <Button variant="outline" size="icon" type="button">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Annotation Type</Label>
            <Select
              value={annotationType}
              onValueChange={(value) =>
                setAnnotationType(value as AnnotationType)
              }
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COCO JSON">COCO JSON</SelectItem>
                <SelectItem value="Mask folder">Mask Folder</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {annotationType === "COCO JSON" ? (
          <div className="space-y-2">
            <Label>COCO JSON Path</Label>
            <Input
              value={cocoJsonPath}
              onChange={(e) => setCocoJsonPath(e.target.value)}
              placeholder="C:/path/to/annotations.json"
              className="bg-secondary border-border"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Mask Folder</Label>
            <Input
              value={maskDir}
              onChange={(e) => setMaskDir(e.target.value)}
              placeholder="C:/path/to/masks"
              className="bg-secondary border-border"
            />
          </div>
        )}
      </div>

      <div className="glass-card p-6 space-y-4">
        <h3 className="font-heading font-semibold">Training Controls</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={modelName}
              onValueChange={(value) => setModelName(value as ModelName)}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unet">UNet</SelectItem>
                <SelectItem value="deeplabv3plus">DeepLabV3+</SelectItem>
                <SelectItem value="segformer">SegFormer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Image Size</Label>
            <Input
              type="number"
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Batch Size</Label>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Epochs</Label>
            <Input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Learning Rate</Label>
            <Input
              type="number"
              step={0.00001}
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Patience</Label>
            <Input
              type="number"
              value={patience}
              onChange={(e) => setPatience(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2 flex flex-col justify-end">
            <Label>AMP Mixed Precision</Label>
            <Switch checked={useAmp} onCheckedChange={setUseAmp} />
          </div>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-heading font-semibold">Pipeline Status</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Current run ID: {runId ?? "None"}
            </p>
          </div>
          {renderStatusBadge()}
        </div>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Message:</span>{" "}
            {status?.message ?? "No status yet"}
          </p>
          <p>
            <span className="text-muted-foreground">Updated:</span>{" "}
            {status?.updated_at ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Progress:</span>{" "}
            {status?.progress != null
              ? `${Math.round(Number(status.progress) * 100)}%`
              : "-"}
          </p>
        </div>

        {status?.progress != null && (
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, Number(status.progress) * 100),
                )}%`,
              }}
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Button
          size="lg"
          className="gap-2 w-full md:w-auto"
          onClick={handleStart}
          disabled={isStarting}
        >
          <Play className="h-4 w-4" />
          {isStarting ? "Starting..." : "Run Pipeline"}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="gap-2 w-full md:w-auto"
          onClick={handleStop}
          disabled={
            !runId ||
            isStopping ||
            ["stop_requested", "stopped", "completed", "failed", "imported"].includes(
              currentStage,
            ) ||
            !isRunning
          }
        >
          <Square className="h-4 w-4" />
          {isStopping ? "Stopping..." : "Stop Pipeline"}
        </Button>
      </div>
    </motion.div>
  );
}