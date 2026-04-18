interface FindingCardProps {
  type: string;
  issue: string;
  confidence: "High" | "Medium" | "Low";
  evidence: string;
}

export function FindingCard({ type, issue, confidence, evidence }: FindingCardProps) {
  const badgeClass =
    confidence === "High"
      ? "status-badge-high"
      : confidence === "Medium"
      ? "status-badge-medium"
      : "status-badge-low";

  const borderColor =
    confidence === "High"
      ? "border-destructive/40"
      : confidence === "Medium"
      ? "border-warning/40"
      : "border-muted-foreground/20";

  return (
    <div className={`glass-card p-4 border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{type}</span>
          </div>
          <p className="font-heading font-semibold text-foreground">{issue}</p>
          <p className="text-sm text-muted-foreground mt-2">{evidence}</p>
        </div>
        <span className={badgeClass}>{confidence}</span>
      </div>
    </div>
  );
}
