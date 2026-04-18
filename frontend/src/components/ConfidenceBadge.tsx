type Props = {
  confidence: "High" | "Medium" | "Low";
};

export function ConfidenceBadge({ confidence }: Props) {
  const styles =
    confidence === "High"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : confidence === "Medium"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-secondary/40 text-muted-foreground border-border/60";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {confidence}
    </span>
  );
}