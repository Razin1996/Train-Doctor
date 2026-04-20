type Props = {
  runId: string;
};

export function RunTypeBadge({ runId }: Props) {
  const imported = runId.toLowerCase().startsWith("imported_");

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        imported
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-secondary/30 text-muted-foreground"
      }`}
    >
      {imported ? "Imported" : "Local"}
    </span>
  );
}