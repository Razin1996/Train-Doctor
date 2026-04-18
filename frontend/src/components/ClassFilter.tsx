import type { RunClassInfo } from "@/types/api";

type Props = {
  classes: RunClassInfo[];
  selectedClassIds: number[];
  onToggle: (classId: number) => void;
  onSelectAll: () => void;
};

export function ClassFilter({
  classes,
  selectedClassIds,
  onToggle,
  onSelectAll,
}: Props) {
  const filtered = classes.filter((c) => c.class_id !== 0);

  if (filtered.length === 0) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading font-semibold">Analysis Classes</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Uncheck any class to exclude it from diagnosis, recommendations, and failure analysis.
          </p>
        </div>

        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary/60"
        >
          Select all
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtered.map((cls) => {
          const active = selectedClassIds.includes(cls.class_id);
          return (
            <button
              key={cls.class_id}
              type="button"
              onClick={() => onToggle(cls.class_id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/30 text-muted-foreground"
              }`}
            >
              {cls.class_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}