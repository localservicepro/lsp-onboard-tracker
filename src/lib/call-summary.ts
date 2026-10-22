import type { Client } from "./types";
import {
  isAccessDone,
  isConnectionSatisfied,
  isConnectionExempt,
  isTaskSatisfied,
  taskCompletionProofValid,
  isStaffVerificationDone,
  unresolvedBlockers,
  derivedOverallStatus,
} from "./completion";

// Build a copyable call-summary draft.
// This is a RECORD only — it is never sent automatically. The caller copies it manually.
export function buildCallSummary(client: Client): string {
  const completedByClient = client.tasks.filter((t) => taskCompletionProofValid(t));
  const demonstratedOnly = client.tasks.filter((t) => t.status === "demonstrated_by_staff");
  const exemptedTasks = client.tasks.filter((t) => t.status === "not_applicable" && t.acknowledgedByReviewer);

  const verifiedConnections = client.connections.filter((c) => c.status === "connected" && isConnectionSatisfied(c));
  const exemptedConnections = client.connections.filter(isConnectionExempt);
  const blockedConnections = client.connections.filter((c) => c.status === "blocked");
  const uncheckedConnections = client.connections.filter((c) => c.status === "not_checked");

  const accessCompleted = client.accessChecks.filter(isAccessDone);
  const blockers = unresolvedBlockers(client);
  const guidesSent = client.guides.filter((g) => g.sent && g.sentAt);

  const overall = derivedOverallStatus(client);

  const lines: string[] = [];
  lines.push("==================================================");
  lines.push("LSP ONBOARDING CALL SUMMARY — STAFF RECORD ONLY");
  lines.push("==================================================");
  lines.push(`Business: ${client.businessName}`);
  lines.push(`Client: ${client.clientName}`);
  lines.push(`Assigned Staff: ${client.assignedTeamMember}`);
  lines.push(`Call Date: ${client.callDate}`);
  lines.push(`Plan/Inclusions: ${client.plan}`);
  if (client.nextCallDate) lines.push(`Next Call / Follow-up Date: ${client.nextCallDate}`);
  lines.push(`Overall Status: ${overall.toUpperCase()}`);
  lines.push("");

  // 1. ACCESS CHECKS
  lines.push(`1. PHONE-APP ACCESS CHECKS (${accessCompleted.length}/${client.accessChecks.length}):`);
  client.accessChecks.forEach((a) => {
    const mark = isAccessDone(a) ? "[VERIFIED]" : "[PENDING]";
    const by = a.verifier ? ` (verifier: ${a.verifier})` : "";
    const note = a.resultNote ? ` — ${a.resultNote}` : "";
    lines.push(`   ${mark} ${a.label}${by}${note}`);
  });
  lines.push("");

  // 2. CONNECTIONS VERIFIED
  lines.push(`2. CONNECTIONS VERIFIED (${verifiedConnections.length} connected, ${exemptedConnections.length} exempted):`);
  if (verifiedConnections.length === 0) {
    lines.push("   - None connected yet");
  } else {
    verifiedConnections.forEach((c) => {
      const by = c.verifier ? ` — verifier: ${c.verifier}` : "";
      const req = c.required ? " (Required)" : " (Optional)";
      lines.push(`   - [CONNECTED] ${c.label}${req}${by}`);
    });
  }
  if (exemptedConnections.length > 0) {
    lines.push("   Approved Exemptions (N/A):");
    exemptedConnections.forEach((c) => {
      lines.push(`   - [N/A EXEMPT] ${c.label} (Reason: ${c.notApplicableReason ?? "None"}; Acknowledged: Yes)`);
    });
  }
  if (blockedConnections.length > 0) {
    lines.push("   Blocked Connections:");
    blockedConnections.forEach((c) => lines.push(`   - [BLOCKED] ${c.label}`));
  }
  if (uncheckedConnections.length > 0) {
    lines.push("   Unchecked Connections:");
    uncheckedConnections.forEach((c) => lines.push(`   - [NOT CHECKED] ${c.label}${c.required ? " *REQUIRED*" : ""}`));
  }
  lines.push("");

  // 3. CLIENT-LED PRACTICE
  lines.push(`3. CLIENT-LED PRACTICAL TASKS (${completedByClient.length}/${client.tasks.length} completed by client):`);
  if (completedByClient.length === 0) {
    lines.push("   - None completed by client yet");
  } else {
    completedByClient.forEach((t) => {
      const review = t.reviewOutcome ? ` [Review outcome: ${t.reviewOutcome}]` : "";
      const evidence = t.evidence ? ` (Evidence: "${t.evidence}")` : "";
      lines.push(`   - [CLIENT COMPLETED] ${t.label}${review}${evidence}`);
    });
  }
  if (demonstratedOnly.length > 0) {
    lines.push("");
    lines.push(`   ⚠️ Tasks Demonstrated by Staff Only (${demonstratedOnly.length}):`);
    lines.push("   (NOTE: Staff demonstration does NOT count as client completion)");
    demonstratedOnly.forEach((t) => lines.push(`   - [STAFF DEMO ONLY] ${t.label}`));
  }
  if (exemptedTasks.length > 0) {
    lines.push("");
    lines.push(`   Approved Practical Exemptions (${exemptedTasks.length}):`);
    exemptedTasks.forEach((t) => lines.push(`   - [N/A EXEMPT] ${t.label} (Reason: ${t.notApplicableReason})`));
  }
  lines.push("");

  // 4. STAFF VERIFICATION
  lines.push("4. STAFF VERIFICATION:");
  const sv = client.staffVerification;
  if (isStaffVerificationDone(sv)) {
    const outcome = sv.reviewOutcome ? ` [Review outcome: ${sv.reviewOutcome}]` : "";
    lines.push(`   [VERIFIED] ${sv.label} — verifier: ${sv.verifier ?? "Staff"}${outcome}`);
    if (sv.resultNote) lines.push(`   Result note: ${sv.resultNote}`);
  } else if (sv.status === "blocked") {
    lines.push(`   [BLOCKED] ${sv.label} — Result verification blocked`);
  } else {
    lines.push(`   [PENDING] ${sv.label} — Not yet verified by staff`);
  }
  lines.push("");

  // 5. BLOCKERS
  lines.push(`5. OPEN BLOCKERS (${blockers.length}):`);
  if (blockers.length === 0) {
    lines.push("   - None open");
  } else {
    blockers.forEach((b) => {
      lines.push(`   - [BLOCKER] ${b.summary}`);
      lines.push(`     Owner: ${b.owner} | Next action: ${b.nextAction}${b.dueDate ? ` | Due: ${b.dueDate}` : ""}`);
    });
  }
  lines.push("");

  // 6. GUIDES SENT
  lines.push(`6. HOW-TO GUIDES RECORDED AS SENT (${guidesSent.length}):`);
  if (guidesSent.length === 0) {
    lines.push("   - None sent yet");
  } else {
    guidesSent.forEach((g) => {
      const channel = g.channel ? ` via ${g.channel}` : "";
      const by = g.sentBy ? ` by ${g.sentBy}` : "";
      const date = g.sentAt ? ` on ${g.sentAt.slice(0, 10)}` : "";
      const urlInfo = g.suppliedUrlOrVersion ? ` [Link: ${g.suppliedUrlOrVersion}]` : "";
      lines.push(`   - ${g.guideId}${channel}${by}${date}${urlInfo}`);
    });
  }
  lines.push("==================================================");

  return lines.join("\n");
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* ignore */
    }
    resolve();
  });
}
