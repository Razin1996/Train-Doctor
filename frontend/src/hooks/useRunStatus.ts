import { useQuery } from "@tanstack/react-query";
import { getPipelineStatus } from "@/api/traindoctor";
export function useRunStatus(runId?: string) {
  return useQuery({
    queryKey: ["run-status", runId],
    queryFn: async () => {
      if (!runId) return null;
      const res = await getPipelineStatus(runId);
      return res.data;
    },
    enabled: !!runId,
    refetchInterval: 3000,
  });
}