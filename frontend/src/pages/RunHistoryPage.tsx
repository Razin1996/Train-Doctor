import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCcw, Search } from "lucide-react";

import { RunCard } from "@/components/RunCard";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { getRunArtifacts, listRuns } from "@/api/traindoctor";
import type { RunArtifactsResponse, RunsListResponse } from "@/types/api";

const RUN_ID_KEY = "traindoctor_run_id";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function RunsHistoryPage() {
  const queryClient = useQueryClient();
  const { runId: activeRunId } = useCurrentRun();
  const [searchText, setSearchText] = useState("");

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: async () => {
      const res = await listRuns();
      return res.data as RunsListResponse;
    },
  });

  const runs = runsQuery.data?.runs ?? [];

  const filteredRuns = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return runs;

    return runs.filter((run) => {
      return (
        run.run_id.toLowerCase().includes(text) ||
        (run.status || "").toLowerCase().includes(text) ||
        (run.message || "").toLowerCase().includes(text) ||
        (run.best_output_dir || "").toLowerCase().includes(text)
      );
    });
  }, [runs, searchText]);

  const artifactQueries = useQueries({
    queries: filteredRuns.map((run) => ({
      queryKey: ["run-artifacts-history", run.run_id],
      queryFn: async () => {
        const res = await getRunArtifacts(run.run_id);
        return res.data as RunArtifactsResponse;
      },
      enabled: !!run.run_id,
    })),
  });

  const artifactsByRunId = new Map<string, RunArtifactsResponse | null>();
  filteredRuns.forEach((run, index) => {
    artifactsByRunId.set(run.run_id, artifactQueries[index]?.data ?? null);
  });

  const importedCount = runs.filter((r) =>
    r.run_id.toLowerCase().startsWith("imported_"),
  ).length;

  const localCount = runs.length - importedCount;
  const completedCount = runs.filter((r) =>
    r.status.toLowerCase().includes("completed"),
  ).length;

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["runs"] });
    await Promise.all(
      filteredRuns.map((run) =>
        queryClient.invalidateQueries({
          queryKey: ["run-artifacts-history", run.run_id],
        }),
      ),
    );
  };

  const setActiveRun = (runId: string) => {
    localStorage.setItem(RUN_ID_KEY, runId);
    window.dispatchEvent(new Event("storage"));
    window.location.reload();
  };

  if (runsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold">Runs History</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and switch among local and imported runs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
          <div className="glass-card p-6 h-28 animate-pulse bg-secondary/30" />
        </div>

        <div className="glass-card p-6 h-96 animate-pulse bg-secondary/30" />
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
        <h2 className="text-2xl font-heading font-bold">Runs History</h2>
        <p className="text-muted-foreground text-sm mt-1">
          View and switch among local and imported runs
        </p>
      </div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Runs</p>
          <p className="text-4xl font-bold text-foreground">{runs.length}</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <p className="text-sm text-muted-foreground mb-2">Imported vs Local</p>
          <p className="text-2xl font-bold text-foreground">
            {importedCount} imported / {localCount} local
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <p className="text-sm text-muted-foreground mb-2">Completed Runs</p>
          <p className="text-4xl font-bold text-foreground">{completedCount}</p>
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-2xl border border-border/60 bg-secondary/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-heading font-semibold">Search and Refresh</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Search runs by id, status, message, or output path
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search runs..."
                className="h-[48px] w-full rounded-2xl border border-border/60 bg-secondary/30 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:bg-secondary/40"
              />
            </div>

            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/20 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary/30"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {filteredRuns.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-2xl border border-border/60 bg-secondary/30 p-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            No runs match the current search.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={item} className="space-y-4">
          {filteredRuns.map((run) => (
            <RunCard
              key={run.run_id}
              run={run}
              artifacts={artifactsByRunId.get(run.run_id) ?? null}
              isActive={run.run_id === activeRunId}
              onSelect={() => setActiveRun(run.run_id)}
            />
          ))}
        </motion.div>
      )}

      {runs.length > 0 && (
        <motion.div
          variants={item}
          className="rounded-2xl border border-border/60 bg-secondary/30 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
            <div className="text-sm text-muted-foreground">
              Switching the active run updates the data shown on Overview,
              Performance, Diagnosis, Failure Cases, and Recommendations.
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}