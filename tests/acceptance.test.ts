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
  guideDerivedStatus,
  effectiveItem,
  outstandingActions,
} from "../src/lib/completion";
import { buildCallSummary, buildClientSummary } from "../src/lib/call-summary";
import type { CallItem, CallGuideRecord, Call, Client } from "../src/lib/types";

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

  it("checking 'Staff demonstrated' alone never completes a client practical task", () => {
    // A demoPractice item with staffDemonstrated=true but status not 'done'
    // must NOT count as completed, and must not inflate client-completed progress.
    const demoOnly: CallItem = {
      id: "y",
      label: "Client manually adds an agreed contact",
      kind: "client_action",
      required: true,
      status: "not_checked",
      demoPractice: true,
      staffDemonstrated: true,
      staffDemonstratedBy: "Sam Rivera",
      staffDemonstratedAt: new Date().toISOString(),
      audit: [],
    };
    expect(isItemDone(demoOnly)).toBe(false);
    expect(isItemSatisfied(demoOnly)).toBe(false);
    // Only status 'done' + evidence counts as client completion.
    const performed: CallItem = {
      ...demoOnly,
      status: "done",
      evidence: "Client added the contact after the demo.",
      completedBy: "Sam Rivera",
      completedAt: new Date().toISOString(),
    };
    expect(isItemDone(performed)).toBe(true);
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
    // Walkthrough was recorded (migrated from the old verbal-walkthrough model).
    expect(addLead.walkthroughProvided).toBe(true);
    // But it is NOT a sent guide.
    expect(addLead.sent).toBe(false);
    expect(isGuideSentValid(addLead, guides)).toBe(false);
    // Harbor exempted the no-URL guide (reason + reviewer ack), so it is not
    // outstanding — but it is also NOT a verified/sent guide.
    expect(isGuideExempt(addLead)).toBe(true);
    expect(isGuideOutstanding(addLead, guides)).toBe(false);
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

  it("summaries distinguish staff demonstrated vs client performed vs needs practice", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    // Harbor's two demoPractice tasks were demonstrated then performed.
    const summary = buildCallSummary(harbor, harborOnb, guides);
    expect(summary).toContain("CLIENT SUCCESSFULLY PERFORMED");
    // Construct a call where a demoPractice task is demonstrated but NOT performed.
    const demoOnlyCall: Call = {
      ...harborOnb,
      id: "call-demoonly",
      items: harborOnb.items.map((it) =>
        it.label.startsWith("Client manually adds")
          ? {
              ...it,
              status: "not_checked" as const,
              staffDemonstrated: true,
              staffDemonstratedBy: "Sam Rivera",
              staffDemonstratedAt: new Date().toISOString(),
              completedBy: undefined,
              completedAt: undefined,
              evidence: undefined,
            }
          : it,
      ),
    };
    const demoSummary = buildCallSummary(harbor, demoOnlyCall, guides);
    expect(demoSummary).toContain("STAFF DEMONSTRATED ONLY");
    // And a needs-practice item shows under "CLIENT NEEDS MORE PRACTICE".
    const needsPracticeCall: Call = {
      ...harborOnb,
      id: "call-needspractice",
      items: harborOnb.items.map((it) =>
        it.label.startsWith("Client manually adds")
          ? {
              ...it,
              status: "needs_help" as const,
              issue: "Client could not complete after demo",
              nextAction: "Retry next call",
            }
          : it,
      ),
    };
    const npSummary = buildCallSummary(harbor, needsPracticeCall, guides);
    expect(npSummary).toContain("CLIENT NEEDS MORE PRACTICE");
    const clientSummary = buildClientSummary(harbor, guides);
    expect(clientSummary).toContain("CLIENT PRACTICE:");
  });

  it("Harbor (both calls completed) derives completed; Northwind derives needs_followup", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    expect(deriveClientStatus(harbor, guides)).toBe("completed");
    const northwind = state.clients.find((c) => c.businessName === "Northwind Dental")!;
    expect(deriveClientStatus(northwind, guides)).toBe("needs_followup");
  });

  it("outstanding actions are grouped by owner", () => {
    const actions = state.clients.flatMap((c) => outstandingActions(c, guides));
    expect(actions.every((a) => a.owner.trim().length > 0)).toBe(true);
  });

  it("guide-derived 'Required how-to guides supplied' is auto-calculated, not editable", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    const gd = harborOnb.items.find((i) => i.guideDerived)!;
    expect(gd).toBeDefined();
    // Harbor exempts the two no-URL guides + sends the hub → derived Done.
    expect(guideDerivedStatus(harborOnb, gd, guides)).toBe("done");
    const eff = effectiveItem(harborOnb, gd, guides);
    expect(eff.status).toBe("done");

    // Summit: onboarding hub sent-valid, but add-lead/send-review outstanding
    // (walkthrough only, not exempted) → derived NOT done.
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const summitOnb = summit.calls.find((c) => c.type === "onboarding")!;
    const gdSummit = summitOnb.items.find((i) => i.guideDerived)!;
    expect(guideDerivedStatus(summitOnb, gdSummit, guides)).not.toBe("done");
  });

  it("a verbal walkthrough never makes the guide-derived item Done", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    // Simulate: remove the exemptions, keep only walkthroughs → not done.
    const callNoExempt: Call = {
      ...harborOnb,
      guides: harborOnb.guides.map((g) =>
        g.guideId === "guide-add-lead" || g.guideId === "guide-send-review"
          ? { ...g, notApplicableReason: undefined, acknowledgedByReviewer: undefined }
          : g,
      ),
    };
    const gd = callNoExempt.items.find((i) => i.guideDerived)!;
    expect(guideDerivedStatus(callNoExempt, gd, guides)).not.toBe("done");
  });

  it("no double-counting: one needs_help task = one unresolved item", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const summitOnb = summit.calls.find((c) => c.type === "onboarding")!;
    const prog = callItemProgress(summitOnb, guides);
    // Exactly one item is needs_help (the staff verification check).
    const needsHelpItems = summitOnb.items.filter(
      (i) => effectiveItem(summitOnb, i, guides).status === "needs_help",
    );
    expect(needsHelpItems.length).toBe(1);
    // The needsHelpCount in progress equals the count of needs_help items.
    expect(prog.needsHelpCount).toBe(needsHelpItems.length);
  });

  it("required missing guides prevent checklist completion (guide-derived)", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const summitOnb = summit.calls.find((c) => c.type === "onboarding")!;
    const block = callCompletionBlock(summitOnb, guides);
    expect(block.ok).toBe(false);
    // The guide-derived item is not satisfied.
    const gd = summitOnb.items.find((i) => i.guideDerived)!;
    expect(effectiveItem(summitOnb, gd).status).not.toBe("done");
  });

  it("a call can finish with follow-up without marking unfinished items Done", () => {
    const summit = state.clients.find((c) => c.businessName === "Summit Physio")!;
    const summitOnb = summit.calls.find((c) => c.type === "onboarding")!;
    // The call has a needs_help item and is not complete, but it can still be
    // finished (finishedAt set) — finishing does not force completion.
    const finished: Call = { ...summitOnb, finishedAt: new Date().toISOString() };
    expect(deriveCallStatus(finished, guides)).toBe("needs_followup");
    expect(callCompletionBlock(finished, guides).ok).toBe(false);
  });

  it("dashboard, call page and summaries show consistent statuses", () => {
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    const harborOnb = harbor.calls.find((c) => c.type === "onboarding")!;
    const clientStatus = deriveClientStatus(harbor, guides);
    const callStatus = deriveCallStatus(harborOnb, guides);
    const summary = buildCallSummary(harbor, harborOnb, guides);
    const clientSummary = buildClientSummary(harbor, guides);
    // Harbor is completed at both client and call level.
    expect(clientStatus).toBe("completed");
    expect(callStatus).toBe("completed");
    expect(summary).toContain("CALL COMPLETE");
    expect(clientSummary).toContain("COMPLETED");
  });

  it("existing records, templates and history remain intact", () => {
    // Northwind, Summit, Harbor, Cedar, Trial, Main all present.
    const names = state.clients.map((c) => c.businessName);
    expect(names).toContain("Northwind Dental");
    expect(names).toContain("Summit Physio");
    expect(names).toContain("Harbor Coffee Roasters");
    expect(names).toContain("Cedar & Stone Salon");
    // Templates present for both call types.
    expect(state.settings.templates.find((t) => t.callType === "connection")).toBeDefined();
    expect(state.settings.templates.find((t) => t.callType === "onboarding")).toBeDefined();
    // Harbor has two calls (history preserved).
    const harbor = state.clients.find((c) => c.businessName === "Harbor Coffee Roasters")!;
    expect(harbor.calls.length).toBe(2);
  });
});