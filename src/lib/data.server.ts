// Server-only data access helpers for the LSP Onboarding Checklist.
// Maps Cloud DB rows <-> the app domain types. Runs inside server-function
// handlers only (never imported by client code).

import type { Database } from "@/integrations/supabase/types";
import type {
  Client,
  Call,
  CallItem,
  CallGuideRecord,
  GuideLink,
  TeamMember,
  ChecklistTemplate,
  TemplateItem,
  AuditEntry,
  ItemKind,
  ItemStatus,
  ReviewOutcome,
  GuideChannel,
  CallType,
} from "./types";

type SupabaseClient = ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>;

// ---- Row shapes (loosely typed; the generated Database types may lag) ----
interface ClientRow {
  id: string;
  business_name: string;
  client_name: string;
  assigned_team_member: string;
  contact_details: string | null;
  ghl_link: string | null;
  notes: string | null;
  next_call_type: CallType | null;
  next_call_date: string | null;
  is_test_record: boolean | null;
  test_purpose: string | null;
  account_context: string | null;
  created_at: string;
  updated_at: string;
}

interface CallRow {
  id: string;
  client_id: string;
  type: CallType;
  call_date: string;
  staff_member: string;
  notes: string | null;
  follow_up_action: string | null;
  follow_up_owner: string | null;
  follow_up_date: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CallItemRow {
  id: string;
  call_id: string;
  template_item_id: string | null;
  label: string;
  kind: ItemKind;
  required: boolean;
  status: ItemStatus;
  evidence: string | null;
  completed_by: string | null;
  completed_at: string | null;
  issue: string | null;
  next_action: string | null;
  not_applicable_reason: string | null;
  acknowledged_by_reviewer: boolean | null;
  review_outcome: ReviewOutcome | null;
  review_send: boolean | null;
  guide_derived: boolean | null;
  help_text: string | null;
  demo_practice: boolean | null;
  staff_demonstrated: boolean | null;
  staff_demonstrated_by: string | null;
  staff_demonstrated_at: string | null;
  sort_order: number;
}

interface CallGuideRow {
  id: string;
  call_id: string;
  guide_id: string;
  sent: boolean;
  sent_at: string | null;
  channel: GuideChannel | null;
  sent_by: string | null;
  supplied_url_or_version: string | null;
  walkthrough_provided: boolean | null;
  walkthrough_at: string | null;
  walkthrough_by: string | null;
  walkthrough_notes: string | null;
  not_applicable_reason: string | null;
  acknowledged_by_reviewer: boolean | null;
}

interface AuditRow {
  id: string;
  call_id: string | null;
  call_item_id: string | null;
  call_guide_id: string | null;
  field: string;
  from_value: string | null;
  to_value: string | null;
  reason: string | null;
  actor: string | null;
  created_at: string;
}

interface GuideLinkRow {
  id: string;
  label: string;
  url: string | null;
  document_title: string | null;
  document_version: string | null;
  sort_order: number;
}

interface TeamRow {
  id: string;
  name: string;
  sort_order: number;
}

interface TemplateRow {
  id: string;
  call_type: CallType;
  name: string;
  description: string | null;
}

interface TemplateItemRow {
  id: string;
  template_id: string;
  label: string;
  kind: ItemKind;
  required: boolean;
  archived: boolean | null;
  help_text: string | null;
  review_send: boolean | null;
  guide_derived: boolean | null;
  demo_practice: boolean | null;
  sort_order: number;
}

// ---- Mappers ----

export function mapCallItem(row: CallItemRow, audits: AuditEntry[]): CallItem {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    required: row.required,
    status: row.status,
    evidence: row.evidence ?? undefined,
    completedBy: row.completed_by ?? undefined,
    completedAt: row.completed_at ?? undefined,
    issue: row.issue ?? undefined,
    nextAction: row.next_action ?? undefined,
    notApplicableReason: row.not_applicable_reason ?? undefined,
    acknowledgedByReviewer: row.acknowledged_by_reviewer ?? undefined,
    reviewOutcome: row.review_outcome ?? undefined,
    reviewSend: row.review_send ?? undefined,
    guideDerived: row.guide_derived ?? undefined,
    helpText: row.help_text ?? undefined,
    demoPractice: row.demo_practice ?? undefined,
    staffDemonstrated: row.staff_demonstrated ?? undefined,
    staffDemonstratedBy: row.staff_demonstrated_by ?? undefined,
    staffDemonstratedAt: row.staff_demonstrated_at ?? undefined,
    audit: audits,
  };
}

export function mapCallGuide(row: CallGuideRow, audits: AuditEntry[]): CallGuideRecord {
  return {
    guideId: row.guide_id,
    sent: row.sent,
    sentAt: row.sent_at ?? undefined,
    channel: row.channel ?? undefined,
    sentBy: row.sent_by ?? undefined,
    suppliedUrlOrVersion: row.supplied_url_or_version ?? undefined,
    walkthroughProvided: row.walkthrough_provided ?? undefined,
    walkthroughAt: row.walkthrough_at ?? undefined,
    walkthroughBy: row.walkthrough_by ?? undefined,
    walkthroughNotes: row.walkthrough_notes ?? undefined,
    notApplicableReason: row.not_applicable_reason ?? undefined,
    acknowledgedByReviewer: row.acknowledged_by_reviewer ?? undefined,
    audit: audits,
  };
}

export function mapCall(row: CallRow, items: CallItem[], guides: CallGuideRecord[]): Call {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    date: row.call_date,
    staffMember: row.staff_member,
    notes: row.notes ?? undefined,
    followUpAction: row.follow_up_action ?? undefined,
    followUpOwner: row.follow_up_owner ?? undefined,
    followUpDate: row.follow_up_date ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    items,
    guides,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapClient(row: ClientRow, calls: Call[]): Client {
  return {
    id: row.id,
    businessName: row.business_name,
    clientName: row.client_name,
    assignedTeamMember: row.assigned_team_member,
    contactDetails: row.contact_details ?? undefined,
    ghlLink: row.ghl_link ?? undefined,
    notes: row.notes ?? undefined,
    nextCallType: row.next_call_type ?? undefined,
    nextCallDate: row.next_call_date ?? undefined,
    calls,
    isTestRecord: row.is_test_record ?? undefined,
    testPurpose: row.test_purpose ?? undefined,
    accountContext: row.account_context ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGuideLink(row: GuideLinkRow): GuideLink {
  return {
    id: row.id,
    label: row.label,
    url: row.url ?? undefined,
    documentTitle: row.document_title ?? undefined,
    documentVersion: row.document_version ?? undefined,
  };
}

export function mapTeamMember(row: TeamRow): TeamMember {
  return { id: row.id, name: row.name };
}

export function mapTemplateItem(row: TemplateItemRow): TemplateItem {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    required: row.required,
    archived: row.archived ?? undefined,
    helpText: row.help_text ?? undefined,
    reviewSend: row.review_send ?? undefined,
    guideDerived: row.guide_derived ?? undefined,
    demoPractice: row.demo_practice ?? undefined,
  };
}

export function mapTemplate(row: TemplateRow, items: TemplateItem[]): ChecklistTemplate {
  return {
    id: row.id,
    callType: row.call_type,
    name: row.name,
    description: row.description ?? undefined,
    items,
  };
}

// ---- Loaders ----

export async function loadSettings(supabase: SupabaseClient) {
  const [guidesRes, teamRes, tplRes, tiRes] = await Promise.all([
    supabase.from("guide_links").select("*").order("sort_order"),
    supabase.from("team_members").select("*").order("sort_order"),
    supabase.from("templates").select("*").order("id"),
    supabase.from("template_items").select("*").order("sort_order"),
  ]);

  const guides = (guidesRes.data ?? []).map(mapGuideLink);
  const team = (teamRes.data ?? []).map(mapTeamMember);
  const templates = (tplRes.data ?? []).map((t: TemplateRow) =>
    mapTemplate(
      t,
      (tiRes.data ?? [])
        .filter((i: TemplateItemRow) => i.template_id === t.id)
        .map(mapTemplateItem),
    ),
  );

  return { guides, team, templates };
}

export async function loadClients(supabase: SupabaseClient): Promise<Client[]> {
  const clientsRes = await supabase.from("clients").select("*").order("created_at");
  if (clientsRes.error) throw clientsRes.error;
  const clientRows = (clientsRes.data ?? []) as unknown as ClientRow[];

  if (clientRows.length === 0) return [];

  const callsRes = await supabase
    .from("calls")
    .select("*")
    .in(
      "client_id",
      clientRows.map((c) => c.id),
    )
    .order("created_at");
  if (callsRes.error) throw callsRes.error;
  const callRows = (callsRes.data ?? []) as unknown as CallRow[];

  if (callRows.length === 0) {
    return clientRows.map((r) => mapClient(r, []));
  }

  const callIds = callRows.map((c) => c.id);

  const [itemsRes, guidesRes, auditRes] = await Promise.all([
    supabase.from("call_items").select("*").in("call_id", callIds).order("sort_order"),
    supabase.from("call_guides").select("*").in("call_id", callIds),
    supabase.from("audit_entries").select("*").in("call_id", callIds),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (guidesRes.error) throw guidesRes.error;
  // audit_entries may be empty — tolerate error-free empty.

  const itemRows = (itemsRes.data ?? []) as unknown as CallItemRow[];
  const guideRows = (guidesRes.data ?? []) as unknown as CallGuideRow[];
  const auditRows = (auditRes.data ?? []) as unknown as AuditRow[];

  const auditsByItem = new Map<string, AuditEntry[]>();
  const auditsByGuide = new Map<string, AuditEntry[]>();
  for (const a of auditRows) {
    const entry: AuditEntry = {
      id: a.id,
      at: a.created_at,
      actor: a.actor ?? "",
      field: a.field,
      from: a.from_value ?? "",
      to: a.to_value ?? "",
      reason: a.reason ?? "",
    };
    if (a.call_item_id) {
      const arr = auditsByItem.get(a.call_item_id) ?? [];
      arr.push(entry);
      auditsByItem.set(a.call_item_id, arr);
    }
    if (a.call_guide_id) {
      const arr = auditsByGuide.get(a.call_guide_id) ?? [];
      arr.push(entry);
      auditsByGuide.set(a.call_guide_id, arr);
    }
  }

  const itemsByCall = new Map<string, CallItem[]>();
  for (const ir of itemRows) {
    const arr = itemsByCall.get(ir.call_id) ?? [];
    arr.push(mapCallItem(ir, auditsByItem.get(ir.id) ?? []));
    itemsByCall.set(ir.call_id, arr);
  }

  const guidesByCall = new Map<string, CallGuideRecord[]>();
  for (const gr of guideRows) {
    const arr = guidesByCall.get(gr.call_id) ?? [];
    arr.push(mapCallGuide(gr, auditsByGuide.get(gr.id) ?? []));
    guidesByCall.set(gr.call_id, arr);
  }

  const callsByClient = new Map<string, Call[]>();
  for (const cr of callRows) {
    const arr = callsByClient.get(cr.client_id) ?? [];
    arr.push(mapCall(cr, itemsByCall.get(cr.id) ?? [], guidesByCall.get(cr.id) ?? []));
    callsByClient.set(cr.client_id, arr);
  }

  return clientRows.map((r) => mapClient(r, callsByClient.get(r.id) ?? []));
}

export interface LoadedState {
  clients: Client[];
  guides: GuideLink[];
  team: TeamMember[];
  templates: ChecklistTemplate[];
}

export async function loadState(supabase: SupabaseClient): Promise<LoadedState> {
  const [settings, clients] = await Promise.all([loadSettings(supabase), loadClients(supabase)]);
  return { clients, ...settings };
}
