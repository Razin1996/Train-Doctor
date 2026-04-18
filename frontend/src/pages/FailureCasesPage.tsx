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
  Search,
  Filter,
  ImageOff,
  ShieldAlert,
} from "lucide-react";

import { ClassFilter } from "@/components/ClassFilter";
import { FailureTypeBadge } from "@/components/FailureTypeBadge";
import { FailureTypeSelect } from "@/components/FailureTypeSelect";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import {
  getDiagnosis,
  getFailureGroups,
  getRunArtifacts,
} from "@/api/traindoctor";
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
  borderRadius: 10,
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
  if (lower.includes("noise")) return "#cf4438";
  if (lower.includes("snow")) return "#8f959c";
  if (lower.includes("sky") || lower.includes("water")) return "#4ba3ff";
  if (lower.includes("low light")) return "#e2a93b";
  return "#76c26a";
}

function getMetricTextClass(value: number | null) {
  if (value === null) return "text-muted-foreground";
  if (value < 0.25) return "text-destructive";
  if (value < 0.5) return "text-warning";
  return "text-green-500";
}

function buildFailureAvgIoU(
  failureGroups: { failure_type: string; count: number; avg_iou?: number }[],
  worstImages: { failure_type: string; mean_iou: number }[],
) {
  return failureGroups.map((group) => {
    let avg = asNumber(group.avg_iou);

    if (avg === null) {
      const matches = worstImages.filter(
        (img) => img.failure_type === group.failure_type,
      );
      if (matches.length > 0) {
        avg =
          matches.reduce((sum, row) => sum + (asNumber(row.mean_iou) ?? 0), 0) /
          matches.length;
      }
    }

    return {
      failure_type: group.failure_type,
      avg_iou: avg ?? 0,
    };
  });
}

export default function FailureCasesPage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const [selectedFailureType, setSelectedFailureType] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const artifactsQuery = useQuery({
    queryKey: ["failure-cases-artifacts", runId],
    queryFn: async () => {
      const res = await getRunArtifacts(runId!);
      return res.data as RunArtifactsResponse;
    },
    enabled: !!runId,
  });

  const diagnosisQuery = useQuery({
    queryKey: ["failure-cases-diagnosis", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getDiagnosis(runId!, classesHook.selectedClassIds);
      return res.data as DiagnosisResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const failureGroupsQuery = useQuery({
    queryKey: ["failure-cases-groups", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getFailureGroups(runId!, classesHook.selectedClassIds);
      return res.data as FailureGroupsResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const failureGroups = failureGroupsQuery.data?.failure_groups ?? [];
  const worstImages = failureGroupsQuery.data?.worst_images ?? [];
  const labelNoise = diagnosisQuery.data?.label_noise ?? [];

  const failureAvgIoU = buildFailureAvgIoU(failureGroups, worstImages);

  const filteredWorstImages = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return [...worstImages]
      .filter((row) => {
        const matchesType =
          selectedFailureType === "ALL" ||
          row.failure_type === selectedFailureType;

        const matchesText =
          !text ||
          row.image_name.toLowerCase().includes(text) ||
          row.failure_type.toLowerCase().includes(text);

        return matchesType && matchesText;
      })
      .sort((a, b) => (asNumber(a.mean_iou) ?? 999) - (asNumber(b.mean_iou) ?? 999));
  }, [worstImages, selectedFailureType, searchText]);

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

  if (!runId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Failure Cases</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Worst-performing images grouped by failure type
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
          <h2 className="text-2xl font-heading font-bold">Failure Cases</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Loading failure-case data...
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass-card p-6 h-72 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-72 animate-pulse bg-secondary/30" />
        </div>
        <div className="glass-card p-6 h-[440px] animate-pulse bg-secondary/30" />
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
        <h2 className="text-2xl font-heading font-bold">Failure Cases</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Worst-performing images grouped by failure type
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
            <ImageOff className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Worst Images</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {filteredWorstImages.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Filtered image-level failure cases
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Noise Candidates</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {labelNoise.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Samples flagged by diagnosis as suspicious
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Failure Groups</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {failureGroups.length}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Distinct grouped failure categories
          </p>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <h3 className="font-heading font-semibold mb-4">Failure Group Distribution</h3>

          {failureGroups.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={failureGroups}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 35, bottom: 8 }}
              >
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="failure_type"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={125}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {failureGroups.map((entry, i) => (
                    <Cell key={i} fill={getFailureFill(entry.failure_type)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              Failure-group data is not available.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <h3 className="font-heading font-semibold mb-4">Avg IoU by Failure Type</h3>

          {failureAvgIoU.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={failureAvgIoU}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 35, bottom: 8 }}
              >
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="failure_type"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={125}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avg_iou" radius={[0, 8, 8, 0]}>
                  {failureAvgIoU.map((entry, i) => (
                    <Cell key={i} fill={getFailureFill(entry.failure_type)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              Average IoU data is not available.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
          <h3 className="font-heading font-semibold">Image-Level Results</h3>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search image or failure type..."
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/30 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:bg-secondary/40"
              />
            </div>

            <FailureTypeSelect
              value={selectedFailureType}
              options={failureGroups.map((group) => group.failure_type)}
              onChange={setSelectedFailureType}
              allLabel="All Failure Types"
            />
          </div>
        </div>

        {filteredWorstImages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-muted-foreground">
                  <th className="pb-4 pr-4 font-medium">Image</th>
                  <th className="pb-4 pr-4 font-medium">Mean IoU</th>
                  <th className="pb-4 pr-4 font-medium">Mean Dice</th>
                  <th className="pb-4 pr-4 font-medium">Failure Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorstImages.slice(0, 40).map((row, i) => {
                  const meanIoU = asNumber(row.mean_iou);
                  const meanDice = asNumber(row.mean_dice);

                  return (
                    <tr
                      key={`${row.image_name}-${i}`}
                      className="border-b border-border/20 align-top transition-colors hover:bg-secondary/20"
                    >
                      <td className="py-4 pr-4 text-foreground font-medium">
                        {row.image_name}
                      </td>
                      <td className={`py-4 pr-4 font-semibold ${getMetricTextClass(meanIoU)}`}>
                        {formatMetric(meanIoU)}
                      </td>
                      <td className="py-4 pr-4 text-foreground">
                        {formatMetric(meanDice)}
                      </td>
                      <td className="py-4 pr-4">
                        <FailureTypeBadge label={row.failure_type} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-sm text-muted-foreground">
            No image-level failure cases found for the current filters.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}