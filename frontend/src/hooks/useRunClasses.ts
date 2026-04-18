import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRunClasses } from "@/api/traindoctor";
import type { RunClassesResponse } from "@/types/api";

function storageKey(runId: string) {
  return `traindoctor_selected_classes_${runId}`;
}

export function useRunClasses(runId?: string | null) {
  const query = useQuery({
    queryKey: ["run-classes", runId],
    queryFn: async () => {
      const res = await getRunClasses(runId!);
      return res.data as RunClassesResponse;
    },
    enabled: !!runId,
  });

  const classes = query.data?.classes ?? [];
  const selectableClasses = useMemo(
    () => classes.filter((c) => c.class_id !== 0),
    [classes],
  );

  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

  useEffect(() => {
    if (!runId || selectableClasses.length === 0) return;

    const raw = localStorage.getItem(storageKey(runId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as number[];
        const valid = parsed.filter((id) =>
          selectableClasses.some((c) => c.class_id === id),
        );
        if (valid.length > 0) {
          setSelectedClassIds(valid);
          return;
        }
      } catch {
        // ignore
      }
    }

    setSelectedClassIds(selectableClasses.map((c) => c.class_id));
  }, [runId, selectableClasses]);

  useEffect(() => {
    if (!runId) return;
    if (selectedClassIds.length > 0) {
      localStorage.setItem(storageKey(runId), JSON.stringify(selectedClassIds));
    }
  }, [runId, selectedClassIds]);

  const toggleClass = (classId: number) => {
    setSelectedClassIds((prev) => {
      const exists = prev.includes(classId);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== classId);
      }
      return [...prev, classId].sort((a, b) => a - b);
    });
  };

  const selectAll = () => {
    setSelectedClassIds(selectableClasses.map((c) => c.class_id));
  };

  return {
    ...query,
    classes,
    selectableClasses,
    selectedClassIds,
    setSelectedClassIds,
    toggleClass,
    selectAll,
  };
}