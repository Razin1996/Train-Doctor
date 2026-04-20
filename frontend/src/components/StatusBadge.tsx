type Props = {
  status: string;
};

function getStatusStyles(status: string) {
  const s = status.toLowerCase();

  if (s.includes("completed")) {
    return "bg-green-500/15 text-green-400 border-green-500/30";
  }
  if (s.includes("imported")) {
    return "bg-primary/15 text-primary border-primary/30";
  }
  if (s.includes("failed")) {
    return "bg-destructive/15 text-destructive border-destructive/30";
  }
  if (s.includes("stop")) {
    return "bg-warning/15 text-warning border-warning/30";
  }
  if (
    s.includes("running") ||
    s.includes("training") ||
    s.includes("dataset") ||
    s.includes("auto_tuning")
  ) {
    return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  }
  if (s.includes("queued")) {
    return "bg-secondary/50 text-foreground border-border/60";
  }

  return "bg-secondary/40 text-muted-foreground border-border/60";
}

export function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(
        status,
      )}`}
    >
      {status}
    </span>
  );
}