import type {
  AppState,
  Client,
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
      // URL not supplied yet — leave unconfigured until the real link is provided.
      url: undefined,
    },
    {
      id: DEFAULT_GUIDE_IDS.sendReview,
      label: "Send a Google review request in the phone app",
      // URL not supplied yet — leave unconfigured until the real link is provided.
      url: undefined,
    },
    {
      id: DEFAULT_GUIDE_IDS.onboardingHub,
      label: "Existing LSP Client Onboarding hub",
      url: "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ",
    },
  ];
  // Genuine staff only. Fictional sample staff (Avery, Jordan, Sam, Ryan) were
  // removed along with their synthetic sample records.
  const team: TeamMember[] = [
    { id: "tm-1", name: "Nathaniel" },
    { id: "tm-2", name: "Jay" },
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
      guideDerived: ti.guideDerived,
      demoPractice: ti.demoPractice,
      helpText: ti.helpText,
      audit: [],
    }));
}

export function buildCallGuides(guides: GuideLink[]): CallGuideRecord[] {
  return guides.map((g) => ({ guideId: g.id, sent: false, audit: [] }));
}

// ---- Seed clients ----
// Only the genuine internal test record remains. Synthetic sample clients
// (Northwind, Summit, Harbor, Cedar, LSP Main) and their sample calls, notes,
// follow-ups and guide-delivery records were removed. Manually added clients
// are never touched by seedState (it only ever returns this fixed set).

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

  // --- Internal test record (RECORD A): never pre-completed ---
  // Nathaniel performs the client-side tasks while Jay observes and records
  // evidence. No invented completion evidence, contacts, account IDs or URLs.
  const trial = makeClient(1, {
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

  return { clients: [trial], settings };
}

// Re-export for tests / external use.
export { audit, dateISO, nowISO, uid };
export type { CallType, ItemKind };