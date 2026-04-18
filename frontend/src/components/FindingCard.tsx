import { AlertTriangle, Info } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

interface FindingCardProps {
  type: string;
  issue: string;
  evidence: string;
  confidence: "High" | "Medium" | "Low";
}

export function FindingCard({
  type,
  issue,
  evidence,
  confidence,
}: FindingCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/30 p-5 transition-all hover:bg-secondary/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 mt-0.5">
            {confidence === "High" ? (
              <AlertTriangle className="h-4 w-4 text-primary" />
            ) : (
              <Info className="h-4 w-4 text-primary" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {type}
            </p>
            <h4 className="text-base font-semibold text-foreground">{issue}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {evidence}
            </p>
          </div>
        </div>

        <ConfidenceBadge confidence={confidence} />
      </div>
    </div>
  );
}