// Server-only mutation helpers for the LSP Onboarding Checklist.
// All writes go through the authenticated Cloud client (RLS-enforced).

import type { Database } from "@/integrations/supabase/types";
import type {
  CallItem,
  CallGuideRecord,
  GuideLink,
  TeamMember,
  TemplateItem,
  ItemKind,
  ItemStatus,
  ReviewOutcome,
  GuideChannel,
  CallType,
} from "./types";

type SupabaseClient = ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>;

const now = () => new Date().toISOString();

export interface NewClientInput {
  businessName: string;
  clientName: string;
  assignedTeamMember: string;
  callType: CallType;
  callDate?: string | undefined;
  contactDetails?: string | undefined;
  ghlLink?: string | undefined;
  notes?: string | undefined;
  isTestRecord?: boolean | undefined;
  testPurpose?: string | undefined;
  accountContext?: string | undefined;
}

export interface ClientUpdate {
  businessName?: string | undefined;
  clientName?: string | undefined;
  assignedTeamMember?: string | undefined;
  contactDetails?: string | undefined;
  ghlLink?: string | undefined;
  notes?: string | undefined;
  nextCallType?: CallType | undefined;
  nextCallDate?: string | undefined;
}

export interface CallUpdate {
  staffMember?: string | undefined;
  notes?: string | undefined;
  followUpAction?: string | undefined;
  followUpOwner?: string | undefined;
  followUpDate?: string | undefined;
  finishedAt?: string | null | undefined;
}

export interface CallItemUpdate {
  status?: ItemStatus | undefined;
  evidence?: string | undefined;
  completedBy?: string | undefined;
  completedAt?: string | undefined;
  issue?: string | undefined;
  nextAction?: string | undefined;
  notApplicableReason?: string | undefined;
  acknowledgedByReviewer?: boolean | undefined;
  reviewOutcome?: ReviewOutcome | undefined;
  staffDemonstrated?: boolean | undefined;
  staffDemonstratedBy?: string | undefined;
  staffDemonstratedAt?: string | undefined;
}

export interface CallGuideUpdate {
  sent?: boolean | undefined;
  sentAt?: string | undefined;
  channel?: GuideChannel | undefined;
  sentBy?: string | undefined;
  suppliedUrlOrVersion?: string | undefined;
  walkthroughProvided?: boolean | undefined;
  walkthroughAt?: string | undefined;
  walkthroughBy?: string | undefined;
  walkthroughNotes?: string | undefined;
  notApplicableReason?: string | undefined;
  acknowledgedByReviewer?: boolean | undefined;
}

// ---- Clients ----

export async function insertClient(
  supabase: SupabaseClient,
  input: NewClientInput,
  actorUserId: string,
): Promise<string> {
  const insert: Database["public"]["Tables"]["clients"]["Insert"] = {
    business_name: input.businessName,
    client_name: input.clientName,
    assigned_team_member: input.assignedTeamMember,
    contact_details: input.contactDetails ?? null,
    ghl_link: input.ghlLink ?? null,
    notes: input.notes ?? null,
    next_call_type: input.callType,
    next_call_date: input.callDate ?? null,
    is_test_record: input.isTestRecord ?? false,
    test_purpose: input.testPurpose ?? null,
    account_context: input.accountContext ?? null,
    created_by: actorUserId,
  };
  const { data, error } = await supabase.from("clients").insert(insert).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateClientRow(
  supabase: SupabaseClient,
  id: string,
  patch: ClientUpdate,
): Promise<void> {
  const u: Database["public"]["Tables"]["clients"]["Update"] = {
    updated_at: now(),
  };
  if (patch.businessName !== undefined) u.business_name = patch.businessName;
  if (patch.clientName !== undefined) u.client_name = patch.clientName;
  if (patch.assignedTeamMember !== undefined) u.assigned_team_member = patch.assignedTeamMember;
  if (patch.contactDetails !== undefined) u.contact_details = patch.contactDetails || null;
  if (patch.ghlLink !== undefined) u.ghl_link = patch.ghlLink || null;
  if (patch.notes !== undefined) u.notes = patch.notes || null;
  if (patch.nextCallType !== undefined) u.next_call_type = patch.nextCallType;
  if (patch.nextCallDate !== undefined) u.next_call_date = patch.nextCallDate || null;

  const { error } = await supabase.from("clients").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteClientRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ---- Calls ----

export async function insertCall(
  supabase: SupabaseClient,
  clientId: string,
  type: CallType,
  staffMember: string,
  date: string,
  actorUserId: string,
): Promise<string> {
  const insert: Database["public"]["Tables"]["calls"]["Insert"] = {
    client_id: clientId,
    type,
    call_date: date,
    staff_member: staffMember,
    created_by: actorUserId,
  };
  const { data, error } = await supabase.from("calls").insert(insert).select("id").single();
  if (error) throw error;
  const callId = (data as { id: string }).id;
  // Seed per-call item + guide snapshots from the template.
  await seedCallChecklist(supabase, callId, type);
  return callId;
}

export async function updateCallRow(
  supabase: SupabaseClient,
  callId: string,
  patch: CallUpdate,
): Promise<void> {
  const u: Database["public"]["Tables"]["calls"]["Update"] = {
    updated_at: now(),
  };
  if (patch.staffMember !== undefined) u.staff_member = patch.staffMember;
  if (patch.notes !== undefined) u.notes = patch.notes || null;
  if (patch.followUpAction !== undefined) u.follow_up_action = patch.followUpAction || null;
  if (patch.followUpOwner !== undefined) u.follow_up_owner = patch.followUpOwner || null;
  if (patch.followUpDate !== undefined) u.follow_up_date = patch.followUpDate || null;
  if (patch.finishedAt !== undefined) u.finished_at = patch.finishedAt ?? null;

  const { error } = await supabase.from("calls").update(u).eq("id", callId);
  if (error) throw error;
}

// ---- Call items ----

export async function upsertCallItems(
  supabase: SupabaseClient,
  callId: string,
  items: CallItem[],
): Promise<void> {
  void callId;
  for (const it of items) {
    const u: Database["public"]["Tables"]["call_items"]["Update"] = {
      status: it.status,
      evidence: it.evidence ?? null,
      completed_by: it.completedBy ?? null,
      completed_at: it.completedAt ?? null,
      issue: it.issue ?? null,
      next_action: it.nextAction ?? null,
      not_applicable_reason: it.notApplicableReason ?? null,
      acknowledged_by_reviewer: it.acknowledgedByReviewer ?? null,
      review_outcome: it.reviewOutcome ?? null,
      staff_demonstrated: it.staffDemonstrated ?? false,
      staff_demonstrated_by: it.staffDemonstratedBy ?? null,
      staff_demonstrated_at: it.staffDemonstratedAt ?? null,
      updated_at: now(),
    };
    const { error } = await supabase.from("call_items").update(u).eq("id", it.id);
    if (error) throw error;
  }
}

export async function updateCallItemRow(
  supabase: SupabaseClient,
  itemId: string,
  patch: CallItemUpdate,
): Promise<void> {
  const u: Database["public"]["Tables"]["call_items"]["Update"] = {
    updated_at: now(),
  };
  if (patch.status !== undefined) u.status = patch.status;
  if (patch.evidence !== undefined) u.evidence = patch.evidence || null;
  if (patch.completedBy !== undefined) u.completed_by = patch.completedBy || null;
  if (patch.completedAt !== undefined) u.completed_at = patch.completedAt || null;
  if (patch.issue !== undefined) u.issue = patch.issue || null;
  if (patch.nextAction !== undefined) u.next_action = patch.nextAction || null;
  if (patch.notApplicableReason !== undefined)
    u.not_applicable_reason = patch.notApplicableReason || null;
  if (patch.acknowledgedByReviewer !== undefined)
    u.acknowledged_by_reviewer = patch.acknowledgedByReviewer;
  if (patch.reviewOutcome !== undefined) u.review_outcome = patch.reviewOutcome;
  if (patch.staffDemonstrated !== undefined) u.staff_demonstrated = patch.staffDemonstrated;
  if (patch.staffDemonstratedBy !== undefined)
    u.staff_demonstrated_by = patch.staffDemonstratedBy || null;
  if (patch.staffDemonstratedAt !== undefined)
    u.staff_demonstrated_at = patch.staffDemonstratedAt || null;

  const { error } = await supabase.from("call_items").update(u).eq("id", itemId);
  if (error) throw error;
}

// ---- Call guides ----

export async function updateCallGuideRow(
  supabase: SupabaseClient,
  callId: string,
  guideId: string,
  patch: CallGuideUpdate,
): Promise<void> {
  const u: Database["public"]["Tables"]["call_guides"]["Update"] = {
    updated_at: now(),
  };
  if (patch.sent !== undefined) u.sent = patch.sent;
  if (patch.sentAt !== undefined) u.sent_at = patch.sentAt || null;
  if (patch.channel !== undefined) u.channel = patch.channel;
  if (patch.sentBy !== undefined) u.sent_by = patch.sentBy || null;
  if (patch.suppliedUrlOrVersion !== undefined)
    u.supplied_url_or_version = patch.suppliedUrlOrVersion || null;
  if (patch.walkthroughProvided !== undefined) u.walkthrough_provided = patch.walkthroughProvided;
  if (patch.walkthroughAt !== undefined) u.walkthrough_at = patch.walkthroughAt || null;
  if (patch.walkthroughBy !== undefined) u.walkthrough_by = patch.walkthroughBy || null;
  if (patch.walkthroughNotes !== undefined) u.walkthrough_notes = patch.walkthroughNotes || null;
  if (patch.notApplicableReason !== undefined)
    u.not_applicable_reason = patch.notApplicableReason || null;
  if (patch.acknowledgedByReviewer !== undefined)
    u.acknowledged_by_reviewer = patch.acknowledgedByReviewer;

  const { error } = await supabase
    .from("call_guides")
    .update(u)
    .eq("call_id", callId)
    .eq("guide_id", guideId);
  if (error) throw error;
}

// ---- Audit ----

export async function insertAudit(
  supabase: SupabaseClient,
  entry: {
    callId?: string | undefined;
    callItemId?: string | undefined;
    callGuideId?: string | undefined;
    field: string;
    from: string;
    to: string;
    reason: string;
    actor: string;
    actorUserId: string;
  },
): Promise<void> {
  const insert: Database["public"]["Tables"]["audit_entries"]["Insert"] = {
    call_id: entry.callId ?? null,
    call_item_id: entry.callItemId ?? null,
    call_guide_id: entry.callGuideId ?? null,
    field: entry.field,
    from_value: entry.from || null,
    to_value: entry.to || null,
    reason: entry.reason || null,
    actor: entry.actor,
    actor_user_id: entry.actorUserId,
  };
  const { error } = await supabase.from("audit_entries").insert(insert);
  if (error) throw error;
}

// ---- Settings: guides ----

export async function upsertGuideLink(supabase: SupabaseClient, guide: GuideLink): Promise<void> {
  const insert: Database["public"]["Tables"]["guide_links"]["Insert"] = {
    id: guide.id,
    label: guide.label,
    url: guide.url ?? null,
    document_title: guide.documentTitle ?? null,
    document_version: guide.documentVersion ?? null,
    updated_at: now(),
  };
  const { error } = await supabase.from("guide_links").upsert(insert);
  if (error) throw error;
}

export async function deleteGuideLink(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("guide_links").delete().eq("id", id);
  if (error) throw error;
}

// ---- Settings: team ----

export async function upsertTeamMember(
  supabase: SupabaseClient,
  member: TeamMember,
): Promise<void> {
  const insert: Database["public"]["Tables"]["team_members"]["Insert"] = {
    id: member.id,
    name: member.name,
    updated_at: now(),
  };
  const { error } = await supabase.from("team_members").upsert(insert);
  if (error) throw error;
}

export async function deleteTeamMember(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw error;
}

// ---- Settings: templates ----

export async function upsertTemplate(
  supabase: SupabaseClient,
  template: {
    id: string;
    callType: CallType;
    name: string;
    description?: string | undefined;
  },
): Promise<void> {
  const insert: Database["public"]["Tables"]["templates"]["Insert"] = {
    id: template.id,
    call_type: template.callType,
    name: template.name,
    description: template.description ?? null,
    updated_at: now(),
  };
  const { error } = await supabase.from("templates").upsert(insert);
  if (error) throw error;
}

export async function upsertTemplateItem(
  supabase: SupabaseClient,
  item: TemplateItem,
  templateId: string,
  sortOrder: number,
): Promise<void> {
  const insert: Database["public"]["Tables"]["template_items"]["Insert"] = {
    id: item.id,
    template_id: templateId,
    label: item.label,
    kind: item.kind,
    required: item.required,
    archived: item.archived ?? false,
    help_text: item.helpText ?? null,
    review_send: item.reviewSend ?? false,
    guide_derived: item.guideDerived ?? false,
    demo_practice: item.demoPractice ?? false,
    sort_order: sortOrder,
    updated_at: now(),
  };
  const { error } = await supabase.from("template_items").upsert(insert);
  if (error) throw error;
}

export async function deleteTemplateItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("template_items").delete().eq("id", id);
  if (error) throw error;
}

export async function addTemplateItemRow(
  supabase: SupabaseClient,
  templateId: string,
  label: string,
  kind: ItemKind,
  required: boolean,
): Promise<string> {
  const { data, error: selErr } = await supabase
    .from("template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (selErr) throw selErr;
  const maxSort = data && data.length > 0 ? (data[0] as { sort_order: number })["sort_order"] : 0;
  const id = `ti-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insert: Database["public"]["Tables"]["template_items"]["Insert"] = {
    id,
    template_id: templateId,
    label,
    kind,
    required,
    sort_order: maxSort + 1,
  };
  const { error } = await supabase.from("template_items").insert(insert);
  if (error) throw error;
  return id;
}

export async function addTeamMemberRow(supabase: SupabaseClient, name: string): Promise<string> {
  const id = `tm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insert: Database["public"]["Tables"]["team_members"]["Insert"] = {
    id,
    name,
    sort_order: 999,
  };
  const { error } = await supabase.from("team_members").insert(insert);
  if (error) throw error;
  return id;
}

export async function addGuideLinkRow(
  supabase: SupabaseClient,
  label: string,
  url?: string,
): Promise<string> {
  const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insert: Database["public"]["Tables"]["guide_links"]["Insert"] = {
    id,
    label,
    url: url ?? null,
    sort_order: 999,
  };
  const { error } = await supabase.from("guide_links").insert(insert);
  if (error) throw error;
  return id;
}

// ---- Seed call items + guides from templates ----
// Creates per-call item snapshots from the template for the given call type,
// and call_guides records from guide_links (onboarding calls only).
// This does NOT overwrite historical call checklists — each call gets its
// own snapshot at creation time.
export async function seedCallChecklist(
  supabase: SupabaseClient,
  callId: string,
  callType: CallType,
): Promise<void> {
  // Find the template for this call type.
  const { data: tpl, error: tplErr } = await supabase
    .from("templates")
    .select("id")
    .eq("call_type", callType)
    .order("id")
    .limit(1)
    .single();
  if (tplErr) throw tplErr;

  // Load non-archived template items.
  const { data: tplItems, error: tiErr } = await supabase
    .from("template_items")
    .select("*")
    .eq("template_id", tpl.id)
    .eq("archived", false)
    .order("sort_order");
  if (tiErr) throw tiErr;

  // Insert call_items snapshots.
  const itemInserts: Database["public"]["Tables"]["call_items"]["Insert"][] = (tplItems ?? []).map(
    (ti) => ({
      call_id: callId,
      template_item_id: ti.id,
      label: ti.label,
      kind: ti.kind,
      required: ti.required,
      status: "not_checked",
      review_send: ti.review_send ?? false,
      guide_derived: ti.guide_derived ?? false,
      demo_practice: ti.demo_practice ?? false,
      help_text: ti.help_text,
      sort_order: ti.sort_order,
    }),
  );
  if (itemInserts.length > 0) {
    const { error: ciErr } = await supabase.from("call_items").insert(itemInserts);
    if (ciErr) throw ciErr;
  }

  // For onboarding calls, create call_guides from guide_links.
  if (callType === "onboarding") {
    const { data: guides, error: gErr } = await supabase
      .from("guide_links")
      .select("id")
      .order("sort_order");
    if (gErr) throw gErr;

    const guideInserts: Database["public"]["Tables"]["call_guides"]["Insert"][] = (
      guides ?? []
    ).map((g) => ({
      call_id: callId,
      guide_id: g.id,
      sent: false,
    }));
    if (guideInserts.length > 0) {
      const { error: cgErr } = await supabase.from("call_guides").insert(guideInserts);
      if (cgErr) throw cgErr;
    }
  }
}
