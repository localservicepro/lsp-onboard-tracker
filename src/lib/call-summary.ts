import type { Client } from "./types";
import { isConnectionDone, isTaskDoneForOverall, taskCompletionProofValid, unresolvedBlockers } from "./completion";

// Build a copyable call-summary draft. This is a RECORD only — it is never
// sent automatically. The caller copies it manually.
export function buildCallSummary(client: Client): string {
  const completedByClient = client.tasks.filter((t) => taskCompletionProofValid(t));
  const demonstratedOnly = client.tasks.filter(
    (t) => t.status === "demonstrated_by_staff" && !taskCompletionProofValid(t),
  );
  const connectionsVerified = client.connections.filter((c) => isConnectionDone(c));
  const connectionsBlocked = client.connections.filter((c) => c.status === "blocked");
  const blockers = unresolvedBlockers(client);
  const guidesSent = client.guides.filter((g) => g.sent);

  const lines: string[] = [];
  lines.push(`LSP Onboarding — Call summary`);
  lines.push(`Business: ${client.businessName}`);
  lines.push(`Client: ${client.clientName}`);
  lines.push(`Assigned: ${client.assignedTeamMember}`);
  lines.push("");
  lines.push(`Completed by client (${completedByClient.length}):`);
  if (completedByClient.length === 0) {
    lines.push(`- None yet`);
  } else {
    completedByClient.forEach((t) => {
      const review = t.reviewOutcome ? ` [review: ${t.reviewOutcome}]` : "";
      lines.push(`- ${t.label}${review}`);
    });
  }
  if (demonstratedOnly.length > 0) {
    lines.push(``);
    lines.push(`Demonstrated by staff only (does NOT count as client completion): ${demonstratedOnly.length}`);
  }
  lines.push("");
  lines.push(`Connections verified (${connectionsVerified.length}/${client.connections.length}):`);
  if (connectionsVerified.length === 0) {
    lines.push(`- None verified`);
  } else {
    connectionsVerified.forEach((c) => {
      const by = c.verifier ? ` — ${c.verifier}` : "";
      lines.push(`- ${c.label}${by}`);
    });
  }
  if (connectionsBlocked.length > 0) {
    lines.push(``);
    lines.push(`Connections blocked:`);
    connectionsBlocked.forEach((c) => lines.push(`- ${c.label}`));
  }
  lines.push("");
  lines.push(`Blockers (${blockers.length}):`);
  if (blockers.length === 0) {
    lines.push(`- None open`);
  } else {
    blockers.forEach((b) => {
      lines.push(`- ${b.summary}`);
      lines.push(`    Owner: ${b.owner} — Next action: ${b.nextAction}`);
    });
  }
  lines.push("");
  lines.push(`Guides sent (${guidesSent.length}/${client.guides.length}):`);
  if (guidesSent.length === 0) {
    lines.push(`- None sent`);
  } else {
    guidesSent.forEach((g) => {
      const ch = g.channel ? ` via ${g.channel}` : "";
      const by = g.sentBy ? ` by ${g.sentBy}` : "";
      lines.push(`- ${g.guideId}${ch}${by}`);
    });
  }
  lines.push("");
  const incomplete = client.tasks.filter((t) => !isTaskDoneForOverall(t)).length;
  lines.push(`Overall: ${client.overallStatus} — ${incomplete} practical task(s) still outstanding.`);
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