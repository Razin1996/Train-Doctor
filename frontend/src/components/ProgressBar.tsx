type Props = {
  value?: number | null;
};

export function ProgressBar({ value }: Props) {
  const safeValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value <= 1 ? value * 100 : value))
      : null;

  if (safeValue === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className="text-xs text-foreground">{safeValue.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary/40">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}