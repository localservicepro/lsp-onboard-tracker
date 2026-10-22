import type { OverallStatus } from "../lib/types";

const MAP: Record<OverallStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-accent-foreground",
  blocked: "bg-destructive/15 text-destructive",
  completed: "bg-chart-1/20 text-chart-1",
};

const LABELS: Record<OverallStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

export function StatusBadge({ status, className = "" }: { status: OverallStatus; className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " +
        MAP[status] +
        " " +
        className
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {LABELS[status]}
    </span>
  );
}