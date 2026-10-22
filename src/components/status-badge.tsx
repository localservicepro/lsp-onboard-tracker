import type { CallStatus } from "../lib/types";

const MAP: Record<CallStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  needs_followup: "bg-destructive/15 text-destructive",
  completed: "bg-chart-1/20 text-chart-1",
};

const LABELS: Record<CallStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_followup: "Needs follow-up",
  completed: "Completed",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: CallStatus;
  className?: string;
}) {
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
