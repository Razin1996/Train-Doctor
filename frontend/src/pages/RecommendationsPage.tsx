import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Download,
  FileJson,
  Lightbulb,
  Search,
  Wand2,
} from "lucide-react";

import { ClassFilter } from "@/components/ClassFilter";
import { JsonBlock } from "@/components/JsonBlock";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import {
  generateExplanation,
  getRecommendations,
  getRunArtifacts,
} from "@/api/traindoctor";
import type {
  ExplanationResponse,
  RecommendationsResponse,
  RunArtifactsResponse,
} from "@/types/api";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function RecommendationsPage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const [searchText, setSearchText] = useState("");

  const [explanationBackend, setExplanationBackend] = useState<
    "rule_based" | "ollama" | "openai"
  >("rule_based");

  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
  const [openaiModel, setOpenaiModel] = useState("gpt-5.4-mini");
  const [openaiApiKey, setOpenaiApiKey] = useState("");

  const artifactsQuery = useQuery({
    queryKey: ["recommendations-artifacts", runId],
    queryFn: async () => {
      const res = await getRunArtifacts(runId!);
      return res.data as RunArtifactsResponse;
    },
    enabled: !!runId,
  });

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations-page", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getRecommendations(runId!, classesHook.selectedClassIds);
      return res.data as RecommendationsResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const explanationMutation = useMutation({
    mutationFn: async () => {
      if (!runId) throw new Error("No run selected");

      const payload: {
        backend: "rule_based" | "ollama" | "openai";
        ollama_url?: string;
        ollama_model?: string;
        openai_model?: string;
        openai_api_key?: string;
        include_class_ids?: number[];
      } = {
        backend: explanationBackend,
        include_class_ids: classesHook.selectedClassIds,
      };

      if (explanationBackend === "ollama") {
        payload.ollama_url = ollamaUrl;
        payload.ollama_model = ollamaModel;
      }

      if (explanationBackend === "openai") {
        payload.openai_model = openaiModel;
        payload.openai_api_key = openaiApiKey;
      }

      const res = await generateExplanation(runId, payload);
      return res.data as ExplanationResponse;
    },
  });

  const activeRecommendations =
    explanationMutation.data?.recommendations?.length
      ? explanationMutation.data.recommendations
      : recommendationsQuery.data?.recommendations ?? [];

  const activeNotes =
    explanationMutation.data?.notes?.length
      ? explanationMutation.data.notes
      : recommendationsQuery.data?.notes ?? [];

  const activeSuggestedConfig =
    explanationMutation.data?.suggested_config &&
    Object.keys(explanationMutation.data.suggested_config).length > 0
      ? explanationMutation.data.suggested_config
      : recommendationsQuery.data?.suggested_config ?? {};

  const filteredRecommendations = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return activeRecommendations;

    return activeRecommendations.filter((row) =>
      String(row.recommendation ?? "").toLowerCase().includes(text),
    );
  }, [activeRecommendations, searchText]);

  const filteredNotes = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return activeNotes;

    return activeNotes.filter((note) => note.toLowerCase().includes(text));
  }, [activeNotes, searchText]);

  const warnings = [
    ...(artifactsQuery.data?.missing_required ?? []).map(
      (name) => `Required file missing: ${name}`,
    ),
    ...(recommendationsQuery.data?.warning ? [recommendationsQuery.data.warning] : []),
    ...(explanationMutation.data?.warning ? [explanationMutation.data.warning] : []),
  ];

  const uniqueWarnings = [...new Set(warnings)];

  const pageLoading =
    artifactsQuery.isLoading ||
    recommendationsQuery.isLoading;

  const suggestedConfigKeys = Object.keys(activeSuggestedConfig || {});

  const handleDownloadExplanation = () => {
    const explanation = explanationMutation.data?.explanation;
    if (!explanation) return;

    const blob = new Blob([explanation], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `explanation_${runId || "run"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const handleDownloadConfig = () => {
    if (!activeSuggestedConfig || Object.keys(activeSuggestedConfig).length === 0) return;

    const blob = new Blob(
      [JSON.stringify(activeSuggestedConfig, null, 2)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `suggested_config_${runId || "run"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  if (!runId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Recommendations</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Suggested next actions and generated configuration
          </p>
        </div>

        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No run selected yet.
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Recommendations</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Loading recommendation data...
          </p>
        </div>

        <div className="glass-card p-6 h-[420px] animate-pulse bg-secondary/30" />
        <div className="glass-card p-6 h-80 animate-pulse bg-secondary/30" />
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-heading font-bold">Recommendations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Suggested next actions and generated configuration
        </p>
      </div>

      <ClassFilter
        classes={classesHook.classes}
        selectedClassIds={classesHook.selectedClassIds}
        onToggle={classesHook.toggleClass}
        onSelectAll={classesHook.selectAll}
      />

      {uniqueWarnings.length > 0 && (
        <motion.div variants={item} className="glass-card p-5 border border-warning/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="font-heading font-semibold">Available with partial data</h3>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {uniqueWarnings.map((warning, index) => (
              <p key={`${warning}-${index}`}>• {warning}</p>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <h3 className="font-heading font-semibold mb-3">Explanation Engine</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Generate an explanation and updated suggested config for the currently selected classes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <button
            type="button"
            onClick={() => setExplanationBackend("rule_based")}
            className={`rounded-2xl border p-4 text-left transition ${
              explanationBackend === "rule_based"
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-secondary/20 hover:bg-secondary/30"
            }`}
          >
            <p className="font-medium text-foreground">Rule-based</p>
            <p className="text-xs text-muted-foreground mt-1">
              Default mode using structured findings
            </p>
          </button>

          <button
            type="button"
            onClick={() => setExplanationBackend("ollama")}
            className={`rounded-2xl border p-4 text-left transition ${
              explanationBackend === "ollama"
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-secondary/20 hover:bg-secondary/30"
            }`}
          >
            <p className="font-medium text-foreground">Ollama</p>
            <p className="text-xs text-muted-foreground mt-1">
              Local model using Ollama endpoint
            </p>
          </button>

          <button
            type="button"
            onClick={() => setExplanationBackend("openai")}
            className={`rounded-2xl border p-4 text-left transition ${
              explanationBackend === "openai"
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-secondary/20 hover:bg-secondary/30"
            }`}
          >
            <p className="font-medium text-foreground">ChatGPT / OpenAI</p>
            <p className="text-xs text-muted-foreground mt-1">
              Requires API key and model
            </p>
          </button>
        </div>

        {explanationBackend === "ollama" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Ollama URL
              </label>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                placeholder="http://localhost:11434"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Ollama Model
              </label>
              <input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                placeholder="llama3.1:8b"
              />
            </div>
          </div>
        )}

        {explanationBackend === "openai" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                OpenAI Model
              </label>
              <input
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                placeholder="gpt-5.4-mini"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <button
            type="button"
            onClick={() => explanationMutation.mutate()}
            disabled={
              explanationMutation.isPending ||
              !runId ||
              (explanationBackend === "openai" && !openaiApiKey.trim())
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#cf7047] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            {explanationMutation.isPending ? "Generating..." : "Generate Explanation"}
          </button>

          <button
            type="button"
            onClick={handleDownloadExplanation}
            disabled={!explanationMutation.data?.explanation}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/20 px-5 py-3 text-sm font-medium text-foreground transition hover:bg-secondary/30 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Explanation
          </button>

          <button
            type="button"
            onClick={handleDownloadConfig}
            disabled={!activeSuggestedConfig || Object.keys(activeSuggestedConfig).length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/20 px-5 py-3 text-sm font-medium text-foreground transition hover:bg-secondary/30 disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" />
            Download Suggested Config
          </button>
        </div>

        {explanationMutation.data?.explanation && (
          <div className="rounded-2xl border border-border/60 bg-secondary/20 p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
              Generated Explanation ({explanationMutation.data.backend})
            </p>

            <div className="prose prose-invert max-w-none prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-headings:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {explanationMutation.data.explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-heading font-semibold">Search</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Filter recommendations and notes
            </p>
          </div>

          <div className="relative w-full lg:w-[340px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search recommendations..."
              className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/30 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:bg-secondary/40"
            />
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Recommended Actions</h3>
          </div>

          {filteredRecommendations.length > 0 ? (
            <div className="space-y-3">
              {filteredRecommendations.map((row, i) => (
                <div
                  key={`${row.recommendation}-${i}`}
                  className="rounded-2xl border border-border/50 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl border border-primary/20 bg-primary/10 p-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {row.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
              No recommendations match the current search.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Why This Was Suggested</h3>
          </div>

          {filteredNotes.length > 0 ? (
            <div className="space-y-3">
              {filteredNotes.map((note, i) => (
                <div
                  key={`${note}-${i}`}
                  className="rounded-2xl border border-border/50 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl border border-primary/20 bg-primary/10 p-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
              No backend notes available for the current search.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Suggested Next Config</h3>
        </div>

        {suggestedConfigKeys.length > 0 ? (
          <JsonBlock value={activeSuggestedConfig} />
        ) : (
          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
            No generated config is available for this run.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}