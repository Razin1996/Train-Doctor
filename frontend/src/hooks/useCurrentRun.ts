import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRuns } from "@/api/traindoctor";
import type { RunListItem, RunsListResponse } from "@/types/api";

const RUN_ID_KEY = "traindoctor_run_id";

export function useCurrentRun() {
  const storedRunId =
    typeof window !== "undefined" ? localStorage.getItem(RUN_ID_KEY) : null;

  const query = useQuery({
    queryKey: ["runs"],
    queryFn: async () => {
      const res = await listRuns();
      return res.data as RunsListResponse;
    },
  });

  const runs: RunListItem[] = query.data?.runs ?? [];

  const runId = useMemo(() => {
    if (!runs.length) return storedRunId;

    const storedStillExists = storedRunId
      ? runs.some((run) => run.run_id === storedRunId)
      : false;

    if (storedStillExists) return storedRunId;

    return runs[0]?.run_id ?? storedRunId;
  }, [runs, storedRunId]);

  useEffect(() => {
    if (runId) {
      localStorage.setItem(RUN_ID_KEY, runId);
    }
  }, [runId]);

  return {
    ...query,
    runs,
    runId,
  };
}