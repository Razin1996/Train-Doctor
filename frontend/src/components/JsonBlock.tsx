type Props = {
  value: Record<string, unknown>;
};

export function JsonBlock({ value }: Props) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-secondary/20 p-5 text-sm text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}