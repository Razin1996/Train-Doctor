import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FindingCard } from "@/components/FindingCard";
import { ClassFilter } from "@/components/ClassFilter";
import { Badge } from "@/components/ui/badge";
import { getDiagnosis } from "@/api/traindoctor";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import type { DiagnosisResponse } from "@/types/api";

export default function DiagnosisPage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);
  const [filter, setFilter] = useState<string[]>(["High", "Medium", "Low"]);

  const diagnosisQuery = useQuery({
    queryKey: ["diagnosis-page", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getDiagnosis(runId!, classesHook.selectedClassIds);
      return res.data as DiagnosisResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const findings = diagnosisQuery.data?.findings ?? [];

  const toggleConfidence = (level: string) => {
    setFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  const filtered = findings.filter((f) => filter.includes(f.confidence));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Diagnosis</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Detailed findings from automated analysis
        </p>
      </div>

      <ClassFilter
        classes={classesHook.classes}
        selectedClassIds={classesHook.selectedClassIds}
        onToggle={classesHook.toggleClass}
        onSelectAll={classesHook.selectAll}
      />

      <div className="flex gap-2 flex-wrap">
        {(["High", "Medium", "Low"] as const).map((level) => (
          <button
            key={level}
            onClick={() => toggleConfidence(level)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter.includes(level)
                ? level === "High"
                  ? "bg-destructive/20 text-destructive border border-destructive/40"
                  : level === "Medium"
                    ? "bg-warning/20 text-warning border border-warning/40"
                    : "bg-muted text-muted-foreground border border-border"
                : "bg-secondary/30 text-muted-foreground border border-transparent"
            }`}
          >
            {level}
            <Badge variant="secondary" className="ml-2 text-xs">
              {findings.filter((f) => f.confidence === level).length}
            </Badge>
          </button>
        ))}
      </div>

      {diagnosisQuery.data?.warning && (
        <div className="glass-card p-4 text-sm text-muted-foreground">
          {diagnosisQuery.data.warning}
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-success font-medium">No findings match the current filter.</p>
          </div>
        ) : (
          filtered.map((f, i) => (
            <motion.div
              key={`${f.issue}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <FindingCard {...f} />
            </motion.div>
          ))
        )}
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold mb-3">Finding Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-destructive/10">
            <p className="text-2xl font-heading font-bold text-destructive">
              {findings.filter((f) => f.confidence === "High").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">High Confidence</p>
          </div>
          <div className="p-4 rounded-lg bg-warning/10">
            <p className="text-2xl font-heading font-bold text-warning">
              {findings.filter((f) => f.confidence === "Medium").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Medium Confidence</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-2xl font-heading font-bold text-muted-foreground">
              {findings.filter((f) => f.confidence === "Low").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Low Confidence</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}