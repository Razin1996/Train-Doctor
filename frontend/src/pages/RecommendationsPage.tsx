import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Download, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClassFilter } from "@/components/ClassFilter";
import { getRecommendations } from "@/api/traindoctor";
import { useCurrentRun } from "@/hooks/useCurrentRun";
import { useRunClasses } from "@/hooks/useRunClasses";
import type { RecommendationsResponse } from "@/types/api";

export default function RecommendationsPage() {
  const { runId } = useCurrentRun();
  const classesHook = useRunClasses(runId);

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", runId, classesHook.selectedClassIds],
    queryFn: async () => {
      const res = await getRecommendations(runId!, classesHook.selectedClassIds);
      return res.data as RecommendationsResponse;
    },
    enabled: !!runId && classesHook.selectedClassIds.length > 0,
  });

  const recommendations = recommendationsQuery.data?.recommendations ?? [];
  const suggestedConfig = recommendationsQuery.data?.suggested_config ?? {};
  const notes = recommendationsQuery.data?.notes ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Recommendations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Actionable suggestions and auto-generated config
        </p>
      </div>

      <ClassFilter
        classes={classesHook.classes}
        selectedClassIds={classesHook.selectedClassIds}
        onToggle={classesHook.toggleClass}
        onSelectAll={classesHook.selectAll}
      />

      {recommendationsQuery.data?.warning && (
        <div className="glass-card p-4 text-sm text-muted-foreground">
          {recommendationsQuery.data.warning}
        </div>
      )}

      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-4 flex items-start gap-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary font-heading font-bold text-sm shrink-0">
              {i + 1}
            </div>
            <div>
              <p className="text-foreground">{rec.recommendation}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold">Suggested Next Config</h3>
        </div>
        <pre className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground overflow-auto font-mono">
          {JSON.stringify(suggestedConfig, null, 2)}
        </pre>
        <div className="mt-4">
          <h4 className="font-medium text-sm text-muted-foreground mb-2">
            Why this config was suggested:
          </h4>
          <ul className="space-y-1">
            {notes.map((note, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading font-semibold mb-3">Explanation Engine</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a comprehensive analysis using rule-based reasoning, local LLM, or OpenAI API.
        </p>
        <div className="flex gap-3">
          <Button variant="default" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Generate Explanation
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </div>
      </div>
    </motion.div>
  );
}