// Completion + progress logic for the LSP Onboarding Checklist (call-based model).
//
// Core rules:
//  - Untouched (not_checked) items are NOT blockers just because a call hasn't
//    happened. Only an actual recorded issue (needs_help) means "needs follow-up".
//  - "Client did it" (client_action done) means staff observed the client
//    personally perform the action AND recorded a non-empty evidence note,
//    staff identity and timestamp. A staff demonstration does NOT count.
//  - Staff-only items use Done (not "Client did it").
//  - "Sent" and "Receipt confirmed" stay distinct review outcomes.
//  - A missing guide (no URL) cannot count as Sent. A verbal walkthrough is a
//    separate activity and never counts as guide delivery.
//  - A guideDerived staff_check (e.g. "Required how-to guides supplied") is
//    auto-calculated from the call's guide records — it is Done only when every
//    required guide is sent-valid OR explicitly exempted. It is never edited
//    directly and never counts a verbal walkthrough as a sent guide.
//  - Not applicable requires a reason + reviewer acknowledgement.
//  - Each underlying unresolved item is counted ONCE (no double-counting).

import type { Client, Call, CallItem, CallStatus, GuideLink, CallGuideRecord } from "./types";

export interface Progress {
  done: number;
  total: number;
  pct: number;
  exemptCount?: number;
  needsHelpCount?: number;
}

export interface CompletionBlock {
  ok: boolean;
  reasons: string[];
}

// ---- Item-level ----

export function isItemDone(item: CallItem): boolean {
  if (item.status !== "done") return false;
  // Guide-derived items are auto-calculated — no evidence/completedBy required.
  if (item.guideDerived) return true;
  if (!item.completedBy?.trim()) return false;
  if (!item.completedAt) return false;
  if (item.kind === "client_action") {
    // Client practical task: requires a non-empty evidence/result note.
    return !!item.evidence?.trim();
  }
  // staff_check: a brief verification note is allowed but optional; verifier + timestamp required.
  return true;
}

export function isItemExempt(item: CallItem): boolean {
  return (
    item.status === "not_applicable" &&
    !!item.notApplicableReason?.trim() &&
    !!item.acknowledgedByReviewer
  );
}

export function isItemSatisfied(item: CallItem): boolean {
  if (item.status === "done") return isItemDone(item);
  if (item.status === "not_applicable") return isItemExempt(item);
  return false;
}

export function itemNeedsFollowUp(item: CallItem): boolean {
  return item.status === "needs_help";
}

export function itemStatusLabel(item: CallItem): string {
  if (item.status === "done") return item.kind === "client_action" ? "Client did it" : "Done";
  if (item.status === "needs_help") return "Needs help";
  if (item.status === "not_applicable") return "Not applicable";
  return "Not checked";
}

// ---- Guide-derived item status ----
// A guideDerived staff_check is auto-calculated from the call's guide records.
// Returns the effective ItemStatus the item should display/evaluate as.
export function guideDerivedStatus(call: Call, item: CallItem, guides: GuideLink[] = []): CallItem["status"] {
  if (!item.guideDerived) return item.status;
  const records = call.guides;
  if (records.length === 0) return "not_checked";
  // Every guide must be sent-valid OR explicitly exempted.
  const allOk = records.every((g) => isGuideSentValid(g, guides) || isGuideExempt(g));
  if (allOk) return "done";
  // If any guide has an actual recorded issue (marked sent but invalid), that's
  // a real problem → needs_help. Otherwise it's simply outstanding → not_checked.
  const hasIssue = records.some(
    (g) => g.sent && !isGuideSentValid(g, guides) && !isGuideExempt(g),
  );
  return hasIssue ? "needs_help" : "not_checked";
}

// Effective item for all downstream checks: guideDerived items use the derived
// status; everything else uses the stored status.
export function effectiveItem(call: Call, item: CallItem, guides: GuideLink[] = []): CallItem {
  if (item.guideDerived) {
    const st = guideDerivedStatus(call, item, guides);
    if (st !== item.status) {
      return { ...item, status: st };
    }
  }
  return item;
}

// ---- Call-level ----

export function callItemProgress(call: Call, guides: GuideLink[] = []): Progress {
  const items = call.items.map((i) => effectiveItem(call, i, guides));
  const applicable = items.filter((i) => !isItemExempt(i));
  const done = items.filter((i) => i.status === "done" && isItemDone(i)).length;
  const exemptCount = items.filter(isItemExempt).length;
  const needsHelpCount = items.filter(itemNeedsFollowUp).length;
  const total = applicable.length;
  return {
    done,
    total,
    pct: total === 0 ? (exemptCount > 0 ? 100 : 0) : Math.round((done / total) * 100),
    exemptCount,
    needsHelpCount,
  };
}

export function callCompletionBlock(call: Call, guides: GuideLink[] = []): CompletionBlock {
  const reasons: string[] = [];
  const items = call.items.map((i) => effectiveItem(call, i, guides));

  // Needs-help items are actual issues — they block completion. Counted once.
  const needsHelp = items.filter(itemNeedsFollowUp);
  if (needsHelp.length > 0) {
    reasons.push(
      `${needsHelp.length} item(s) need help (unresolved issues): ${needsHelp
        .map((i) => i.label)
        .join("; ")}`,
    );
  }

  // Required items not satisfied (done with proof, or N/A with reason + ack).
  // Exclude needs_help (already counted above) so we don't double-count.
  const unsatisfiedRequired = items.filter(
    (i) => i.required && !isItemSatisfied(i) && !itemNeedsFollowUp(i),
  );
  if (unsatisfiedRequired.length > 0) {
    const notChecked = unsatisfiedRequired.filter((i) => i.status === "not_checked");
    reasons.push(
      `${unsatisfiedRequired.length} required item(s) not completed` +
        (notChecked.length > 0 ? ` (${notChecked.length} still not checked)` : ""),
    );
  }

  // Invalid N/A (no reason or no reviewer acknowledgement).
  const invalidNa = items.filter(
    (i) =>
      i.status === "not_applicable" &&
      (!i.notApplicableReason?.trim() || !i.acknowledgedByReviewer),
  );
  if (invalidNa.length > 0) {
    reasons.push(
      `${invalidNa.length} item(s) marked Not applicable without a reason or reviewer acknowledgement`,
    );
  }

  // Guides: a guide with a configured URL that is outstanding (not sent-valid,
  // not exempted) blocks completion. A missing-URL guide cannot be sent but is
  // surfaced as outstanding follow-up rather than a hard call blocker.
  const outstandingUrlGuides = call.guides.filter(
    (g) => guideHasUrl(g, guides) && !isGuideSentValid(g, guides) && !isGuideExempt(g),
  );
  if (outstandingUrlGuides.length > 0) {
    reasons.push(
      `${outstandingUrlGuides.length} guide(s) with a configured link not sent or exempted: ${outstandingUrlGuides
        .map((g) => guideLabel(g, guides))
        .join("; ")}`,
    );
  }
  // Guides marked sent but invalid (no URL / "Guide link not added" / missing details).
  const invalidSent = call.guides.filter((g) => g.sent && !isGuideSentValid(g, guides));
  if (invalidSent.length > 0) {
    reasons.push(
      `${invalidSent.length} guide(s) marked Sent without a valid supplied URL/version (verbal walkthrough is not a sent guide)`,
    );
  }

  return { ok: reasons.length === 0, reasons };
}

export function deriveCallStatus(call: Call, guides: GuideLink[] = []): CallStatus {
  const items = call.items.map((i) => effectiveItem(call, i, guides));
  // Any needs_help item (an actual recorded issue) → needs follow-up.
  if (items.some(itemNeedsFollowUp)) return "needs_followup";
  // Invalid sent guides → needs follow-up (a real issue, not just unfinished).
  if (call.guides.some((g) => g.sent && !isGuideSentValid(g, guides))) return "needs_followup";

  const block = callCompletionBlock(call, guides);
  if (block.ok) return "completed";

  const touched =
    items.some((i) => i.status !== "not_checked") ||
    call.guides.some((g) => g.sent || g.walkthroughProvided) ||
    !!call.notes?.trim() ||
    !!call.finishedAt;
  return touched ? "in_progress" : "not_started";
}

// ---- Client-level ----

export function deriveClientStatus(client: Client, guides: GuideLink[] = []): CallStatus {
  const calls = client.calls;
  if (calls.length === 0) return "not_started";
  if (calls.some((c) => deriveCallStatus(c, guides) === "needs_followup")) return "needs_followup";

  const connDone = calls.some(
    (c) => c.type === "connection" && deriveCallStatus(c, guides) === "completed",
  );
  const onbDone = calls.some(
    (c) => c.type === "onboarding" && deriveCallStatus(c, guides) === "completed",
  );
  if (connDone && onbDone) return "completed";

  if (calls.every((c) => deriveCallStatus(c, guides) === "not_started")) return "not_started";
  return "in_progress";
}

// Next call type: use the planned one, else infer the missing required type.
export function nextCallTypeForClient(client: Client): import("./types").CallType {
  if (client.nextCallType) return client.nextCallType;
  const hasConn = client.calls.some((c) => c.type === "connection");
  return hasConn ? "onboarding" : "connection";
}

// The latest unfinished call of a given type (for "Continue"), or null.
export function unfinishedCallOfType(
  client: Client,
  type: import("./types").CallType,
): Call | null {
  const of = client.calls.filter((c) => c.type === type && !c.finishedAt);
  if (of.length === 0) return null;
  const sorted = of.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted[0] ?? null;
}

// ---- Guides ----

export function guideLabel(g: CallGuideRecord, guides: GuideLink[]): string {
  return guides.find((d) => d.id === g.guideId)?.label ?? g.guideId;
}

export function guideHasUrl(g: CallGuideRecord, guides: GuideLink[]): boolean {
  return !!guides.find((d) => d.id === g.guideId)?.url?.trim();
}

export function guideUrl(g: CallGuideRecord, guides: GuideLink[]): string | undefined {
  return guides.find((d) => d.id === g.guideId)?.url;
}

export function isGuideSentValid(g: CallGuideRecord, guides: GuideLink[]): boolean {
  if (!g.sent) return false;
  if (!g.sentAt) return false;
  if (!g.channel) return false;
  if (!g.sentBy?.trim()) return false;
  const supplied = g.suppliedUrlOrVersion?.trim();
  if (!supplied) return false;
  if (/guide link not added/i.test(supplied)) return false;
  // A guide with no configured URL cannot be sent at all.
  if (!guideHasUrl(g, guides)) return false;
  return true;
}

export function isGuideExempt(g: CallGuideRecord): boolean {
  return !g.sent && !!g.notApplicableReason?.trim() && !!g.acknowledgedByReviewer;
}

export function isGuideOutstanding(g: CallGuideRecord, guides: GuideLink[]): boolean {
  if (g.sent) return false;
  if (isGuideExempt(g)) return false;
  void guides;
  return true;
}

// ---- Follow-up actions (by owner) ----

export interface FollowUpAction {
  clientId: string;
  callId: string;
  businessName: string;
  owner: string;
  kind: "item" | "guide";
  summary: string;
  nextAction?: string | undefined;
  detail?: string | undefined;
}

export function outstandingActions(client: Client, guides: GuideLink[]): FollowUpAction[] {
  const out: FollowUpAction[] = [];
  for (const call of client.calls) {
    const items = call.items.map((i) => effectiveItem(call, i, guides));
    for (const item of items) {
      if (itemNeedsFollowUp(item)) {
        out.push({
          clientId: client.id,
          callId: call.id,
          businessName: client.businessName,
          owner: item.completedBy?.trim() || client.assignedTeamMember,
          kind: "item",
          summary: `${item.label} — ${item.issue?.trim() || "needs help"}`,
          nextAction: item.nextAction,
          detail: call.type,
        });
      }
    }
    for (const g of call.guides) {
      if (isGuideOutstanding(g, guides)) {
        out.push({
          clientId: client.id,
          callId: call.id,
          businessName: client.businessName,
          owner: client.assignedTeamMember,
          kind: "guide",
          summary: `Guide not sent: ${guideLabel(g, guides)}`,
          detail: guideHasUrl(g, guides) ? "Configured link not yet sent" : "Guide link not added",
        });
      }
    }
  }
  return out;
}

// ---- Theming helpers ----

export function statusColor(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "var(--color-chart-1)";
    case "in_progress":
      return "var(--color-primary)";
    case "needs_followup":
      return "var(--color-destructive)";
    case "not_started":
    default:
      return "var(--color-muted-foreground)";
  }
}

export function statusLabel(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "needs_followup":
      return "Needs follow-up";
    case "not_started":
    default:
      return "Not started";
  }
}