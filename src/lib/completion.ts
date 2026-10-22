// Completion + progress logic for the LSP Onboarding Checklist.
//
// Core rules enforced:
//  - Access checks must be completed (logged into phone app + selected correct business).
//  - Every required connection must be verified as Connected, or explicitly
//    marked Not applicable with a reason and reviewer acknowledgement.
//  - Optional connections must be either Connected or explicitly marked (not left as Not checked if completing).
//  - All required client practical tasks completed by the client with evidence,
//    staff member and timestamp. Staff demonstration does NOT count.
//  - Staff checks recorded result is a SEPARATE staff verification item requiring
//    staff verifier, timestamp and result note.
//  - No unresolved blockers.
//  - "Sent" and "Receipt confirmed" remain distinct.
//  - A missing guide (no URL) cannot count as Sent. A verbal walkthrough is a
//    separate activity and never counts as a guide being sent.
//  - Progress denominators exclude approved N/A items.

import type {
  Client,
  AccessCheckItem,
  ConnectionItem,
  TaskItem,
  StaffVerificationItem,
  Blocker,
  GuideSentRecord,
  GuideLink,
  OverallStatus,
} from "./types";

export interface Progress {
  done: number;
  total: number;
  pct: number; // 0..100
  exemptCount?: number;
}

export interface CompletionBlock {
  ok: boolean;
  reasons: string[];
}

export function isAccessDone(a: AccessCheckItem): boolean {
  return a.checked && !!a.verifier?.trim() && !!a.verifiedAt;
}

export function accessProgress(client: Client): Progress {
  const items = client.accessChecks;
  const done = items.filter(isAccessDone).length;
  const total = items.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isConnectionExempt(c: ConnectionItem): boolean {
  return c.status === "not_applicable" && !!c.notApplicableReason?.trim() && !!c.acknowledgedByReviewer;
}

export function isConnectionSatisfied(c: ConnectionItem): boolean {
  if (c.status === "connected") return !!c.verifier?.trim() && !!c.verifiedAt;
  if (c.status === "not_applicable") return isConnectionExempt(c);
  return false;
}

export function connectionProgress(client: Client): Progress {
  // Exclude approved N/A from denominator, count connected as done
  const applicable = client.connections.filter((c) => !isConnectionExempt(c));
  const done = client.connections.filter((c) => c.status === "connected" && !!c.verifier?.trim() && !!c.verifiedAt).length;
  const exemptCount = client.connections.filter(isConnectionExempt).length;
  const total = applicable.length;
  return {
    done,
    total,
    pct: total === 0 ? (exemptCount > 0 ? 100 : 0) : Math.round((done / total) * 100),
    exemptCount,
  };
}

export function isTaskExempt(t: TaskItem): boolean {
  return t.status === "not_applicable" && !!t.notApplicableReason?.trim() && !!t.acknowledgedByReviewer;
}

export function taskCompletionProofValid(t: TaskItem): boolean {
  if (t.status !== "client_completed") return false;
  if (!t.clientConfirmed) return false;
  if (!t.evidence?.trim()) return false;
  if (!t.completedBy?.trim()) return false;
  if (!t.completedAt) return false;
  return true;
}

export function isTaskSatisfied(t: TaskItem): boolean {
  if (t.status === "client_completed") return taskCompletionProofValid(t);
  if (t.status === "not_applicable") return isTaskExempt(t);
  return false;
}

export function practiceProgress(client: Client): Progress {
  const applicable = client.tasks.filter((t) => !isTaskExempt(t));
  const done = client.tasks.filter((t) => t.status === "client_completed" && taskCompletionProofValid(t)).length;
  const exemptCount = client.tasks.filter(isTaskExempt).length;
  const total = applicable.length;
  return {
    done,
    total,
    pct: total === 0 ? (exemptCount > 0 ? 100 : 0) : Math.round((done / total) * 100),
    exemptCount,
  };
}

export function isStaffVerificationDone(sv: StaffVerificationItem): boolean {
  if (sv.status === "verified") {
    return !!sv.verifier?.trim() && !!sv.verifiedAt && !!sv.resultNote?.trim();
  }
  if (sv.status === "not_applicable") {
    return !!sv.notApplicableReason?.trim() && !!sv.acknowledgedByReviewer;
  }
  return false;
}

export function staffVerificationProgress(client: Client): Progress {
  const sv = client.staffVerification;
  const isExempt = sv.status === "not_applicable" && !!sv.notApplicableReason?.trim() && !!sv.acknowledgedByReviewer;
  const total = isExempt ? 0 : 1;
  const done = isStaffVerificationDone(sv) && !isExempt ? 1 : 0;
  return {
    done,
    total,
    pct: isStaffVerificationDone(sv) ? 100 : 0,
    exemptCount: isExempt ? 1 : 0,
  };
}

// ---- Guide-sent validation ----
//
// "Guide sent" requires a valid supplied guide URL or identifiable document
// version, a date/time, a delivery channel and a staff member. A verbal
// walkthrough is a SEPARATE activity and never counts as a guide being sent.
// A guide with no configured URL cannot be marked Sent (it shows "Guide link
// not added"). It may be exempted only with a reason + reviewer acknowledgement.

export function guideLabel(g: GuideSentRecord, guides: GuideLink[]): string {
  return guides.find((d) => d.id === g.guideId)?.label ?? g.guideId;
}

export function guideHasUrl(g: GuideSentRecord, guides: GuideLink[]): boolean {
  return !!guides.find((d) => d.id === g.guideId)?.url?.trim();
}

export function isGuideSentValid(g: GuideSentRecord, guides: GuideLink[]): boolean {
  if (!g.sent) return false;
  if (!g.sentAt) return false;
  if (!g.channel) return false;
  if (!g.sentBy?.trim()) return false;
  // A valid supplied URL/version is mandatory — never "Guide link not added".
  const supplied = g.suppliedUrlOrVersion?.trim();
  if (!supplied) return false;
  if (/guide link not added/i.test(supplied)) return false;
  // If the guide has no configured URL, it cannot be sent at all.
  if (!guideHasUrl(g, guides)) return false;
  return true;
}

export function isGuideExempt(g: GuideSentRecord): boolean {
  return (
    !g.sent &&
    !!g.notApplicableReason?.trim() &&
    !!g.acknowledgedByReviewer
  );
}

export function isGuideOutstanding(g: GuideSentRecord, guides: GuideLink[]): boolean {
  // Outstanding = not sent and not exempted. Missing-URL guides stay outstanding.
  if (g.sent) return false;
  if (isGuideExempt(g)) return false;
  void guides;
  return true;
}

export function unresolvedBlockers(client: Client): Blocker[] {
  return client.blockers.filter((b) => !b.resolved);
}

export function followupProgress(client: Client, guides: GuideLink[]): Progress {
  const blockers = client.blockers;
  const guideDone = client.guides.filter((g) => isGuideSentValid(g, guides)).length;
  const guideExempt = client.guides.filter((g) => isGuideExempt(g)).length;
  const guideApplicable = client.guides.filter((g) => !isGuideExempt(g)).length;
  const blockerDone = blockers.filter((b) => b.resolved).length;
  const total = blockers.length + guideApplicable;
  const done = blockerDone + guideDone;
  return {
    done,
    total,
    pct: total === 0 ? (guideExempt > 0 ? 100 : 0) : Math.round((done / total) * 100),
    exemptCount: guideExempt,
  };
}

export function completionBlock(client: Client, guides: GuideLink[] = []): CompletionBlock {
  const reasons: string[] = [];

  // 1. Access checks
  const incompleteAccess = client.accessChecks.filter((a) => !isAccessDone(a));
  if (incompleteAccess.length > 0) {
    reasons.push(`${incompleteAccess.length} required phone-app access check(s) not completed`);
  }

  // 2. Connections: every required connection must be verified as connected or explicitly N/A with reason + ack
  const unverifiedConnections = client.connections.filter((c) => {
    if (c.required) {
      return !isConnectionSatisfied(c);
    }
    // Optional connections: if left as not_checked or blocked
    return c.status === "blocked" || c.status === "not_checked";
  });
  if (unverifiedConnections.length > 0) {
    reasons.push(`${unverifiedConnections.length} connection(s) unverified or blocked (e.g. ${unverifiedConnections.map((c) => c.label).slice(0, 2).join(", ")})`);
  }

  // Check N/A connections without reason or acknowledgement
  const invalidNaConnections = client.connections.filter(
    (c) => c.status === "not_applicable" && (!c.notApplicableReason?.trim() || !c.acknowledgedByReviewer),
  );
  if (invalidNaConnections.length > 0) {
    reasons.push(`${invalidNaConnections.length} connection(s) marked Not applicable without valid reason or reviewer acknowledgement`);
  }

  // 3. Client practical tasks
  const incompleteTasks = client.tasks.filter((t) => !isTaskSatisfied(t));
  if (incompleteTasks.length > 0) {
    const demonstratedCount = incompleteTasks.filter((t) => t.status === "demonstrated_by_staff").length;
    reasons.push(
      `${incompleteTasks.length} client practical task(s) not yet completed` +
        (demonstratedCount > 0 ? ` (${demonstratedCount} only demonstrated by staff — staff demo does NOT count)` : ""),
    );
  }

  // 4. Staff verification
  if (!isStaffVerificationDone(client.staffVerification)) {
    reasons.push("Staff verification of recorded result is not yet verified with evidence note");
  }

  // 5. Unresolved blockers
  const blockers = unresolvedBlockers(client);
  if (blockers.length > 0) {
    reasons.push(`${blockers.length} unresolved blocker(s)`);
  }

  // 6. Outstanding required documentation (guides) without an approved exemption
  const outstandingGuides = client.guides.filter((g) => isGuideOutstanding(g, guides));
  if (outstandingGuides.length > 0) {
    reasons.push(`${outstandingGuides.length} required guide(s) not sent or exempted (e.g. ${outstandingGuides.map((g) => guideLabel(g, guides)).slice(0, 2).join(", ")})`);
  }
  // Guides marked sent but invalid (e.g. no URL / "Guide link not added")
  const invalidSentGuides = client.guides.filter((g) => g.sent && !isGuideSentValid(g, guides));
  if (invalidSentGuides.length > 0) {
    reasons.push(`${invalidSentGuides.length} guide(s) marked Sent without a valid supplied URL/version (verbal walkthrough is not a sent guide)`);
  }

  return { ok: reasons.length === 0, reasons };
}

export function derivedOverallStatus(client: Client, guides: GuideLink[] = []): OverallStatus {
  // If there are unresolved blockers, status is blocked
  if (unresolvedBlockers(client).length > 0) return "blocked";

  const block = completionBlock(client, guides);
  if (block.ok) {
    return "completed";
  }

  const access = accessProgress(client);
  const conn = connectionProgress(client);
  const prac = practiceProgress(client);

  if (access.done === 0 && conn.done === 0 && prac.done === 0 && client.callSessions.length === 0) {
    return "not_started";
  }

  return "in_progress";
}

export function statusColor(status: OverallStatus): string {
  switch (status) {
    case "completed":
      return "var(--color-chart-1)";
    case "in_progress":
      return "var(--color-primary)";
    case "blocked":
      return "var(--color-destructive)";
    case "not_started":
    default:
      return "var(--color-muted-foreground)";
  }
}
