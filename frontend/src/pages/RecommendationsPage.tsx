import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileJson,
  Lightbulb,
  Search,
  Settings2,
} from "lucide-react";

import { ClassFilter } from "@/components/ClassFilter";
import { JsonBlock } from "@/components/JsonBlock";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import { getRecommendations, getRunArtifacts } from "@/api/traindoctor";
import type {
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

  const recommendations = recommendationsQuery.data?.recommendations ?? [];
  const suggestedConfig = recommendationsQuery.data?.suggested_config ?? {};
  const notes = recommendationsQuery.data?.notes ?? [];

  const filteredRecommendations = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return recommendations;

    return recommendations.filter((row) =>
      String(row.recommendation ?? "")
        .toLowerCase()
        .includes(text),
    );
  }, [recommendations, searchText]);

  const filteredNotes = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return notes;

    return notes.filter((note) => note.toLowerCase().includes(text));
  }, [notes, searchText]);

  const warnings = [
    ...(artifactsQuery.data?.missing_required ?? []).map(
      (name) => `Required file missing: ${name}`,
    ),
    ...(recommendationsQuery.data?.warning ? [recommendationsQuery.data.warning] : []),
  ];

  const uniqueWarnings = [...new Set(warnings)];

  const pageLoading =
    artifactsQuery.isLoading ||
    recommendationsQuery.isLoading;

  const suggestedConfigKeys = Object.keys(suggestedConfig);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass-card p-6 h-80 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-80 animate-pulse bg-secondary/30" />
        </div>
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

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Recommendations</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {filteredRecommendations.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Actionable items for the selected class set
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Backend Notes</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {filteredNotes.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Reasoning notes used to build the next config
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileJson className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Config Fields</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {suggestedConfigKeys.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Keys included in the generated next-run config
          </p>
        </div>
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
          <JsonBlock value={suggestedConfig} />
        ) : (
          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
            No generated config is available for this run.
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Quick Config Summary</h3>
        </div>

        {suggestedConfigKeys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suggestedConfigKeys.map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {key}
                </p>
                <p className="text-sm text-foreground break-words">
                  {typeof suggestedConfig[key] === "object"
                    ? JSON.stringify(suggestedConfig[key])
                    : String(suggestedConfig[key])}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
            No config fields available.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}