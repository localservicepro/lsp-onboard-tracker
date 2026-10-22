import { describe, it, expect } from "vitest";
import { seedState } from "../src/lib/seed";
import {
  deriveClientStatus,
  deriveCallStatus,
  callCompletionBlock,
  isItemDone,
  isGuideSentValid,
  isGuideOutstanding,
  outstandingActions,
} from "../src/lib/completion";
import { buildCallSummary, buildClientSummary } from "../src/lib/call-summary";
import type { CallItem, CallGuideRecord } from "../src/lib/types";

const state = seedState();
const guides = state.settings.guides;

describe("LSP Onboarding Checklist — acceptance rules", () => {
  it("both internal test records exist exactly once and start with no completed tasks", () => {
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test");
    const main = state.clients.find((c) => c.businessName === "LSP Main — Onboarding Test");
    expect(trial).toBeDefined();
    expect(main).toBeDefined();
    expect(state.clients.filter((c) => c.businessName === "LSP Trial — Onboarding Test").length).toBe(1);
    expect(state.clients.filter((c) => c.businessName === "LSP Main — Onboarding Test").length).toBe(1);
    expect(trial!.isTestRecord).toBe(true);
    expect(main!.isTestRecord).toBe(true);
    expect(deriveClientStatus(trial!, guides)).toBe("not_started");
    expect(deriveClientStatus(main!, guides)).toBe("not_started");
    expect(trial!.calls.length).toBe(0);
    expect(main!.calls.length).toBe(0);
  });

  it("Jay and Nathaniel can be selected as staff", () => {
    const names = state.settings.team.map((t) => t.name);
    expect(names).toContain("Jay");
    expect(names).toContain("Nathaniel");
  });

  it("a staff demonstration (demonstrated_by_staff) does not count as client completion", () => {
    // In the call-based model, client completion requires status 'done' + evidence.
    // A staff demo is simply not marking 'done' — there is no 'demonstrated' status
    // that inflates progress. Verify isItemDone requires evidence for client_action.
    const demo: CallItem = {
      id: "x",
      label: "Client manually adds an agreed contact",
      kind: "client_action",
      required: true,
      status: "done",
      completedBy: "Staff",
      completedAt: new Date().toISOString(),
      evidence: "", // empty — not valid
      audit: [],
    };
    expect(isItemDone(demo)).toBe(false);
    demo.evidence = "Client added test contact.";
    expect(isItemDone(demo)).toBe(true);
  });

  it("client completion cannot be saved without confirmation and evidence", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const onb = summit.calls.find((c) => c.type === "onboarding")!;
    // All client tasks are 'done' WITH evidence → valid. Staff check is needs_help.
    const clientTasks = onb.items.filter((i) => i.kind === "client_action");
    expect(clientTasks.every((i) => isItemDone(i))).toBe(true);
    // But the call is NOT complete because staff verification needs help.
    expect(deriveCallStatus(onb, guides)).toBe("needs_followup");
  });

  it("missing required access checks prevent overall completion", () => {
    // Northwind has a connection call with Instagram needs_help + FB not checked.
    const northwind = state.clients.find((c) => c.businessName === "Northwind Dental")!;
    expect(deriveClientStatus(northwind, guides)).toBe("needs_followup");
  });

  it("an unresolved blocker (needs_help) prevents overall completion", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const onb = summit.calls.find((c) => c.type === "onboarding")!;
    const block = callCompletionBlock(onb, guides);
    expect(block.ok).toBe(false);
    expect(block.reasons.some((r) => /need help|unresolved/i.test(r))).toBe(true);
  });

  it("staff verification does not use client-performed confirmation", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const onb = summit.calls.find((c) => c.type === "onboarding")!;
    const staffCheck = onb.items.find((i) => i.kind === "staff_check" && i.label.startsWith("Staff checks"))!;
    expect(staffCheck.kind).toBe("staff_check");
    expect(staffCheck.status).toBe("needs_help");
  });

  it("Sent and Receipt confirmed remain distinct review outcomes", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const onb = summit.calls.find((c) => c.type === "onboarding")!;
    const sendTask = onb.items.find((i) => i.label.startsWith("Client personally sends"))!;
    const staffCheck = onb.items.find((i) => i.label.startsWith("Staff checks"))!;
    expect(sendTask.reviewOutcome).toBe("sent");
    expect(staffCheck.reviewOutcome).toBe("sent");
    expect(staffCheck.reviewOutcome).not.toBe("receipt_confirmed");
    // Harbor has receipt_confirmed.
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    const harborCheck = harborOnb.items.find((i) => i.label.startsWith("Staff checks"))!;
    expect(harborCheck.reviewOutcome).toBe("receipt_confirmed");
  });

  it("a missing guide cannot count as Sent", () => {
    // addLead and sendReview guides have no URL.
    const addLeadGuide = guides.find((g) => g.id === "guide-add-lead")!;
    expect(addLeadGuide.url).toBeUndefined();
    const rec: CallGuideRecord = {
      guideId: "guide-add-lead",
      sent: true,
      sentAt: new Date().toISOString(),
      channel: "email",
      sentBy: "Staff",
      suppliedUrlOrVersion: "Guide link not added (verbal walkthrough)",
      audit: [],
    };
    expect(isGuideSentValid(rec, guides)).toBe(false);
  });

  it("a verbal walkthrough is recorded separately and does not count as sent", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    const addLead = harborOnb.guides.find((g) => g.guideId === "guide-add-lead")!;
    expect(addLead.walkthroughProvided).toBe(true);
    expect(addLead.sent).toBe(false);
    expect(isGuideSentValid(addLead, guides)).toBe(false);
    expect(isGuideOutstanding(addLead, guides)).toBe(true);
  });

  it("summaries show readable guide names, not internal IDs", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    const summary = buildCallSummary(harbor, harborOnb, guides);
    expect(summary).not.toContain("guide-add-lead");
    expect(summary).not.toContain("guide-send-review");
    expect(summary).not.toContain("guide-onboarding-hub");
    expect(summary).toContain("Add a lead manually in the phone app");
    const clientSummary = buildClientSummary(harbor, guides);
    expect(clientSummary).not.toContain("guide-");
  });

  it("Harbor (both calls completed) derives completed; Northwind derives needs_followup", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    expect(deriveClientStatus(harbor, guides)).toBe("completed");
    const northwind = state.clients.find((c) => c.businessName === "Northwind Dental")!;
    expect(deriveClientStatus(northwind, guides)).toBe("needs_followup");
  });

  it("outstanding actions are grouped by owner", () => {
    const actions = state.clients.flatMap((c) => outstandingActions(c, guides));
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.owner.trim().length > 0)).toBe(true);
  });
});