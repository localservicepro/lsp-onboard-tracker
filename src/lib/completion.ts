// Completion + progress logic for the LSP Onboarding Checklist.
//
// Core rules enforced here (and tested):
//  - A connected integration does NOT complete any practical task.
//  - "Demonstrated by staff" does NOT count as client completion.
//  - Evidence + client confirmation + staff + timestamp are required for
//    "Client completed".
//  - Required blockers prevent overall completion.
//  - "Sent" and "Receipt confirmed" remain distinct (reviewOutcome is its own
//    field; one never auto-derives from the other).
//  - "Not applicable" requires a reason (and reviewer acknowledgement at the
//    UI layer) — it never silently bypasses a required task.

import type {
  Client,
  ConnectionItem,
  TaskItem,
  Blocker,
  OverallStatus,
} from "./types";

export interface Progress {
  done: number;
  total: number;
  pct: number; // 0..100
}

export interface CompletionBlock {
  ok: boolean;
  reasons: string[];
}

export function connectionProgress(client: Client): Progress {
  return progressOf(client.connections, isConnectionDone);
}

export function practiceProgress(client: Client): Progress {
  return progressOf(client.tasks, isTaskDone);
}

export function followupProgress(client: Client): Progress {
  // Two independent follow-up concerns: unresolved blockers + guide sends.
  const blockers = client.blockers;
  const guides = client.guides;
  const blockerDone = blockers.filter((b) => b.resolved).length;
  const guideDone = guides.filter((g) => g.sent).length;
  const total = blockers.length + guides.length;
  const done = blockerDone + guideDone;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function progressOf<T>(items: T[], done: (t: T) => boolean): Progress {
  const total = items.length;
  const doneCount = items.filter(done).length;
  return { done: doneCount, total, pct: total === 0 ? 0 : Math.round((doneCount / total) * 100) };
}

export function isConnectionDone(c: ConnectionItem): boolean {
  return c.status === "connected" || (c.status === "not_applicable" && !!c.notApplicableReason?.trim());
}

export function isTaskDone(t: TaskItem): boolean {
  if (t.status === "client_completed") return true;
  if (t.status === "not_applicable") return !!t.notApplicableReason?.trim();
  return false;
}

// A task is only validly "client_completed" when the proof requirements are met.
export function taskCompletionProofValid(t: TaskItem): boolean {
  if (t.status !== "client_completed") return false;
  if (!t.clientConfirmed) return false;
  if (!t.evidence?.trim()) return false;
  if (!t.completedBy?.trim()) return false;
  if (!t.completedAt) return false;
  return true;
}

// A "client_completed" task missing its proof is treated as incomplete for
// overall-completion purposes (it is not "done" until proof is recorded).
export function isTaskDoneForOverall(t: TaskItem): boolean {
  if (t.status === "not_applicable") return !!t.notApplicableReason?.trim();
  if (t.status === "client_completed") return taskCompletionProofValid(t);
  return false;
}

export function unresolvedBlockers(client: Client): Blocker[] {
  return client.blockers.filter((b) => !b.resolved);
}

export function completionBlock(client: Client): CompletionBlock {
  const reasons: string[] = [];

  const incompleteTasks = client.tasks.filter((t) => !isTaskDoneForOverall(t));
  if (incompleteTasks.length > 0) {
    reasons.push(
      `${incompleteTasks.length} practical task(s) not yet completed by the client` +
        (incompleteTasks.some((t) => t.status === "demonstrated_by_staff")
          ? " — staff demonstration does not count"
          : ""),
    );
  }

  const blockers = unresolvedBlockers(client);
  if (blockers.length > 0) {
    reasons.push(`${blockers.length} unresolved blocker(s)`);
  }

  // A connected integration must never satisfy a practical task — this is
  // structural (tasks and connections are separate arrays), so nothing to
  // cross-check here; the rule is enforced by keeping them independent.
  return { ok: reasons.length === 0, reasons };
}

export function derivedOverallStatus(client: Client): OverallStatus {
  const block = completionBlock(client);
  if (block.ok) {
    // Only "completed" when there is real progress; otherwise not started.
    const conn = connectionProgress(client);
    const prac = practiceProgress(client);
    if (conn.done === 0 && prac.done === 0 && client.blockers.length === 0) {
      return "not_started";
    }
    return "completed";
  }
  if (unresolvedBlockers(client).length > 0) return "blocked";
  const conn = connectionProgress(client);
  const prac = practiceProgress(client);
  if (conn.done === 0 && prac.done === 0) return "not_started";
  return "in_progress";
}

export function statusColor(status: OverallStatus): string {
  switch (status) {
    case "completed":
      return "var(--color-chart-1)";
    case "in_progress":
      return "var(--color-chart-2)";
    case "blocked":
      return "var(--color-chart-4)";
    case "not_started":
    default:
      return "var(--color-muted-foreground)";
  }
}