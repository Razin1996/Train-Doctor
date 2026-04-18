type Props = {
  label: string;
};

function pickStyles(label: string) {
  const lower = label.toLowerCase();

  if (lower.includes("noise")) {
    return "bg-destructive/15 text-destructive border-destructive/30";
  }
  if (lower.includes("snow")) {
    return "bg-secondary/50 text-foreground border-border/60";
  }
  if (lower.includes("sky") || lower.includes("water")) {
    return "bg-primary/15 text-primary border-primary/30";
  }
  if (lower.includes("low light")) {
    return "bg-warning/15 text-warning border-warning/30";
  }
  return "bg-secondary/40 text-muted-foreground border-border/60";
}

export function FailureTypeBadge({ label }: Props) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${pickStyles(label)}`}
    >
      {label}
    </span>
  );
}