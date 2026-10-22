// Server functions for the LSP Onboarding Checklist.
// Thin wrappers over the server-only data + mutation helpers. All are
// protected by requireSupabaseAuth (RLS-enforced as the signed-in staff).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadState } from "./data.server";
import {
  insertClient,
  updateClientRow,
  deleteClientRow,
  insertCall,
  updateCallRow,
  updateCallItemRow,
  updateCallGuideRow,
  insertAudit,
  upsertGuideLink,
  deleteGuideLink,
  upsertTeamMember,
  deleteTeamMember,
  upsertTemplate,
  upsertTemplateItem,
  deleteTemplateItem,
  addTemplateItemRow,
  addTeamMemberRow,
  addGuideLinkRow,
  type NewClientInput,
  type ClientUpdate,
  type CallUpdate,
  type CallItemUpdate,
  type CallGuideUpdate,
} from "./mutations.server";
import { sendProgressEmail, buildEmailSubject, buildEmailBody } from "./email.server";
import {
  deriveCallStatus,
  effectiveItem,
  isItemDone,
  itemNeedsFollowUp,
} from "./completion";
import type { CallType, ItemStatus, ReviewOutcome, GuideChannel } from "./types";

// ---- Load full app state ----
export const getState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadState(context.supabase);
  });

// ---- Get current staff identity + approval ----
// Returns the authenticated user's identity and whether they are an
// approved staff member (present in public.staff). Unapproved signed-in
// users get { approved: false } and the UI blocks access to records.
export const getStaffIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const email = context.claims.email ?? null;
    // Check if this user is an approved staff member.
    const { data: staffRow } = await context.supabase
      .from("staff")
      .select("id, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      userId,
      email,
      approved: !!staffRow,
      displayName: staffRow?.display_name ?? email ?? "Staff",
    };
  });

// ---- Add client ----
const newClientSchema = z.object({
  businessName: z.string().min(1),
  clientName: z.string().min(1),
  assignedTeamMember: z.string().min(1),
  callType: z.enum(["connection", "onboarding"]),
  callDate: z.string().optional(),
  contactDetails: z.string().optional(),
  ghlLink: z.string().optional(),
  notes: z.string().optional(),
  isTestRecord: z.boolean().optional(),
  testPurpose: z.string().optional(),
  accountContext: z.string().optional(),
});

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => newClientSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await insertClient(context.supabase, data as NewClientInput, context.userId);
    return { id };
  });

// ---- Update client ----
const clientUpdateSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string().optional(),
  clientName: z.string().optional(),
  assignedTeamMember: z.string().optional(),
  contactDetails: z.string().optional(),
  ghlLink: z.string().optional(),
  notes: z.string().optional(),
  nextCallType: z.enum(["connection", "onboarding"]).optional(),
  nextCallDate: z.string().optional(),
});

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => clientUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    await updateClientRow(context.supabase, id, patch as ClientUpdate);
    return { ok: true };
  });

// ---- Delete client ----
export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await deleteClientRow(context.supabase, data.id);
    return { ok: true };
  });

// ---- Start call ----
const startCallSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(["connection", "onboarding"]),
  staffMember: z.string().min(1),
  date: z.string().optional(),
});

export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => startCallSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await insertCall(
      context.supabase,
      data.clientId,
      data.type as CallType,
      data.staffMember,
      data.date ?? new Date().toISOString().slice(0, 10),
      context.userId,
    );
    return { id };
  });

// ---- Update call ----
const callUpdateSchema = z.object({
  callId: z.string().uuid(),
  staffMember: z.string().optional(),
  notes: z.string().optional(),
  followUpAction: z.string().optional(),
  followUpOwner: z.string().optional(),
  followUpDate: z.string().optional(),
  finishedAt: z.string().nullable().optional(),
});

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => callUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { callId, ...patch } = data;
    await updateCallRow(context.supabase, callId, patch as CallUpdate);
    return { ok: true };
  });

// ---- Set call item ----
const callItemSchema = z.object({
  callId: z.string().uuid(),
  itemId: z.string().uuid(),
  patch: z.object({
    status: z.enum(["not_checked", "done", "needs_help", "not_applicable"]).optional(),
    evidence: z.string().optional(),
    completedBy: z.string().optional(),
    completedAt: z.string().optional(),
    issue: z.string().optional(),
    nextAction: z.string().optional(),
    notApplicableReason: z.string().optional(),
    acknowledgedByReviewer: z.boolean().optional(),
    reviewOutcome: z
      .enum(["recorded", "sent", "receipt_confirmed", "failed", "unknown"])
      .optional(),
    staffDemonstrated: z.boolean().optional(),
    staffDemonstratedBy: z.string().optional(),
    staffDemonstratedAt: z.string().optional(),
  }),
  reason: z.string().optional(),
});

export const setCallItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => callItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    await updateCallItemRow(context.supabase, data.itemId, data.patch as CallItemUpdate);
    return { ok: true };
  });

// ---- Set call guide ----
const callGuideSchema = z.object({
  callId: z.string().uuid(),
  guideId: z.string().min(1),
  patch: z.object({
    sent: z.boolean().optional(),
    sentAt: z.string().optional(),
    channel: z.enum(["email", "sms", "in_app", "call", "other"]).optional(),
    sentBy: z.string().optional(),
    suppliedUrlOrVersion: z.string().optional(),
    walkthroughProvided: z.boolean().optional(),
    walkthroughAt: z.string().optional(),
    walkthroughBy: z.string().optional(),
    walkthroughNotes: z.string().optional(),
    notApplicableReason: z.string().optional(),
    acknowledgedByReviewer: z.boolean().optional(),
  }),
  reason: z.string().optional(),
});

export const setCallGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => callGuideSchema.parse(data))
  .handler(async ({ data, context }) => {
    await updateCallGuideRow(
      context.supabase,
      data.callId,
      data.guideId,
      data.patch as CallGuideUpdate,
    );
    return { ok: true };
  });

// ---- Settings: guides ----
const guideLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().optional(),
  documentTitle: z.string().optional(),
  documentVersion: z.string().optional(),
});

export const upsertGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => guideLinkSchema.parse(data))
  .handler(async ({ data, context }) => {
    await upsertGuideLink(context.supabase, data);
    return { ok: true };
  });

export const removeGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await deleteGuideLink(context.supabase, data.id);
    return { ok: true };
  });

const addGuideSchema = z.object({
  label: z.string().min(1),
  url: z.string().optional(),
});

export const addGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => addGuideSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await addGuideLinkRow(context.supabase, data.label, data.url);
    return { id };
  });

// ---- Settings: team ----
const addTeamSchema = z.object({ name: z.string().min(1) });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => addTeamSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await addTeamMemberRow(context.supabase, data.name);
    return { id };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await deleteTeamMember(context.supabase, data.id);
    return { ok: true };
  });

// ---- Settings: templates ----
const templateSchema = z.object({
  id: z.string().min(1),
  callType: z.enum(["connection", "onboarding"]),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const upsertTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => templateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await upsertTemplate(context.supabase, data);
    return { ok: true };
  });

const templateItemSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["client_action", "staff_check"]),
  required: z.boolean(),
  archived: z.boolean().optional(),
  helpText: z.string().optional(),
  reviewSend: z.boolean().optional(),
  guideDerived: z.boolean().optional(),
  demoPractice: z.boolean().optional(),
  sortOrder: z.number(),
});

export const upsertTemplateItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => templateItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    await upsertTemplateItem(context.supabase, data, data.templateId, data.sortOrder);
    return { ok: true };
  });

export const removeTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await deleteTemplateItem(context.supabase, data.id);
    return { ok: true };
  });

const addTemplateItemSchema = z.object({
  templateId: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["client_action", "staff_check"]),
  required: z.boolean(),
});

export const addTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => addTemplateItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await addTemplateItemRow(
      context.supabase,
      data.templateId,
      data.label,
      data.kind,
      data.required,
    );
    return { id };
  });

// ---- Finish call (save + queue email) ----
// Computes the summary payload server-side from the actual call records,
// so the client never has to assemble it. Save first, then queue one email.
const finishCallSchema = z.object({
  callId: z.string().uuid(),
  notes: z.string().optional(),
  followUpAction: z.string().optional(),
  followUpOwner: z.string().optional(),
  followUpDate: z.string().optional(),
});

export const finishCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => finishCallSchema.parse(data))
  .handler(async ({ data, context }) => {
    // 1. Save the call.
    await updateCallRow(context.supabase, data.callId, {
      notes: data.notes,
      followUpAction: data.followUpAction,
      followUpOwner: data.followUpOwner,
      followUpDate: data.followUpDate,
      finishedAt: new Date().toISOString(),
    });

    // 2. Load the call + client to build the email payload server-side.
    const loaded = await loadState(context.supabase);
    let client = loaded.clients.find((c) => c.calls.some((cl) => cl.id === data.callId));
    if (!client) {
      // Fallback: load just this call's client.
      const { data: callRow } = await context.supabase
        .from("calls")
        .select("client_id")
        .eq("id", data.callId)
        .maybeSingle();
      client = loaded.clients.find((c) => c.id === (callRow as { client_id?: string })?.client_id);
    }
    const call = client?.calls.find((c) => c.id === data.callId);
    if (!client || !call) return { ok: true, email: { status: "failed", error: "Call not found" } };

    const guides = loaded.guides;
    const cs = deriveCallStatus(call, guides);
    const completed: string[] = [];
    const outstanding: string[] = [];
    for (const it of call.items) {
      const eff = effectiveItem(call, it, guides);
      if (eff.status === "done" && isItemDone(eff)) completed.push(it.label);
      else if (itemNeedsFollowUp(eff)) outstanding.push(`${it.label} — needs help`);
      else if (eff.status !== "not_applicable") outstanding.push(it.label);
    }

    const eventKey = `finish-call-${data.callId}`;
    const subject = buildEmailSubject(client.businessName, call.date);
    const body = buildEmailBody({
      businessName: client.businessName,
      clientName: client.clientName,
      callType: call.type === "connection" ? "Integration & Connection" : "Onboarding & Training",
      callDate: call.date,
      staffMember: call.staffMember,
      completedTasks: completed,
      outstandingWork: outstanding,
      followUpOwner: call.followUpOwner || "—",
      followUpAction: call.followUpAction || "—",
      followUpDate: call.followUpDate || "—",
      callStatus: cs.replace(/_/g, " "),
      clientLink: "",
    });

    const emailResult = await sendProgressEmail(context.supabase, {
      callId: data.callId,
      eventKey,
      subject,
      body,
    });

    return { ok: true, email: emailResult };
  });

// ---- Send progress update (interim, optional) ----
const sendUpdateSchema = z.object({
  callId: z.string().uuid(),
});

export const sendProgressUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => sendUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const loaded = await loadState(context.supabase);
    let client = loaded.clients.find((c) => c.calls.some((cl) => cl.id === data.callId));
    if (!client) {
      const { data: callRow } = await context.supabase
        .from("calls")
        .select("client_id")
        .eq("id", data.callId)
        .maybeSingle();
      client = loaded.clients.find((c) => c.id === (callRow as { client_id?: string })?.client_id);
    }
    const call = client?.calls.find((c) => c.id === data.callId);
    if (!client || !call)
      return { ok: false, email: { status: "failed", error: "Call not found" } };

    const guides = loaded.guides;
    const cs = deriveCallStatus(call, guides);
    const completed: string[] = [];
    const outstanding: string[] = [];
    for (const it of call.items) {
      const eff = effectiveItem(call, it, guides);
      if (eff.status === "done" && isItemDone(eff)) completed.push(it.label);
      else if (itemNeedsFollowUp(eff)) outstanding.push(`${it.label} — needs help`);
      else if (eff.status !== "not_applicable") outstanding.push(it.label);
    }

    // Timestamped event key so interim updates are not deduped away, but
    // still prevent duplicates within the same second.
    const eventKey = `progress-update-${data.callId}-${cs}-${Math.floor(Date.now() / 1000)}`;
    const subject = `[Onboarding — Progress update] ${client.businessName} — ${call.date}`;
    const body = buildEmailBody({
      businessName: client.businessName,
      clientName: client.clientName,
      callType: call.type === "connection" ? "Integration & Connection" : "Onboarding & Training",
      callDate: call.date,
      staffMember: call.staffMember,
      completedTasks: completed,
      outstandingWork: outstanding,
      followUpOwner: call.followUpOwner || "—",
      followUpAction: call.followUpAction || "—",
      followUpDate: call.followUpDate || "—",
      callStatus: cs.replace(/_/g, " "),
      clientLink: "",
    });

    const emailResult = await sendProgressEmail(context.supabase, {
      callId: data.callId,
      eventKey,
      subject,
      body,
    });

    return { ok: true, email: emailResult };
  });
