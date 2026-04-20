import { FolderSearch, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { RunTypeBadge } from "@/components/RunTypeBadge";
import { ProgressBar } from "@/components/ProgressBar";
import type { RunArtifactsResponse, RunListItem } from "@/types/api";

type Props = {
  run: RunListItem;
  artifacts?: RunArtifactsResponse | null;
  isActive: boolean;
  onSelect: () => void;
};

function getRunIcon(status: string) {
  const s = status.toLowerCase();

  if (s.includes("completed")) return CheckCircle2;
  if (s.includes("failed")) return AlertTriangle;
  return PlayCircle;
}

export function RunCard({ run, artifacts, isActive, onSelect }: Props) {
  const Icon = getRunIcon(run.status);

  const missingRequired = artifacts?.missing_required?.length ?? 0;
  const missingOptional = artifacts?.missing_optional?.length ?? 0;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-secondary/20 hover:bg-secondary/30"
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-foreground break-all">
              {run.run_id}
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status={run.status} />
            <RunTypeBadge runId={run.run_id} />
            {isActive && (
              <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Active
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Message:</span>{" "}
              {run.message || "—"}
            </p>
            <p className="text-muted-foreground break-all">
              <span className="text-foreground font-medium">Best output dir:</span>{" "}
              {run.best_output_dir || "—"}
            </p>

            {artifacts && (
              <>
                <p className="text-muted-foreground break-all">
                  <span className="text-foreground font-medium">Source root:</span>{" "}
                  {artifacts.source_root || "—"}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Missing required:</span>{" "}
                  {missingRequired}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Missing optional:</span>{" "}
                  {missingOptional}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="xl:w-[280px] space-y-4">
          <ProgressBar value={run.progress} />

          <button
            type="button"
            onClick={onSelect}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? "border border-primary/30 bg-primary/10 text-primary"
                : "border border-border/60 bg-secondary/20 text-foreground hover:bg-secondary/30"
            }`}
          >
            <FolderSearch className="h-4 w-4" />
            {isActive ? "Current Run" : "Set Active"}
          </button>
        </div>
      </div>
    </div>
  );
}