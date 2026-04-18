import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Activity,
  TrendingUp,
  BarChart3,
  Layers3,
  AlertTriangle,
} from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { ClassFilter } from "@/components/ClassFilter";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import {
  getIterations,
  getRunArtifacts,
  getTestMetrics,
  getTrainLog,
} from "@/api/traindoctor";
import type {
  IterationsResponse,
  RunArtifactsResponse,
  TestMetricsResponse,
  TrainLogResponse,
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

function buildSelectedClassBars(
  record: Record<string, unknown> | null | undefined,
  selectedClassNames: string[],
  suffix: "iou_mean" | "dice_mean",
) {
  if (!record) return [];

  return selectedClassNames
    .map((name) => ({
      className: name,
      value: asNumber(record[`${name}_${suffix}`]),
    }))
    .filter((row) => row.value !== null)
    .map((row) => ({
      className: row.className,
      value: row.value as number,
    }));
}

function buildTrainCurve(rows: Record<string, unknown>[]) {
  return rows.map((row, idx) => ({
    epoch: asNumber(row.epoch) ?? idx + 1,
    train_loss: asNumber(row.train_loss),
    val_loss: asNumber(row.val_loss),
    train_iou: asNumber(row.train_iou),
    val_iou: asNumber(row.val_iou),
    train_dice: asNumber(row.train_dice),
    val_dice: asNumber(row.val_dice),
  }));
}

export default function PerformancePage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const selectedClassNames = classesHook.selectableClasses
    .filter((c) => classesHook.selectedClassIds.includes(c.class_id))
    .map((c) => c.class_name);

  const artifactsQuery = useQuery({
    queryKey: ["performance-artifacts", runId],
    queryFn: async () => {
      const res = await getRunArtifacts(runId!);
      return res.data as RunArtifactsResponse;
    },
    enabled: !!runId,
  });

  const trainLogQuery = useQuery({
    queryKey: ["performance-train-log", runId],
    queryFn: async () => {
      const res = await getTrainLog(runId!);
      return res.data as TrainLogResponse;
    },
    enabled: !!runId,
  });

  const testMetricsQuery = useQuery({
    queryKey: ["performance-test-metrics", runId],
    queryFn: async () => {
      const res = await getTestMetrics(runId!);
      return res.data as TestMetricsResponse;
    },
    enabled: !!runId,
  });

  const iterationsQuery = useQuery({
    queryKey: ["performance-iterations", runId],
    queryFn: async () => {
      const res = await getIterations(runId!);
      return res.data as IterationsResponse;
    },
    enabled: !!runId,
  });

  const trainLogRows =
    (trainLogQuery.data?.train_log as Record<string, unknown>[]) ?? [];
  const trainCurve = buildTrainCurve(trainLogRows);

  const testMetricsRow =
    testMetricsQuery.data?.test_metrics &&
    testMetricsQuery.data.test_metrics.length > 0
      ? (testMetricsQuery.data.test_metrics[0] as Record<string, unknown>)
      : null;

  const selectedMeanIoU = averageSelectedMetric(
    testMetricsRow,
    selectedClassNames,
    "iou_mean",
  );

  const selectedMeanDice = averageSelectedMetric(
    testMetricsRow,
    selectedClassNames,
    "dice_mean",
  );

  const bestValIoU =
    trainCurve.length > 0
      ? Math.max(
          ...trainCurve
            .map((row) => row.val_iou)
            .filter((v): v is number => v !== null),
        )
      : null;

  const finalTrainIoU =
    trainCurve.length > 0 ? trainCurve[trainCurve.length - 1]?.train_iou ?? null : null;

  const finalValIoU =
    trainCurve.length > 0 ? trainCurve[trainCurve.length - 1]?.val_iou ?? null : null;

  const iouGap =
    finalTrainIoU !== null && finalValIoU !== null
      ? finalTrainIoU - finalValIoU
      : null;

  const perClassIoUBars = buildSelectedClassBars(
    testMetricsRow,
    selectedClassNames,
    "iou_mean",
  );

  const perClassDiceBars = buildSelectedClassBars(
    testMetricsRow,
    selectedClassNames,
    "dice_mean",
  );

  const iterationBars =
    iterationsQuery.data?.iterations?.map((it) => ({
      iteration: `Iter ${it.iteration}`,
      mean_iou: it.mean_iou ?? null,
      mean_dice: it.mean_dice ?? null,
      health_score: it.health_score ?? null,
    })) ?? [];

  const warnings = [
    ...(artifactsQuery.data?.missing_required ?? []).map(
      (name) => `Required file missing: ${name}`,
    ),
    ...(artifactsQuery.data?.missing_optional ?? []).filter(
      (name) => name === "train_log" || name === "iteration_summaries",
    ).map((name) => `Optional performance file missing: ${name}`),
  ];

  const uniqueWarnings = [...new Set(warnings)];

  const pageLoading =
    artifactsQuery.isLoading ||
    trainLogQuery.isLoading ||
    testMetricsQuery.isLoading ||
    iterationsQuery.isLoading;

  if (!runId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Performance</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Training curves and run-level metrics
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
          <h2 className="text-2xl font-heading font-bold">Performance</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Loading performance data...
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-6 h-28 animate-pulse bg-secondary/30"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass-card p-6 h-96 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-96 animate-pulse bg-secondary/30" />
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
        <h2 className="text-2xl font-heading font-bold">Performance</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Training curves and run-level metrics
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

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard
          title="Selected Mean IoU"
          value={formatMetric(selectedMeanIoU)}
          icon={Activity}
          subtitle="Average across selected classes"
        />

        <MetricCard
          title="Selected Mean Dice"
          value={formatMetric(selectedMeanDice)}
          icon={TrendingUp}
          subtitle="Average across selected classes"
        />

        <MetricCard
          title="Best Val IoU"
          value={formatMetric(bestValIoU)}
          icon={BarChart3}
          subtitle="Peak validation IoU"
        />

        <MetricCard
          title="Train–Val IoU Gap"
          value={formatMetric(iouGap)}
          icon={Layers3}
          subtitle={iouGap !== null && iouGap > 0.1 ? "Possible overfitting" : "Train/validation difference"}
          highlight={iouGap !== null && iouGap > 0.1}
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Loss Curves</h3>
          </div>

          {trainCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trainCurve}>
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="train_loss" stroke="hsl(200 70% 50%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_loss" stroke="hsl(14 78% 57%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              train_log.csv not available.
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">IoU Curves</h3>
          </div>

          {trainCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trainCurve}>
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="train_iou" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_iou" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              train_log.csv not available.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Selected-Class IoU</h3>
          </div>

          {perClassIoUBars.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perClassIoUBars}>
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="className"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {perClassIoUBars.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.value < 0.5 ? "hsl(14 78% 57%)" : "hsl(142 71% 45%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              test_metrics.csv is missing selected-class IoU columns.
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
          <div className="flex items-center gap-2 mb-4">
            <Layers3 className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold">Selected-Class Dice</h3>
          </div>

          {perClassDiceBars.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perClassDiceBars}>
                <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="className"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {perClassDiceBars.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.value < 0.5 ? "hsl(14 78% 57%)" : "hsl(200 70% 50%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              test_metrics.csv is missing selected-class Dice columns.
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Dice Curves */}
      <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
        <div className="flex items-center gap-2 mb-4">
          <Layers3 className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Dice Curves</h3>
        </div>

        {trainCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trainCurve}>
              <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="train_dice"
                stroke="hsl(270 70% 60%)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="val_dice"
                stroke="hsl(320 70% 60%)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            train_log.csv not available.
          </div>
        )}
      </div>

      {/* Iteration Summary */}
      <div className="glass-card rounded-2xl border border-border/60 bg-secondary/30 p-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Iteration Summary</h3>
        </div>

        {iterationBars.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={iterationBars}>
              <CartesianGrid stroke="hsl(0 0% 18%)" strokeDasharray="3 3" />
              <XAxis
                dataKey="iteration"
                tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="mean_iou" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="mean_dice" fill="hsl(200 70% 50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            iteration_summaries.json not available.
          </div>
        )}
      </div>
    </motion.div>
    </motion.div>
  );
}