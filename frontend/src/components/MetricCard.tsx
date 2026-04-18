import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  highlight,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden rounded-2xl
        border border-border/60
        bg-secondary/35
        min-h-[150px]
        p-6
        shadow-sm
        transition-all
        hover:border-border
        hover:bg-secondary/45
        hover:shadow-md
        ${highlight ? "border-primary/50 shadow-primary/10" : ""}
      `}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-primary/70" />

      <div className="flex h-full items-start justify-between gap-4">
        <div className="flex flex-col justify-between h-full">
          <div>
            <p className="text-sm text-muted-foreground mb-3">{title}</p>
            <p className="text-4xl font-heading font-bold text-foreground leading-none">
              {value}
            </p>
          </div>

          {subtitle ? (
            <p className="text-sm text-muted-foreground mt-5">{subtitle}</p>
          ) : (
            <div className="mt-5" />
          )}
        </div>

        <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/12 p-4">
          <Icon className="h-7 w-7 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}