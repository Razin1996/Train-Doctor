import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { compareRuns } from "@/api/traindoctor";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { ArrowRight, GitCompare, TrendingUp } from "lucide-react";

function formatValue(value: unknown, digits = 3) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toFixed(digits);
  return String(value);
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        positive
          ? "bg-green-500/10 text-green-400"
          : negative
          ? "bg-red-500/10 text-red-400"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(3)}
    </span>
  );
}

export default function CompareRunsPage() {
  const { runs } = useCurrentRun();

  const [runA, setRunA] = useState("");
  const [runB, setRunB] = useState("");

  const comparisonQuery = useQuery({
    queryKey: ["compare-runs", runA, runB],
    queryFn: async () => {
      const res = await compareRuns(runA, runB);
      return res.data;
    },
    enabled: !!runA && !!runB && runA !== runB,
  });

  const comparison = comparisonQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-primary" />
          Compare Runs
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare baseline and improved runs to evaluate whether the agentic recommendations improved model performance.
        </p>
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div>
            <label className="text-sm text-muted-foreground">Baseline Run</label>
            <select
              value={runA}
              onChange={(e) => setRunA(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="">Select baseline run</option>
              {runs.map((run) => (
                <option key={run.run_id} value={run.run_id}>
                  {run.run_id}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground mb-2" />

          <div>
            <label className="text-sm text-muted-foreground">Improved Run</label>
            <select
              value={runB}
              onChange={(e) => setRunB(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="">Select improved run</option>
              {runs.map((run) => (
                <option key={run.run_id} value={run.run_id}>
                  {run.run_id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {runA && runB && runA === runB && (
        <div className="glass-card p-5 text-sm text-red-400">
          Please select two different runs.
        </div>
      )}

      {comparisonQuery.isLoading && (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          Comparing runs...
        </div>
      )}

      {comparison && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ComparisonCard
              title="Health Score"
              before={comparison.run_a.health_score}
              after={comparison.run_b.health_score}
              delta={comparison.delta.health_score}
            />

            <ComparisonCard
              title="Mean IoU"
              before={comparison.run_a.mean_iou}
              after={comparison.run_b.mean_iou}
              delta={comparison.delta.mean_iou}
            />

            <ComparisonCard
              title="Mean Dice"
              before={comparison.run_a.mean_dice}
              after={comparison.run_b.mean_dice}
              delta={comparison.delta.mean_dice}
            />

            <ComparisonCard
              title="Diagnostic Issues"
              before={comparison.run_a.num_findings}
              after={comparison.run_b.num_findings}
              delta={comparison.delta.num_findings}
              lowerIsBetter
            />
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-semibold">Comparison Summary</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {comparison.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FindingsPanel title="Baseline Top Issues" findings={comparison.run_a.top_findings} />
            <FindingsPanel title="Improved Run Top Issues" findings={comparison.run_b.top_findings} />
          </div>
        </>
      )}
    </div>
  );
}

function ComparisonCard({
  title,
  before,
  after,
  delta,
  lowerIsBetter = false,
}: {
  title: string;
  before: unknown;
  after: unknown;
  delta: number | null;
  lowerIsBetter?: boolean;
}) {
  let adjustedDelta = delta;

  if (lowerIsBetter && typeof delta === "number") {
    adjustedDelta = -delta;
  }

  return (
    <div className="glass-card p-5">
      <p className="text-sm text-muted-foreground mb-3">{title}</p>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Before</p>
          <p className="text-xl font-heading font-bold">{formatValue(before)}</p>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground" />

        <div>
          <p className="text-xs text-muted-foreground">After</p>
          <p className="text-xl font-heading font-bold">{formatValue(after)}</p>
        </div>
      </div>

      <div className="mt-4">
        <DeltaBadge value={adjustedDelta} />
      </div>
    </div>
  );
}

function FindingsPanel({
  title,
  findings,
}: {
  title: string;
  findings: Array<any>;
}) {
  return (
    <div className="glass-card p-6">
      <h3 className="font-heading font-semibold mb-4">{title}</h3>

      {findings && findings.length > 0 ? (
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <div
              key={index}
              className="rounded-xl border border-border/60 bg-secondary/25 p-4"
            >
              <p className="font-medium text-sm">{finding.issue ?? "Issue"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {finding.evidence ?? "No evidence available."}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No diagnostic findings available.
        </p>
      )}
    </div>
  );
}