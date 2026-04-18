import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  BadgeAlert,
  Filter,
  ImageOff,
  ShieldAlert,
} from "lucide-react";

import { FindingCard } from "@/components/FindingCard";
import { ClassFilter } from "@/components/ClassFilter";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FailureTypeBadge } from "@/components/FailureTypeBadge";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import { getDiagnosis, getFailureGroups, getRunArtifacts } from "@/api/traindoctor";
import type {
  DiagnosisResponse,
  FailureGroupsResponse,
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

const tooltipStyle = {
  background: "hsl(0 0% 14%)",
  border: "1px solid hsl(0 0% 20%)",
  borderRadius: 8,
  color: "hsl(0 0% 92%)",
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatMetric(value: number | null, digits = 3) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function getFailureFill(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("noise")) return "hsl(14 78% 57%)";
  if (lower.includes("snow")) return "hsl(0 0% 70%)";
  if (lower.includes("sky") || lower.includes("water")) return "hsl(200 70% 50%)";
  if (lower.includes("low light")) return "hsl(38 92% 50%)";
  return "hsl(142 71% 45%)";
}

export default function DiagnosisPage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const [confidenceFilter, setConfidenceFilter] = useState<
    Array<"High" | "Medium" | "Low">
  >(["High", "Medium", "Low"]);

  const artifactsQuery = useQuery({
    queryKey: ["diagnosis-artifacts", runId],
    queryFn: async () => {
      const res = await getRunArtifacts(runId!);
      return res.data as RunArtifactsResponse;
    },
    enabled: !!runId,
  });

  const diagnosisQuery = useQuery({
    queryKey: ["diagnosis-page", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getDiagnosis(runId!, classesHook.selectedClassIds);
      return res.data as DiagnosisResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const failureGroupsQuery = useQuery({
    queryKey: ["diagnosis-failure-groups", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getFailureGroups(runId!, classesHook.selectedClassIds);
      return res.data as FailureGroupsResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const findings = diagnosisQuery.data?.findings ?? [];
  const labelNoise = diagnosisQuery.data?.label_noise ?? [];
  const imbalance = diagnosisQuery.data?.imbalance ?? [];
  const failureGroups = failureGroupsQuery.data?.failure_groups ?? [];
  const worstImages = failureGroupsQuery.data?.worst_images ?? [];

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => confidenceFilter.includes(f.confidence));
  }, [findings, confidenceFilter]);

  const highCount = findings.filter((f) => f.confidence === "High").length;
  const mediumCount = findings.filter((f) => f.confidence === "Medium").length;
  const lowCount = findings.filter((f) => f.confidence === "Low").length;

  const topWorstImages = worstImages.slice(0, 10);

  const warnings = [
    ...(artifactsQuery.data?.missing_required ?? []).map(
      (name) => `Required file missing: ${name}`,
    ),
    ...(diagnosisQuery.data?.warning ? [diagnosisQuery.data.warning] : []),
    ...(failureGroupsQuery.data?.warning ? [failureGroupsQuery.data.warning] : []),
  ];

  const uniqueWarnings = [...new Set(warnings)];

  const pageLoading =
    artifactsQuery.isLoading ||
    diagnosisQuery.isLoading ||
    failureGroupsQuery.isLoading;

  const toggleConfidence = (level: "High" | "Medium" | "Low") => {
    setConfidenceFilter((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== level);
      }
      return [...prev, level];
    });
  };

  if (!runId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Diagnosis</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Detailed findings and failure patterns
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
          <h2 className="text-2xl font-heading font-bold">Diagnosis</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Loading diagnosis data...
          </p>
        </div>

        <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
        <div className="glass-card p-6 h-72 animate-pulse bg-secondary/30" />
        <div className="glass-card p-6 h-72 animate-pulse bg-secondary/30" />
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
        <h2 className="text-2xl font-heading font-bold">Diagnosis</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Detailed findings and failure patterns
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
            <BadgeAlert className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Confidence Counts</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => toggleConfidence("High")}
              className={`rounded-xl border p-4 text-left ${
                confidenceFilter.includes("High")
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-border/50 bg-secondary/20"
              }`}
            >
              <p className="text-2xl font-bold text-foreground">{highCount}</p>
              <p className="text-xs text-muted-foreground mt-1">High</p>
            </button>

            <button
              type="button"
              onClick={() => toggleConfidence("Medium")}
              className={`rounded-xl border p-4 text-left ${
                confidenceFilter.includes("Medium")
                  ? "border-warning/40 bg-warning/10"
                  : "border-border/50 bg-secondary/20"
              }`}
            >
              <p className="text-2xl font-bold text-foreground">{mediumCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Medium</p>
            </button>

            <button
              type="button"
              onClick={() => toggleConfidence("Low")}
              className={`rounded-xl border p-4 text-left ${
                confidenceFilter.includes("Low")
                  ? "border-border bg-secondary/30"
                  : "border-border/50 bg-secondary/20"
              }`}
            >
              <p className="text-2xl font-bold text-foreground">{lowCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Low</p>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Noise Flags</h3>
          </div>

          <p className="text-4xl font-bold text-foreground">
            {labelNoise.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Suspicious images flagged as possible label noise or highly difficult samples
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Imbalance Findings</h3>
          </div>

          <p className="text-4xl font-bold text-foreground">
            {imbalance.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Class-balance issues detected within the selected class set
          </p>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <BadgeAlert className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Top Findings</h3>
          </div>

          <div className="space-y-4">
            {filteredFindings.length > 0 ? (
              filteredFindings.slice(0, 8).map((finding, i) => (
                <FindingCard
                  key={`${finding.issue}-${i}`}
                  type={finding.type}
                  issue={finding.issue}
                  evidence={finding.evidence}
                  confidence={finding.confidence}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
                No findings match the current confidence filter.
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <ImageOff className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Failure Groups</h3>
          </div>

          {failureGroups.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={failureGroups}>
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="failure_type"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-10}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {failureGroups.map((entry, i) => (
                    <Cell key={i} fill={getFailureFill(entry.failure_type)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
              Failure-group data is not available.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Label Noise Examples</h3>
          </div>

          {labelNoise.length > 0 ? (
            <div className="space-y-3">
              {labelNoise.slice(0, 8).map((row, i) => {
                const imageName = String(row.image_name ?? "Unknown image");
                const issue = String(
                  row.possible_issue ?? "Possible label noise or highly difficult sample",
                );
                const evidence = String(row.evidence ?? "");
                const confidence =
                  (String(row.confidence ?? "Low") as "High" | "Medium" | "Low");

                return (
                  <div
                    key={`${imageName}-${i}`}
                    className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {imageName}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {issue}
                        </p>
                        <p className="text-sm text-muted-foreground">{evidence}</p>
                      </div>
                      <ConfidenceBadge confidence={confidence} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
              No label-noise examples available.
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <ImageOff className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Worst Images</h3>
          </div>

          {topWorstImages.length > 0 ? (
            <div className="space-y-3">
              {topWorstImages.map((row, i) => (
                <div
                  key={`${row.image_name}-${i}`}
                  className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">
                        {row.image_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <FailureTypeBadge label={row.failure_type} />
                        <span className="text-xs text-muted-foreground">
                          IoU: {formatMetric(asNumber(row.mean_iou))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Dice: {formatMetric(asNumber(row.mean_dice))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
              Worst-image details are not available.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}