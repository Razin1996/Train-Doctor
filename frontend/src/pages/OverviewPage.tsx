import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { FindingCard } from "@/components/FindingCard";
import { ClassFilter } from "@/components/ClassFilter";
import {
  getClassBalance,
  getDiagnosis,
  getFailureGroups,
  getRunArtifacts,
  getRunSummary,
  getTestMetrics,
  reconstructMissingArtifacts,
} from "@/api/traindoctor";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import type {
  ClassBalanceResponse,
  DiagnosisResponse,
  FailureGroupsResponse,
  RunArtifactsResponse,
  RunSummaryResponse,
  TestMetricsResponse,
} from "@/types/api";
import {
  Images,
  Target,
  Hexagon,
  Activity,
  BarChart3,
  AlertTriangle,
  FolderSearch,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const HEALTH_THRESHOLD = 75; // you can adjust

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

function buildFilteredClasswiseIoU(
  record: Record<string, unknown> | null | undefined,
  selectedClassNames: string[],
) {
  if (!record) return [];

  return selectedClassNames
    .map((className) => ({
      className,
      iou: asNumber(record[`${className}_iou_mean`]) ?? null,
      dice: asNumber(record[`${className}_dice_mean`]) ?? null,
    }))
    .filter((row) => row.iou !== null);
}

function buildClassBalanceChart(
  rows: Record<string, unknown>[],
  selectedClassNames: string[],
) {
  const allowed = new Set(selectedClassNames);
  return rows
    .map((row) => {
      const className =
        (typeof row.class_name === "string" && row.class_name) ||
        (typeof row.class_id === "number" ? `class_${row.class_id}` : "unknown");

      const pixelFraction =
        asNumber(row.pixel_fraction) ??
        asNumber(row.fraction) ??
        asNumber(row.percent_pixels);

      return {
        class_name: className,
        pixel_fraction: pixelFraction,
      };
    })
    .filter((row) => row.pixel_fraction !== null)
    .filter((row) => allowed.has(row.class_name));
}

function averageSelectedMetric(
  record: Record<string, unknown> | null | undefined,
  selectedClassNames: string[],
  suffix: "iou_mean" | "dice_mean",
) {
  if (!record || selectedClassNames.length === 0) return null;
  const values = selectedClassNames
    .map((name) => asNumber(record[`${name}_${suffix}`]))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function OverviewPage() {
  const { runId, runs, isLoading: runsLoading } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const selectedClassNames = classesHook.selectableClasses
    .filter((c) => classesHook.selectedClassIds.includes(c.class_id))
    .map((c) => c.class_name);

  const summaryQuery = useQuery({
    queryKey: ["run-summary", runId],
    queryFn: async () => {
      const res = await getRunSummary(runId!);
      return res.data as RunSummaryResponse;
    },
    enabled: !!runId,
  });

  const artifactsQuery = useQuery({
    queryKey: ["run-artifacts", runId],
    queryFn: async () => {
      const res = await getRunArtifacts(runId!);
      return res.data as RunArtifactsResponse;
    },
    enabled: !!runId,
  });

  const testMetricsQuery = useQuery({
    queryKey: ["test-metrics", runId],
    queryFn: async () => {
      const res = await getTestMetrics(runId!);
      return res.data as TestMetricsResponse;
    },
    enabled: !!runId,
  });

  const classBalanceQuery = useQuery({
    queryKey: ["class-balance", runId],
    queryFn: async () => {
      const res = await getClassBalance(runId!);
      return res.data as ClassBalanceResponse;
    },
    enabled: !!runId,
  });

  const diagnosisQuery = useQuery({
    queryKey: ["diagnosis", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getDiagnosis(runId!, classesHook.selectedClassIds);
      return res.data as DiagnosisResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const failureGroupsQuery = useQuery({
    queryKey: ["failure-groups", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getFailureGroups(runId!, classesHook.selectedClassIds);
      return res.data as FailureGroupsResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const testMetricsRow =
    testMetricsQuery.data?.test_metrics &&
    testMetricsQuery.data.test_metrics.length > 0
      ? testMetricsQuery.data.test_metrics[0]
      : null;

  const healthScore = diagnosisQuery.data?.health_score ?? 0;
  const isLowHealth = healthScore < HEALTH_THRESHOLD;

  const numTestImages =
    asNumber(testMetricsRow?.num_test_images) ??
    failureGroupsQuery.data?.worst_images?.length ??
    0;

  const meanIoU = averageSelectedMetric(testMetricsRow, selectedClassNames, "iou_mean");
  const meanDice = averageSelectedMetric(testMetricsRow, selectedClassNames, "dice_mean");

  const classwiseIoU = buildFilteredClasswiseIoU(testMetricsRow, selectedClassNames);
  const classBalanceData = buildClassBalanceChart(
    (classBalanceQuery.data?.class_balance ?? []) as Record<string, unknown>[],
    selectedClassNames,
  );

  const queryClient = useQueryClient();

  const reconstructMutation = useMutation({
    mutationFn: async () => {
      if (!runId) throw new Error("No run selected");
      const res = await reconstructMissingArtifacts(runId);
      return res.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["run-artifacts", runId] }),
        queryClient.invalidateQueries({ queryKey: ["run-summary", runId] }),
        queryClient.invalidateQueries({ queryKey: ["class-balance", runId] }),
        queryClient.invalidateQueries({ queryKey: ["diagnosis", runId] }),
        queryClient.invalidateQueries({ queryKey: ["failure-groups", runId] }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
      ]);
    },
  });

  const topFindings = [...(diagnosisQuery.data?.findings ?? [])]
    .sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0))
    .slice(0, 5);

  const currentRunStatus =
    runs.find((r) => r.run_id === runId)?.status ??
    summaryQuery.data?.status ??
    "unknown";

  const artifacts = artifactsQuery.data;

  const warnings = [
    ...(artifacts?.missing_required ?? []).map(
      (name) => `Required file missing: ${name}`,
    ),
    ...(diagnosisQuery.data?.warning ? [diagnosisQuery.data.warning] : []),
    ...(failureGroupsQuery.data?.warning ? [failureGroupsQuery.data.warning] : []),
  ];

  const uniqueWarnings = [...new Set(warnings)];

  if (!runsLoading && !runId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Model performance summary and key diagnostics
          </p>
        </div>

        <div className="glass-card p-8 text-center space-y-3">
          <p className="text-lg font-heading font-semibold">No run found</p>
          <p className="text-sm text-muted-foreground">
            Start a pipeline run or import an existing results directory from Configuration.
          </p>
          <div>
            <Link
              to="/settings"
              className="inline-flex rounded-lg border border-border bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"
            >
              Go to Configuration
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (runsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Loading run list...
          </p>
        </div>
      </div>
    );
  }

  const healthSubtitle =
    healthScore >= 80
      ? "Healthy"
      : healthScore >= 60
        ? "Needs attention"
        : "Limited diagnosis";

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Model performance summary and key diagnostics
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Run:</span> {runId}
          <span className="mx-2">•</span>
          <span className="font-medium text-foreground">Status:</span>{" "}
          {currentRunStatus}
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => reconstructMutation.mutate()}
            disabled={!runId || reconstructMutation.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary/60 disabled:opacity-50"
          >
            {reconstructMutation.isPending
              ? "Generating missing files..."
              : "Generate Missing Files"}
          </button>
        </div>
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

      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Test Images" value={numTestImages} icon={Images} />
        <MetricCard title="Mean IoU" value={formatMetric(meanIoU)} icon={Target} />
        <MetricCard title="Mean Dice" value={formatMetric(meanDice)} icon={Hexagon} />
        <MetricCard
          title="Health Score"
          value={`${healthScore}/100`}
          icon={Activity}
          highlight={isLowHealth}
          alertGlow={isLowHealth}
          subtitle={healthSubtitle}
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Class Balance</h3>
          </div>

          {classBalanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={classBalanceData}>
                <XAxis
                  dataKey="class_name"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="pixel_fraction" radius={[6, 6, 0, 0]}>
                  {classBalanceData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        [
                          "hsl(200, 70%, 50%)",
                          "hsl(210, 60%, 65%)",
                          "hsl(190, 50%, 70%)",
                          "hsl(142, 71%, 45%)",
                        ][i % 4]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              class_balance.csv not available for the selected classes.
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Class-wise IoU</h3>
          </div>

          {classwiseIoU.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={classwiseIoU}>
                <XAxis
                  dataKey="className"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="iou" radius={[6, 6, 0, 0]}>
                  {classwiseIoU.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        (entry.iou ?? 0) < 0.5
                          ? "hsl(14, 78%, 57%)"
                          : "hsl(142, 71%, 45%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              test_metrics.csv is missing selected-class IoU columns.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <h3 className="font-heading font-semibold mb-3">Top Priority Issues</h3>

        {topFindings.length > 0 ? (
          <div className="space-y-3">
            {topFindings.map((finding, i) => (
              <FindingCard
                key={`${finding.issue}-${i}`}
                type={finding.type}
                issue={finding.issue}
                evidence={finding.evidence}
                confidence={finding.confidence}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-sm text-muted-foreground">
            Diagnosis details are not available for the selected classes.
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FolderSearch className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Detected Files</h3>
        </div>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Source root:</span>{" "}
            {artifacts?.source_root ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Best output dir:</span>{" "}
            {artifacts?.best_output_dir ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Missing required:</span>{" "}
            {artifacts?.missing_required?.length
              ? artifacts.missing_required.join(", ")
              : "None"}
          </p>
          <p>
            <span className="text-muted-foreground">Missing optional:</span>{" "}
            {artifacts?.missing_optional?.length
              ? artifacts.missing_optional.join(", ")
              : "None"}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}