import type {
  AppState,
  Client,
  Call,
  CallItem,
  CallGuideRecord,
  Settings,
  GuideLink,
  TeamMember,
  ChecklistTemplate,
  TemplateItem,
  AuditEntry,
  CallType,
  ItemKind,
  ItemStatus,
} from "./types";
import { DEFAULT_GUIDE_IDS, DEFAULT_CONNECTION_ITEMS, DEFAULT_ONBOARDING_ITEMS } from "./types";

let _id = 1000;
function uid(prefix: string): string {
  _id += 1;
  return `${prefix}-${_id}`;
}

function nowISO(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function dateISO(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function audit(
  at: string,
  actor: string,
  field: string,
  from: string,
  to: string,
  reason: string,
): AuditEntry {
  return { id: uid("aud"), at, actor, field, from, to, reason };
}

// ---- Default settings ----

export function defaultSettings(): Settings {
  const guides: GuideLink[] = [
    {
      id: DEFAULT_GUIDE_IDS.addLead,
      label: "Add a lead manually in the phone app",
      url: undefined,
    },
    {
      id: DEFAULT_GUIDE_IDS.sendReview,
      label: "Send a Google review request in the phone app",
      url: undefined,
    },
    {
      id: DEFAULT_GUIDE_IDS.onboardingHub,
      label: "Existing LSP Client Onboarding hub",
      url: "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ",
    },
  ];
  const team: TeamMember[] = [
    { id: "tm-1", name: "Avery Chen" },
    { id: "tm-2", name: "Jordan Patel" },
    { id: "tm-3", name: "Sam Rivera" },
    { id: "tm-4", name: "Ryan (Lead)" },
    { id: "tm-5", name: "Nathaniel" },
    { id: "tm-6", name: "Jay" },
  ];

  const connItems: TemplateItem[] = DEFAULT_CONNECTION_ITEMS.map((it) => ({
    ...it,
    id: uid("ti"),
  }));
  const onbItems: TemplateItem[] = DEFAULT_ONBOARDING_ITEMS.map((it) => ({ ...it, id: uid("ti") }));

  const templates: ChecklistTemplate[] = [
    {
      id: "tpl-connection",
      callType: "connection",
      name: "Integration & Connection call",
      description:
        "Verify access and required integrations. Records verification only — does not perform integrations.",
      items: connItems,
    },
    {
      id: "tpl-onboarding",
      callType: "onboarding",
      name: "Onboarding & Training call",
      description:
        "Client-led practical tasks plus staff result verification. Staff demo does not count as client completion.",
      items: onbItems,
    },
  ];

  return { guides, team, templates };
}

// ---- Helpers to build calls from templates ----

export function buildCallItems(template: ChecklistTemplate): CallItem[] {
  return template.items
    .filter((i) => !i.archived)
    .map((ti) => ({
      id: uid("ci"),
      label: ti.label,
      kind: ti.kind,
      required: ti.required,
      status: "not_checked" as ItemStatus,
      reviewSend: ti.reviewSend,
      helpText: ti.helpText,
      audit: [],
    }));
}

export function buildCallGuides(guides: GuideLink[]): CallGuideRecord[] {
  return guides.map((g) => ({ guideId: g.id, sent: false, audit: [] }));
}

// ---- Seed clients (history preserved; test records never pre-completed) ----

function makeClient(
  n: number,
  data: Partial<Client> & Pick<Client, "businessName" | "clientName" | "assignedTeamMember">,
): Client {
  return {
    id: `client-${n}`,
    calls: [],
    createdAt: nowISO(10),
    updatedAt: nowISO(0),
    ...data,
  } as Client;
}

export function seedState(): AppState {
  const settings = defaultSettings();
  const guides = settings.guides;
  const connTpl = settings.templates.find((t) => t.callType === "connection")!;
  const onbTpl = settings.templates.find((t) => t.callType === "onboarding")!;

  // --- Northwind Dental: connection call in progress (IG needs help) ---
  const ndCall: Call = {
    id: uid("call"),
    clientId: "client-1",
    type: "connection",
    date: dateISO(3),
    staffMember: "Avery Chen",
    notes: "Initial connection call. Google & GBP linked. Facebook/Instagram pending admin access.",
    createdAt: nowISO(3),
    updatedAt: nowISO(3),
    items: buildCallItems(connTpl).map((it) => {
      if (it.label.startsWith("Client can access"))
        return {
          ...it,
          status: "done",
          evidence: "Subaccount access confirmed.",
          completedBy: "Avery Chen",
          completedAt: nowISO(3),
        };
      if (it.label.startsWith("Google account"))
        return {
          ...it,
          status: "done",
          evidence: "OAuth connected.",
          completedBy: "Avery Chen",
          completedAt: nowISO(3),
        };
      if (it.label.startsWith("Correct Google Business Profile"))
        return {
          ...it,
          status: "done",
          evidence: "GBP linked to primary store.",
          completedBy: "Avery Chen",
          completedAt: nowISO(3),
        };
      if (it.label.startsWith("Google review destination"))
        return {
          ...it,
          status: "done",
          evidence: "Review destination confirmed.",
          completedBy: "Avery Chen",
          completedAt: nowISO(3),
        };
      if (it.label.startsWith("Instagram"))
        return {
          ...it,
          status: "needs_help",
          issue: "Instagram credentials needed — client to provide admin access",
          nextAction: "Send Meta Business Manager guide & request IG admin invite",
          completedBy: "Avery Chen",
          completedAt: nowISO(3),
        };
      return it;
    }),
    guides: buildCallGuides(guides),
  };
  const northwind = makeClient(1, {
    businessName: "Northwind Dental",
    clientName: "Dr. Lena Okafor",
    assignedTeamMember: "Avery Chen",
    ghlLink: "https://app.example.com/locations/loc_northwind_8842",
    notes:
      "Client observed demo on Zoom; needs to complete practical steps themselves during next call.",
    nextCallType: "onboarding",
    nextCallDate: dateISO(-3),
    calls: [ndCall],
  });

  // --- Summit Physio: onboarding call, review Sent but receipt NOT confirmed ---
  const spCall: Call = {
    id: uid("call"),
    clientId: "client-2",
    type: "onboarding",
    date: dateISO(5),
    staffMember: "Jordan Patel",
    notes:
      "Full onboarding call. Client executed all practical tasks. SMS sent; waiting on delivery confirmation.",
    createdAt: nowISO(5),
    updatedAt: nowISO(5),
    items: buildCallItems(onbTpl).map((it) => {
      const l = it.label.toLowerCase();
      if (l.startsWith("client personally logs"))
        return {
          ...it,
          status: "done",
          evidence: "Client signed into phone app.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client selects the correct business"))
        return {
          ...it,
          status: "done",
          evidence: "Summit Physio subaccount selected.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client searches existing"))
        return {
          ...it,
          status: "done",
          evidence: "Client searched 'Marcus' and identified existing duplicates.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client manually adds"))
        return {
          ...it,
          status: "done",
          evidence: "Client added test contact 'Sarah Miller - Test'.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client finds the saved"))
        return {
          ...it,
          status: "done",
          evidence: "Client opened saved contact from list.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client opens the review-request"))
        return {
          ...it,
          status: "done",
          evidence: "Client tapped 'Send Review Request'.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client selects the agreed recipient"))
        return {
          ...it,
          status: "done",
          evidence: "Client verified SMS copy and review link in preview.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client personally sends"))
        return {
          ...it,
          status: "done",
          evidence: "Client tapped Send; SMS sent to agreed test number.",
          reviewOutcome: "sent",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("staff checks the recorded"))
        return {
          ...it,
          status: "needs_help",
          issue: "Message shows Sent but recipient has not confirmed receipt yet",
          nextAction: "Call recipient to confirm SMS arrived; verify review link opens GBP",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
          reviewOutcome: "sent",
        };
      if (l.startsWith("required how-to guides"))
        return {
          ...it,
          status: "done",
          evidence: "Onboarding hub guide emailed.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      if (l.startsWith("client questions answered"))
        return {
          ...it,
          status: "done",
          evidence: "Next steps agreed.",
          completedBy: "Jordan Patel",
          completedAt: nowISO(5),
        };
      return it;
    }),
    guides: buildCallGuides(guides).map((g) =>
      g.guideId === DEFAULT_GUIDE_IDS.onboardingHub
        ? {
            ...g,
            sent: true,
            sentAt: nowISO(5),
            channel: "email",
            sentBy: "Jordan Patel",
            suppliedUrlOrVersion:
              "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ",
            notes: "Provided on onboarding call.",
          }
        : g,
    ),
  };
  const summit = makeClient(2, {
    businessName: "Summit Physio",
    clientName: "Marcus Bell",
    assignedTeamMember: "Jordan Patel",
    ghlLink: "https://app.example.com/locations/loc_summit_2210",
    notes: "Review SMS Sent by client, but receipt not confirmed yet.",
    nextCallType: "onboarding",
    nextCallDate: dateISO(-1),
    calls: [spCall],
  });

  // --- Harbor Coffee Roasters: fully completed (connection + onboarding) ---
  const harborConn: Call = {
    id: uid("call"),
    clientId: "client-3",
    type: "connection",
    date: dateISO(12),
    staffMember: "Sam Rivera",
    notes: "Connection call complete. All required integrations verified.",
    createdAt: nowISO(12),
    updatedAt: nowISO(10),
    items: buildCallItems(connTpl).map((it) => {
      const l = it.label.toLowerCase();
      if (l.startsWith("instagram"))
        return {
          ...it,
          status: "not_applicable",
          notApplicableReason: "Client does not have an Instagram business account.",
          acknowledgedByReviewer: true,
          completedBy: "Sam Rivera",
          completedAt: nowISO(12),
        };
      if (l.startsWith("calendar") || l.startsWith("other agreed"))
        return {
          ...it,
          status: "not_applicable",
          notApplicableReason: "No additional integrations agreed.",
          acknowledgedByReviewer: true,
          completedBy: "Sam Rivera",
          completedAt: nowISO(12),
        };
      return {
        ...it,
        status: "done",
        evidence: "Verified.",
        completedBy: "Sam Rivera",
        completedAt: nowISO(12),
      };
    }),
    guides: buildCallGuides(guides).map((g) =>
      g.guideId === DEFAULT_GUIDE_IDS.onboardingHub
        ? {
            ...g,
            sent: true,
            sentAt: nowISO(12),
            channel: "email",
            sentBy: "Sam Rivera",
            suppliedUrlOrVersion:
              "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ",
            notes: "Sent guide pack.",
          }
        : g,
    ),
    finishedAt: nowISO(12),
  };
  const harborOnb: Call = {
    id: uid("call"),
    clientId: "client-3",
    type: "onboarding",
    date: dateISO(10),
    staffMember: "Sam Rivera",
    notes: "Complete onboarding call. All practical tasks verified. Receipt confirmed.",
    createdAt: nowISO(10),
    updatedAt: nowISO(10),
    items: buildCallItems(onbTpl).map((it) => {
      const l = it.label.toLowerCase();
      if (l.startsWith("client personally logs"))
        return {
          ...it,
          status: "done",
          evidence: "Client logged into phone app.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client selects the correct business"))
        return {
          ...it,
          status: "done",
          evidence: "Harbor Coffee Roasters location selected.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client searches existing"))
        return {
          ...it,
          status: "done",
          evidence: "Client searched 'Liam' to avoid duplicates.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client manually adds"))
        return {
          ...it,
          status: "done",
          evidence: "Client entered test contact and saved.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client finds the saved"))
        return {
          ...it,
          status: "done",
          evidence: "Client opened newly created contact.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client opens the review-request"))
        return {
          ...it,
          status: "done",
          evidence: "Client initiated review request flow.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client selects the agreed recipient"))
        return {
          ...it,
          status: "done",
          evidence: "Client inspected review text and recipient number.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client personally sends"))
        return {
          ...it,
          status: "done",
          evidence: "Client tapped send; reflected in conversation.",
          reviewOutcome: "sent",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("staff checks the recorded"))
        return {
          ...it,
          status: "done",
          evidence: "Delivered; recipient clicked review link and verified GBP destination.",
          reviewOutcome: "receipt_confirmed",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("required how-to guides"))
        return {
          ...it,
          status: "done",
          evidence: "Onboarding hub guide emailed.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      if (l.startsWith("client questions answered"))
        return {
          ...it,
          status: "done",
          evidence: "Next steps agreed.",
          completedBy: "Sam Rivera",
          completedAt: nowISO(10),
        };
      return it;
    }),
    guides: buildCallGuides(guides).map((g) => {
      if (g.guideId === DEFAULT_GUIDE_IDS.onboardingHub)
        return {
          ...g,
          sent: true,
          sentAt: nowISO(10),
          channel: "email",
          sentBy: "Sam Rivera",
          suppliedUrlOrVersion:
            "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ",
          notes: "Sent guide pack.",
        };
      // CORRECTION: add-lead / send-review previously marked "Sent" with
      // "Guide link not added (verbal walkthrough)". That was incorrect — a
      // verbal walkthrough is NOT a sent guide. Recorded as walkthroughs only;
      // they remain outstanding required guides until real URLs are supplied.
      if (g.guideId === DEFAULT_GUIDE_IDS.addLead)
        return {
          ...g,
          sent: false,
          walkthroughProvided: true,
          walkthroughAt: nowISO(10),
          walkthroughBy: "Sam Rivera",
          walkthroughNotes: "Walked through adding a lead verbally on the call (not a sent guide).",
          audit: [
            audit(
              nowISO(0),
              "System",
              "Guide sent",
              "Sent",
              "Not sent",
              "Corrected: verbal walkthrough must not count as a sent guide",
            ),
            audit(
              nowISO(0),
              "System",
              "Verbal walkthrough",
              "",
              "Provided",
              "Migrated from invalid sent-guide record",
            ),
          ],
        };
      if (g.guideId === DEFAULT_GUIDE_IDS.sendReview)
        return {
          ...g,
          sent: false,
          walkthroughProvided: true,
          walkthroughAt: nowISO(10),
          walkthroughBy: "Sam Rivera",
          walkthroughNotes:
            "Walked through sending a review request verbally on the call (not a sent guide).",
          audit: [
            audit(
              nowISO(0),
              "System",
              "Guide sent",
              "Sent",
              "Not sent",
              "Corrected: verbal walkthrough must not count as a sent guide",
            ),
            audit(
              nowISO(0),
              "System",
              "Verbal walkthrough",
              "",
              "Provided",
              "Migrated from invalid sent-guide record",
            ),
          ],
        };
      return g;
    }),
    finishedAt: nowISO(10),
  };
  const harbor = makeClient(3, {
    businessName: "Harbor Coffee Roasters",
    clientName: "Priya Nair",
    assignedTeamMember: "Sam Rivera",
    ghlLink: "https://app.example.com/locations/loc_harbor_5512",
    notes:
      "Client successfully demonstrated all skills. Review request confirmed delivered and opened.",
    nextCallType: "onboarding",
    nextCallDate: dateISO(-30),
    calls: [harborConn, harborOnb],
  });

  // --- Cedar & Stone Salon: not started, no calls ---
  const cedar = makeClient(4, {
    businessName: "Cedar & Stone Salon",
    clientName: "Tom Whitfield",
    assignedTeamMember: "Avery Chen",
    notes: "Call scheduled for tomorrow 10am.",
    nextCallType: "connection",
    nextCallDate: dateISO(-1),
    calls: [],
  });

  // --- Internal test records (RECORD A & B): never pre-completed ---
  const trial = makeClient(5, {
    businessName: "LSP Trial — Onboarding Test",
    clientName: "Nathaniel",
    assignedTeamMember: "Jay",
    notes:
      "Internal test record. Nathaniel performs the client-side tasks while Jay observes and records evidence.",
    isTestRecord: true,
    testPurpose:
      "Nathaniel performs the client-side tasks while Jay observes and records evidence.",
    accountContext: "LSP Trial subaccount",
    nextCallType: "onboarding",
    calls: [],
  });

  const main = makeClient(6, {
    businessName: "LSP Main — Onboarding Test",
    clientName: "Jay",
    assignedTeamMember: "Nathaniel",
    notes:
      "Internal test record. Jay performs the client-side tasks while Nathaniel observes and records evidence.",
    isTestRecord: true,
    testPurpose:
      "Jay performs the client-side tasks while Nathaniel observes and records evidence.",
    accountContext: "LSP Main subaccount",
    nextCallType: "onboarding",
    calls: [],
  });

  return { clients: [northwind, summit, harbor, cedar, trial, main], settings };
}
