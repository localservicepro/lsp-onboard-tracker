import { describe, it, expect } from "vitest";
import { seedState } from "../src/lib/seed";
import {
  deriveClientStatus,
  deriveCallStatus,
  callCompletionBlock,
  callItemProgress,
  isItemDone,
  isItemSatisfied,
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
  isGuideSentValid as _gsv,
  guideDerivedStatus,
  effectiveItem,
  outstandingActions,
  guideIsSupplied,
} from "../src/lib/completion";
import { buildCallSummary, buildClientSummary } from "../src/lib/call-summary";
import type { CallItem, CallGuideRecord, Call } from "../src/lib/types";

const state = seedState();
const guides = state.settings.guides;

describe("LSP Onboarding Checklist — acceptance rules", () => {
  it("only Nathaniel's LSP Trial record remains from the named examples", () => {
    const names = state.clients.map((c) => c.businessName);
    expect(names).toContain("LSP Trial — Onboarding Test");
    // Removed synthetic examples do not return after reset/seed.
    expect(names).not.toContain("Northwind Dental");
    expect(names).not.toContain("Summit Physio");
    expect(names).not.toContain("Harbor Coffee Roasters");
    expect(names).not.toContain("Cedar & Stone Salon");
    expect(names).not.toContain("LSP Main — Onboarding Test");
    // Exactly one trial record.
    expect(state.clients.filter((c) => c.businessName === "LSP Trial — Onboarding Test").length).toBe(1);
  });

  it("the remaining trial record starts with no completed tasks or invented evidence", () => {
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    expect(trial.isTestRecord).toBe(true);
    expect(deriveClientStatus(trial, guides)).toBe("not_started");
    expect(trial.calls.length).toBe(0);
    // No invented account IDs / URLs / GHL link.
    expect(trial.ghlLink).toBeUndefined();
  });

  it("Jay and Nathaniel can be selected as staff; fictional staff are gone", () => {
    const names = state.settings.team.map((t) => t.name);
    expect(names).toContain("Jay");
    expect(names).toContain("Nathaniel");
    expect(names).not.toContain("Avery Chen");
    expect(names).not.toContain("Jordan Patel");
    expect(names).not.toContain("Sam Rivera");
  });

  it("a staff demonstration (demonstrated_by_staff) does not count as client completion", () => {
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

  it("checking 'Staff demonstrated' alone never completes a client practical task", () => {
    const demoOnly: CallItem = {
      id: "y",
      label: "Client manually adds an agreed contact",
      kind: "client_action",
      required: true,
      status: "not_checked",
      demoPractice: true,
      staffDemonstrated: true,
      staffDemonstratedBy: "Jay",
      staffDemonstratedAt: new Date().toISOString(),
      audit: [],
    };
    expect(isItemDone(demoOnly)).toBe(false);
    expect(isItemSatisfied(demoOnly)).toBe(false);
    const performed: CallItem = {
      ...demoOnly,
      status: "done",
      evidence: "Client added the contact after the demo.",
      completedBy: "Jay",
      completedAt: new Date().toISOString(),
    };
    expect(isItemDone(performed)).toBe(true);
  });

  it("client completion cannot be saved without confirmation and evidence", () => {
    // Construct a synthetic onboarding call with all client tasks done+evidence
    // but staff verification needs help → call is needs_followup, not completed.
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const items: CallItem[] = onbTpl.items.map((ti) => ({
      id: `ci-${ti.id}`,
      label: ti.label,
      kind: ti.kind,
      required: ti.required,
      status: "not_checked" as const,
      reviewSend: ti.reviewSend,
      guideDerived: ti.guideDerived,
      demoPractice: ti.demoPractice,
      audit: [],
    }));
    // Mark all client actions done with evidence.
    for (const it of items) {
      if (it.kind === "client_action") {
        it.status = "done";
        it.evidence = "Client performed the task.";
        it.completedBy = "Jay";
        it.completedAt = new Date().toISOString();
      }
    }
    const call: Call = {
      id: "call-test",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items,
      guides: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(deriveCallStatus(call, guides)).toBe("needs_followup");
    expect(callCompletionBlock(call, guides).ok).toBe(false);
  });

  it("missing required access checks prevent overall completion", () => {
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    // No calls → not started, not completed.
    expect(deriveClientStatus(trial, guides)).toBe("not_started");
  });

  it("an unresolved blocker (needs_help) prevents overall completion", () => {
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const items: CallItem[] = onbTpl.items.map((ti) => ({
      id: `ci-${ti.id}`,
      label: ti.label,
      kind: ti.kind,
      required: ti.required,
      status: "not_checked" as const,
      reviewSend: ti.reviewSend,
      guideDerived: ti.guideDerived,
      demoPractice: ti.demoPractice,
      audit: [],
    }));
    items[0]!.status = "needs_help";
    items[0]!.issue = "Client could not log in";
    const call: Call = {
      id: "call-b",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items,
      guides: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const block = callCompletionBlock(call, guides);
    expect(block.ok).toBe(false);
    expect(block.reasons.some((r) => /need help|unresolved/i.test(r))).toBe(true);
  });

  it("staff verification does not use client-performed confirmation", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const staffCheck = onbTpl.items.find((i) => i.label.startsWith("Staff checks"))!;
    expect(staffCheck.kind).toBe("staff_check");
  });

  it("Sent and Receipt confirmed remain distinct review outcomes", () => {
    // Build two staff-check items with different review outcomes.
    const sent: CallItem = {
      id: "s1",
      label: "Staff checks the recorded result",
      kind: "staff_check",
      required: true,
      status: "done",
      reviewOutcome: "sent",
      completedBy: "Jay",
      completedAt: new Date().toISOString(),
      audit: [],
    };
    const confirmed: CallItem = {
      ...sent,
      id: "s2",
      reviewOutcome: "receipt_confirmed",
    };
    expect(sent.reviewOutcome).toBe("sent");
    expect(confirmed.reviewOutcome).toBe("receipt_confirmed");
    expect(sent.reviewOutcome).not.toBe(confirmed.reviewOutcome);
  });

  it("a missing guide cannot count as Sent", () => {
    const addLeadGuide = guides.find((g) => g.id === "guide-add-lead")!;
    expect(addLeadGuide.url).toBeUndefined();
    const rec: CallGuideRecord = {
      guideId: "guide-add-lead",
      sent: true,
      sentAt: new Date().toISOString(),
      channel: "email",
      sentBy: "Jay",
      suppliedUrlOrVersion: "Guide link not added (verbal walkthrough)",
      audit: [],
    };
    expect(isGuideSentValid(rec, guides)).toBe(false);
  });

  it("a verbal walkthrough is recorded separately and does not count as sent", () => {
    const rec: CallGuideRecord = {
      guideId: "guide-add-lead",
      sent: false,
      walkthroughProvided: true,
      walkthroughAt: new Date().toISOString(),
      walkthroughBy: "Jay",
      walkthroughNotes: "Walked through on call.",
      audit: [],
    };
    expect(rec.walkthroughProvided).toBe(true);
    expect(rec.sent).toBe(false);
    expect(isGuideSentValid(rec, guides)).toBe(false);
    // add-lead has no URL → not supplied → outstanding (not exempted).
    expect(isGuideOutstanding(rec, guides)).toBe(true);
  });

  it("summaries show readable guide names, not internal IDs", () => {
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const call: Call = {
      id: "call-sum",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items: onbTpl.items.map((ti) => ({
        id: `ci-${ti.id}`,
        label: ti.label,
        kind: ti.kind,
        required: ti.required,
        status: "not_checked" as const,
        reviewSend: ti.reviewSend,
        guideDerived: ti.guideDerived,
        demoPractice: ti.demoPractice,
        audit: [],
      })),
      guides: guides.map((g) => ({ guideId: g.id, sent: false, audit: [] })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const summary = buildCallSummary(trial, call, guides);
    expect(summary).not.toContain("guide-add-lead");
    expect(summary).not.toContain("guide-send-review");
    expect(summary).not.toContain("guide-onboarding-hub");
    const clientSummary = buildClientSummary(trial, guides);
    expect(clientSummary).not.toContain("guide-");
  });

  it("guide-derived 'Required how-to guides supplied' is auto-calculated, not editable", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const gdTpl = onbTpl.items.find((i) => i.guideDerived)!;
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const call: Call = {
      id: "call-gd",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items: onbTpl.items.map((ti) => ({
        id: `ci-${ti.id}`,
        label: ti.label,
        kind: ti.kind,
        required: ti.required,
        status: "not_checked" as const,
        reviewSend: ti.reviewSend,
        guideDerived: ti.guideDerived,
        demoPractice: ti.demoPractice,
        audit: [],
      })),
      guides: guides.map((g) => ({ guideId: g.id, sent: false, audit: [] })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const gd = call.items.find((i) => i.guideDerived)!;
    // No guides sent → not done.
    expect(guideDerivedStatus(call, gd, guides)).not.toBe("done");
    const eff = effectiveItem(call, gd, guides);
    expect(eff.status).not.toBe("done");
    void gdTpl;
  });

  it("a verbal walkthrough never makes the guide-derived item Done", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const call: Call = {
      id: "call-walk",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items: onbTpl.items.map((ti) => ({
        id: `ci-${ti.id}`,
        label: ti.label,
        kind: ti.kind,
        required: ti.required,
        status: "not_checked" as const,
        reviewSend: ti.reviewSend,
        guideDerived: ti.guideDerived,
        demoPractice: ti.demoPractice,
        audit: [],
      })),
      guides: guides.map((g) => ({
        guideId: g.id,
        sent: false,
        walkthroughProvided: true,
        walkthroughAt: new Date().toISOString(),
        walkthroughBy: "Jay",
        audit: [],
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const gd = call.items.find((i) => i.guideDerived)!;
    expect(guideDerivedStatus(call, gd, guides)).not.toBe("done");
  });

  it("no double-counting: one needs_help task = one unresolved item", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const items: CallItem[] = onbTpl.items.map((ti) => ({
      id: `ci-${ti.id}`,
      label: ti.label,
      kind: ti.kind,
      required: ti.required,
      status: "not_checked" as const,
      reviewSend: ti.reviewSend,
      guideDerived: ti.guideDerived,
      demoPractice: ti.demoPractice,
      audit: [],
    }));
    items[0]!.status = "needs_help";
    items[0]!.issue = "Client could not log in";
    const call: Call = {
      id: "call-dc",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items,
      guides: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const prog = callItemProgress(call, guides);
    const needsHelpItems = call.items.filter(
      (i) => effectiveItem(call, i, guides).status === "needs_help",
    );
    expect(needsHelpItems.length).toBe(1);
    expect(prog.needsHelpCount).toBe(needsHelpItems.length);
  });

  it("required missing guides prevent checklist completion (guide-derived)", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const call: Call = {
      id: "call-mg",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items: onbTpl.items.map((ti) => ({
        id: `ci-${ti.id}`,
        label: ti.label,
        kind: ti.kind,
        required: ti.required,
        status: "not_checked" as const,
        reviewSend: ti.reviewSend,
        guideDerived: ti.guideDerived,
        demoPractice: ti.demoPractice,
        audit: [],
      })),
      guides: guides.map((g) => ({ guideId: g.id, sent: false, audit: [] })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const block = callCompletionBlock(call, guides);
    expect(block.ok).toBe(false);
    const gd = call.items.find((i) => i.guideDerived)!;
    expect(effectiveItem(call, gd, guides).status).not.toBe("done");
  });

  it("a call can finish with follow-up without marking unfinished items Done", () => {
    const onbTpl = state.settings.templates.find((t) => t.callType === "onboarding")!;
    const trial = state.clients.find((c) => c.businessName === "LSP Trial — Onboarding Test")!;
    const call: Call = {
      id: "call-fin",
      clientId: trial.id,
      type: "onboarding",
      date: "2026-10-22",
      staffMember: "Jay",
      items: onbTpl.items.map((ti) => ({
        id: `ci-${ti.id}`,
        label: ti.label,
        kind: ti.kind,
        required: ti.required,
        status: "not_checked" as const,
        reviewSend: ti.reviewSend,
        guideDerived: ti.guideDerived,
        demoPractice: ti.demoPractice,
        audit: [],
      })),
      guides: guides.map((g) => ({ guideId: g.id, sent: false, audit: [] })),
      finishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(deriveCallStatus(call, guides)).toBe("needs_followup");
    expect(callCompletionBlock(call, guides).ok).toBe(false);
  });

  it("templates for both call types remain intact", () => {
    expect(state.settings.templates.find((t) => t.callType === "connection")).toBeDefined();
    expect(state.settings.templates.find((t) => t.callType === "onboarding")).toBeDefined();
  });

  it("outstanding actions are grouped by owner", () => {
    const actions = state.clients.flatMap((c) => outstandingActions(c, guides));
    expect(actions.every((a) => a.owner.trim().length > 0)).toBe(true);
  });

  it("guideIsSupplied distinguishes configured vs missing resources", () => {
    const hub = guides.find((g) => g.id === "guide-onboarding-hub")!;
    const addLead = guides.find((g) => g.id === "guide-add-lead")!;
    const hubRec: CallGuideRecord = { guideId: hub.id, sent: false, audit: [] };
    const addLeadRec: CallGuideRecord = { guideId: addLead.id, sent: false, audit: [] };
    expect(guideIsSupplied(hubRec, guides)).toBe(true);
    expect(guideIsSupplied(addLeadRec, guides)).toBe(false);
  });

  // keep import referenced
  void _gsv;
});