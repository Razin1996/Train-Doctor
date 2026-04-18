import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel?: string;
};

export function FailureTypeSelect({
  value,
  options,
  onChange,
  allLabel = "All Failure Types",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const fullOptions = ["ALL", ...options];

  function getLabel(option: string) {
    return option === "ALL" ? allLabel : option;
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-[300px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[48px] w-full items-center justify-between rounded-2xl border border-border/60 bg-secondary/30 px-4 text-left text-foreground transition hover:bg-secondary/40"
      >
        <span className="text-base">{getLabel(value)}</span>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-3 w-full rounded-[28px] border border-white/10 bg-[#232323] p-3 shadow-2xl backdrop-blur-sm">
          <div className="space-y-1">
            {fullOptions.map((option) => {
              const selected = option === value;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-[#cf7047] text-white"
                      : "text-foreground hover:bg-white/5"
                  }`}
                >
                  <span className="w-5 shrink-0">
                    {selected ? <Check className="h-5 w-5" /> : null}
                  </span>
                  <span>{getLabel(option)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}