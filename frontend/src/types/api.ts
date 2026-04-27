export type PipelineStatus = {
  run_id: string;
  stage: string;
  message: string;
  progress?: number | null;
  updated_at?: string | null;
  extra?: Record<string, unknown>;
};

export type RunListItem = {
  run_id: string;
  status: string;
  message?: string | null;
  progress?: number | null;
  best_output_dir?: string | null;
  updated_at?: string | null;
};

export type RunsListResponse = {
  runs: RunListItem[];
};

export type RunSummaryResponse = {
  run_id: string;
  status: string;
  best_output_dir?: string | null;
  summary?: Record<string, unknown>;
};

export type RunArtifactsResponse = {
  run_id: string;
  source_root?: string | null;
  best_output_dir?: string | null;
  available: Record<string, string>;
  missing_required: string[];
  missing_optional: string[];
};

export type RunClassInfo = {
  class_id: number;
  class_name: string;
};

export type RunClassesResponse = {
  run_id: string;
  source: string;
  classes: RunClassInfo[];
};

export type TrainLogRow = Record<string, unknown>;

export type TrainLogResponse = {
  run_id: string;
  train_log: TrainLogRow[];
};

export type IterationSummaryItem = {
  iteration: number;
  output_dir?: string;
  mean_iou?: number;
  mean_dice?: number;
  health_score?: number;
  issues?: string[];
  best_val_iou?: number;
};

export type IterationsResponse = {
  iterations: IterationSummaryItem[];
};

export type ClassBalanceRow = Record<string, unknown>;

export type ClassBalanceResponse = {
  run_id: string;
  class_balance: ClassBalanceRow[];
  missing: boolean;
  path?: string | null;
};

export type TestMetricsResponse = {
  run_id: string;
  test_metrics: Array<Record<string, unknown>>;
};

export type DiagnosisFinding = {
  type: string;
  issue: string;
  evidence: string;
  confidence: "High" | "Medium" | "Low";
  confidence_score?: number;
};

export type DiagnosisResponse = {
  run_id: string;
  health_score: number;
  findings: DiagnosisFinding[];
  label_noise: Array<Record<string, unknown>>;
  imbalance: Array<Record<string, unknown>>;
  warning?: string | null;
  artifacts?: RunArtifactsResponse;
  selected_class_ids?: number[];
  selected_class_names?: string[];
};

export type FailureGroupItem = {
  failure_type: string;
  count: number;
  avg_iou?: number;
};

export type WorstImageItem = {
  image_name: string;
  mean_iou: number;
  mean_dice: number;
  failure_type: string;
};

export type FailureGroupsResponse = {
  run_id: string;
  failure_groups: FailureGroupItem[];
  worst_images: WorstImageItem[];
  warning?: string | null;
  artifacts?: RunArtifactsResponse;
  selected_class_ids?: number[];
  selected_class_names?: string[];
};

export type RecommendationsResponse = {
  run_id: string;
  recommendations: Array<{ recommendation: string }>;
  suggested_config: Record<string, unknown>;
  notes: string[];
  warning?: string | null;
  artifacts?: RunArtifactsResponse;
  selected_class_ids?: number[];
  selected_class_names?: string[];
};

export type LLMEvaluation = {
  relevance: number;
  faithfulness: number;
  actionability: number;
  clarity: number;
  safety: number;
  overall_score: number;
  interpretation: string;
  method: string;
  human_review_required: boolean;
};

export type ExplanationResponse = {
  run_id: string;
  backend: "rule_based" | "ollama" | "openai";
  explanation: string;
  suggested_config?: Record<string, unknown>;
  recommendations?: Array<{ recommendation: string }>;
  notes?: string[];
  warning?: string | null;
  selected_class_ids?: number[];
  selected_class_names?: string[];
  llm_evaluation?: LLMEvaluation;
};