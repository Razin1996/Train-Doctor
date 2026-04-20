import { api } from "@/api/client";

export const startPipeline = (data: any) => api.post("/pipeline/start", data);

export const getPipelineStatus = (runId: string) =>
  api.get(`/pipeline/${runId}/status`);

export const stopPipeline = (runId: string) =>
  api.post(`/pipeline/${runId}/stop`);

export const listRuns = () => api.get("/runs");

export const importExistingRun = (directoryPath: string, runId?: string) =>
  api.post("/runs/import-existing", {
    directory_path: directoryPath,
    run_id: runId || null,
  });

export const getRunSummary = (runId: string) =>
  api.get(`/runs/${runId}/summary`);

export const getRunArtifacts = (runId: string) =>
  api.get(`/runs/${runId}/artifacts`);

export const getRunClasses = (runId: string) =>
  api.get(`/runs/${runId}/classes`);

export const getClassBalance = (runId: string) =>
  api.get(`/runs/${runId}/class-balance`);

export const getTrainLog = (runId: string) =>
  api.get(`/runs/${runId}/train-log`);

export const getTestMetrics = (runId: string) =>
  api.get(`/runs/${runId}/test-metrics`);

export const getPerImageMetrics = (runId: string) =>
  api.get(`/runs/${runId}/per-image`);

export const getIterations = (runId: string) =>
  api.get(`/runs/${runId}/iterations`);

export const getDiagnosis = (runId: string, includeClassIds?: number[]) =>
  api.get(`/runs/${runId}/diagnosis`, {
    params: includeClassIds?.length
      ? { include_class_ids: includeClassIds.join(",") }
      : {},
  });

export const getRecommendations = (runId: string, includeClassIds?: number[]) =>
  api.get(`/runs/${runId}/recommendations`, {
    params: includeClassIds?.length
      ? { include_class_ids: includeClassIds.join(",") }
      : {},
  });

export const getFailureGroups = (runId: string, includeClassIds?: number[]) =>
  api.get(`/runs/${runId}/failure-groups`, {
    params: includeClassIds?.length
      ? { include_class_ids: includeClassIds.join(",") }
      : {},
  });

export const compareRuns = (runA: string, runB: string) =>
  api.get("/compare", {
    params: { run_a: runA, run_b: runB },
  });

export const reconstructMissingArtifacts = (runId: string) =>
  api.post(`/runs/${runId}/reconstruct-missing`);

export const generateExplanation = (
  runId: string,
  payload: {
    backend: "rule_based" | "ollama" | "openai";
    ollama_url?: string;
    ollama_model?: string;
    openai_model?: string;
    openai_api_key?: string;
    include_class_ids?: number[];
  },
) =>
  api.post(`/runs/${runId}/explanation`, payload);