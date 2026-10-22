import type { Client, Call, GuideLink } from "./types";
import {
  isItemDone,
  isItemSatisfied,
  isItemExempt,
  itemNeedsFollowUp,
  itemStatusLabel,
  isItemDemonstrated,
  effectiveItem,
  callCompletionBlock,
  deriveCallStatus,
  deriveClientStatus,
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
  guideLabel,
  guideHasUrl,
} from "./completion";

// Build a short, readable call summary. RECORD only — copying never sends anything.
export function buildCallSummary(client: Client, call: Call, guides: GuideLink[] = []): string {
  const callStatus = deriveCallStatus(call, guides);
  const clientStatus = deriveClientStatus(client, guides);
  const block = callCompletionBlock(call, guides);

  const effItems = call.items.map((i) => effectiveItem(call, i, guides));
  const completed = effItems.filter((i) => i.status === "done" && isItemDone(i));
  const needsHelp = effItems.filter(itemNeedsFollowUp);
  const exempt = effItems.filter(isItemExempt);
  const notChecked = effItems.filter((i) => i.status === "not_checked");

  // Demo & Client Practice split.
  const clientPerformed = completed.filter((i) => i.kind === "client_action");
  const staffDemonstratedOnly = effItems.filter(
    (i) => isItemDemonstrated(i) && !(i.status === "done" && isItemDone(i)),
  );
  const needsPractice = needsHelp.filter((i) => i.kind === "client_action");

  const guidesSent = call.guides.filter((g) => isGuideSentValid(g, guides));
  const walkthroughs = call.guides.filter((g) => g.walkthroughProvided);
  const outstandingGuides = call.guides.filter((g) => isGuideOutstanding(g, guides));
  const exemptGuides = call.guides.filter((g) => isGuideExempt(g));

  const lines: string[] = [];
  lines.push("==================================================");
  lines.push("LSP ONBOARDING — CALL SUMMARY (STAFF RECORD ONLY)");
  lines.push("==================================================");
  lines.push(`Business: ${client.businessName}`);
  lines.push(`Client: ${client.clientName}`);
  lines.push(`Assigned Staff: ${client.assignedTeamMember}`);
  lines.push(
    `Call Type: ${call.type === "connection" ? "Integration & Connection" : "Onboarding & Training"}`,
  );
  lines.push(`Call Date: ${call.date}`);
  lines.push(`Observing Staff: ${call.staffMember}`);
  if (client.accountContext) lines.push(`Account Context: ${client.accountContext}`);
  lines.push(`This Call Status: ${callStatus.toUpperCase().replace("_", " ")}`);
  lines.push(`Client Overall Status: ${clientStatus.toUpperCase().replace("_", " ")}`);
  if (client.isTestRecord)
    lines.push("NOTE: Internal test record — not a completed onboarding example.");
  lines.push("");

  // Client successfully performed (only this counts as practical completion)
  lines.push(`CLIENT SUCCESSFULLY PERFORMED (${clientPerformed.length}):`);
  if (clientPerformed.length === 0) {
    lines.push("  - None");
  } else {
    clientPerformed.forEach((i) => {
      const ev = i.evidence ? ` — "${i.evidence}"` : "";
      const ro = i.reviewOutcome ? ` [review: ${i.reviewOutcome}]` : "";
      lines.push(`  - ${i.label}${ro}${ev}`);
    });
  }
  lines.push("");

  // Staff demonstrated (does NOT count as client completion)
  if (staffDemonstratedOnly.length > 0) {
    lines.push(
      `STAFF DEMONSTRATED ONLY (${staffDemonstratedOnly.length}) — not client completion:`,
    );
    staffDemonstratedOnly.forEach((i) => {
      const by = i.staffDemonstratedBy ? ` by ${i.staffDemonstratedBy}` : "";
      lines.push(`  - ${i.label}${by}`);
    });
    lines.push("");
  }

  // Client needs more practice
  if (needsPractice.length > 0) {
    lines.push(`CLIENT NEEDS MORE PRACTICE (${needsPractice.length}):`);
    needsPractice.forEach((i) => {
      lines.push(`  - ${i.label}: ${i.issue?.trim() || "needs help"}`);
      if (i.nextAction) lines.push(`      Next action: ${i.nextAction}`);
    });
    lines.push("");
  }

  // Other completed (staff checks)
  const staffDone = completed.filter((i) => i.kind === "staff_check");
  if (staffDone.length > 0) {
    lines.push(`STAFF CHECKS DONE (${staffDone.length}):`);
    staffDone.forEach((i) => {
      const ev = i.evidence ? ` — "${i.evidence}"` : "";
      lines.push(`  - ${i.label}${ev}`);
    });
    lines.push("");
  }

  // Other items needing help (staff checks / non-practice) — practice needs
  // are already listed under "CLIENT NEEDS MORE PRACTICE" above.
  const otherNeedsHelp = needsHelp.filter((i) => i.kind !== "client_action");
  if (otherNeedsHelp.length > 0) {
    lines.push(`OTHER ITEMS NEEDING HELP (${otherNeedsHelp.length}):`);
    otherNeedsHelp.forEach((i) => {
      lines.push(`  - ${i.label}: ${i.issue?.trim() || "issue recorded"}`);
      if (i.nextAction) lines.push(`      Next action: ${i.nextAction}`);
    });
    lines.push("");
  }

  // Owner & next action (call-level follow-up)
  if (call.followUpAction || call.followUpDate) {
    lines.push("FOLLOW-UP:");
    if (call.followUpAction) lines.push(`  - Action: ${call.followUpAction}`);
    if (call.followUpDate) lines.push(`  - Due: ${call.followUpDate}`);
    lines.push(`  - Owner: ${client.assignedTeamMember}`);
    lines.push("");
  }

  // Next call date
  if (client.nextCallDate) {
    const t =
      client.nextCallType === "connection"
        ? "Integration & Connection"
        : client.nextCallType === "onboarding"
          ? "Onboarding & Training"
          : "Next call";
    lines.push(`NEXT CALL: ${t} on ${client.nextCallDate}`);
    lines.push("");
  }

  // Guides actually sent
  lines.push(`GUIDES SENT (${guidesSent.length}):`);
  if (guidesSent.length === 0) {
    lines.push("  - None sent (with valid supplied link)");
  } else {
    guidesSent.forEach((g) => {
      const name = guideLabel(g, guides);
      const ch = g.channel ? ` via ${g.channel}` : "";
      const by = g.sentBy ? ` by ${g.sentBy}` : "";
      const date = g.sentAt ? ` on ${g.sentAt.slice(0, 10)}` : "";
      lines.push(`  - ${name}${ch}${by}${date}`);
    });
  }
  lines.push("");

  // Verbal walkthroughs (separate — never counts as sent)
  if (walkthroughs.length > 0) {
    lines.push(`VERBAL WALKTHROUGHS (${walkthroughs.length}) — NOT sent guides:`);
    walkthroughs.forEach((g) => {
      const name = guideLabel(g, guides);
      const by = g.walkthroughBy ? ` by ${g.walkthroughBy}` : "";
      const date = g.walkthroughAt ? ` on ${g.walkthroughAt.slice(0, 10)}` : "";
      lines.push(`  - ${name}${by}${date}`);
    });
    lines.push("");
  }

  // Required guides still outstanding
  if (outstandingGuides.length > 0) {
    lines.push(`GUIDES STILL OUTSTANDING (${outstandingGuides.length}):`);
    outstandingGuides.forEach((g) => {
      const missing = guideHasUrl(g, guides) ? "" : " [Guide link not added]";
      lines.push(`  - ${guideLabel(g, guides)}${missing}`);
    });
    lines.push("");
  }

  // Approved exemptions
  const allExempt = [
    ...exempt.map((i) => ({ name: i.label, reason: i.notApplicableReason })),
    ...exemptGuides.map((g) => ({ name: guideLabel(g, guides), reason: g.notApplicableReason })),
  ];
  if (allExempt.length > 0) {
    lines.push(`APPROVED EXEMPTIONS (${allExempt.length}):`);
    allExempt.forEach((e) => lines.push(`  - ${e.name} (Reason: ${e.reason})`));
    lines.push("");
  }

  if (notChecked.length > 0) {
    lines.push(
      `NOT YET CHECKED (${notChecked.length}): ${notChecked.map((i) => i.label).join("; ")}`,
    );
    lines.push("");
  }

  if (!block.ok) {
    lines.push(`CALL NOT COMPLETE — ${block.reasons.join("; ")}`);
  } else {
    lines.push("CALL COMPLETE — all required items satisfied, no unresolved issues.");
  }
  lines.push("==================================================");

  return lines.join("\n");
}

// Client-level summary across all calls (for the client detail page).
export function buildClientSummary(client: Client, guides: GuideLink[] = []): string {
  const status = deriveClientStatus(client, guides);
  const lines: string[] = [];
  lines.push("==================================================");
  lines.push("LSP ONBOARDING — CLIENT SUMMARY (STAFF RECORD ONLY)");
  lines.push("==================================================");
  lines.push(`Business: ${client.businessName}`);
  lines.push(`Client: ${client.clientName}`);
  lines.push(`Assigned Staff: ${client.assignedTeamMember}`);
  if (client.accountContext) lines.push(`Account Context: ${client.accountContext}`);
  lines.push(`Overall Status: ${status.toUpperCase().replace("_", " ")}`);
  if (client.isTestRecord)
    lines.push("NOTE: Internal test record — not a completed onboarding example.");
  lines.push("");

  // Calls
  lines.push(`CALLS (${client.calls.length}):`);
  if (client.calls.length === 0) {
    lines.push("  - No calls logged yet");
  } else {
    [...client.calls]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((c) => {
        const cs = deriveCallStatus(c, guides);
        const block = callCompletionBlock(c, guides);
        lines.push(
          `  - ${c.type === "connection" ? "Integration & Connection" : "Onboarding & Training"} on ${c.date} (${cs.replace("_", " ")}) — ${block.ok ? "complete" : `${block.reasons.length} issue(s)`}`,
        );
      });
  }

  // Demo & Client Practice aggregate across all calls
  let performed = 0;
  let demonstratedOnly = 0;
  let needsPractice = 0;
  for (const c of client.calls) {
    const effItems = c.items.map((i) => effectiveItem(c, i, guides));
    for (const it of effItems) {
      if (it.kind !== "client_action") continue;
      if (it.status === "done" && isItemDone(it)) performed++;
      else if (isItemDemonstrated(it)) demonstratedOnly++;
      if (itemNeedsFollowUp(it)) needsPractice++;
    }
  }
  lines.push(
    `CLIENT PRACTICE: ${performed} performed · ${demonstratedOnly} staff-demonstrated only · ${needsPractice} need more practice`,
  );
  lines.push("");

  // Aggregated guides actually sent across all calls
  const sentGuides = new Map<
    string,
    {
      name: string;
      channel?: string | undefined;
      sentBy?: string | undefined;
      sentAt?: string | undefined;
    }
  >();
  const walkthroughs: { name: string; by?: string | undefined; at?: string | undefined }[] = [];
  const outstandingGuides: string[] = [];
  for (const c of client.calls) {
    for (const g of c.guides) {
      const name = guideLabel(g, guides);
      if (isGuideSentValid(g, guides)) {
        if (!sentGuides.has(g.guideId)) {
          sentGuides.set(g.guideId, {
            name,
            channel: g.channel,
            sentBy: g.sentBy,
            sentAt: g.sentAt,
          });
        }
      }
      if (g.walkthroughProvided)
        walkthroughs.push({ name, by: g.walkthroughBy, at: g.walkthroughAt });
      if (isGuideOutstanding(g, guides))
        outstandingGuides.push(name + (guideHasUrl(g, guides) ? "" : " [Guide link not added]"));
    }
  }

  lines.push(`GUIDES SENT (${sentGuides.size}):`);
  if (sentGuides.size === 0) lines.push("  - None sent (with valid supplied link)");
  else
    for (const g of sentGuides.values()) {
      const ch = g.channel ? ` via ${g.channel}` : "";
      const by = g.sentBy ? ` by ${g.sentBy}` : "";
      const dt = g.sentAt ? ` on ${g.sentAt.slice(0, 10)}` : "";
      lines.push(`  - ${g.name}${ch}${by}${dt}`);
    }
  lines.push("");

  if (walkthroughs.length > 0) {
    lines.push(`VERBAL WALKTHROUGHS (${walkthroughs.length}) — NOT sent guides:`);
    walkthroughs.forEach((w) => {
      const by = w.by ? ` by ${w.by}` : "";
      const dt = w.at ? ` on ${w.at.slice(0, 10)}` : "";
      lines.push(`  - ${w.name}${by}${dt}`);
    });
    lines.push("");
  }

  if (outstandingGuides.length > 0) {
    lines.push(`GUIDES STILL OUTSTANDING (${outstandingGuides.length}):`);
    outstandingGuides.forEach((g) => lines.push(`  - ${g}`));
    lines.push("");
  }

  // Open follow-up actions across all calls
  const openActions: {
    call: string;
    owner: string;
    summary: string;
    next?: string | undefined;
    due?: string | undefined;
  }[] = [];
  for (const c of client.calls) {
    const effItems = c.items.map((i) => effectiveItem(c, i));
    for (const it of effItems) {
      if (itemNeedsFollowUp(it)) {
        openActions.push({
          call: c.type === "connection" ? "Connection" : "Onboarding",
          owner: it.completedBy?.trim() || client.assignedTeamMember,
          summary: `${it.label}: ${it.issue?.trim() || "needs help"}`,
          next: it.nextAction,
        });
      }
    }
    if (c.followUpAction) {
      openActions.push({
        call: c.type === "connection" ? "Connection" : "Onboarding",
        owner: client.assignedTeamMember,
        summary: c.followUpAction,
        due: c.followUpDate,
      });
    }
  }
  if (openActions.length > 0) {
    lines.push(`OPEN FOLLOW-UP ACTIONS (${openActions.length}):`);
    openActions.forEach((a) => {
      lines.push(
        `  - [${a.call}] ${a.summary} (Owner: ${a.owner}${a.next ? `; Next: ${a.next}` : ""}${a.due ? `; Due: ${a.due}` : ""})`,
      );
    });
    lines.push("");
  }

  if (client.nextCallDate) {
    const t =
      client.nextCallType === "connection"
        ? "Integration & Connection"
        : client.nextCallType === "onboarding"
          ? "Onboarding & Training"
          : "Next call";
    lines.push(`NEXT CALL: ${t} on ${client.nextCallDate}`);
    lines.push("");
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
