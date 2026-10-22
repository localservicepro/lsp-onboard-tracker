// Server-only email notification logic for the LSP Onboarding Checklist.
//
// Sends a progress-summary email to support@localservicepro.com.au via a
// server-side email provider (Resend). The recipient is fixed and enforced
// server-side. Email credentials are read from process.env inside the handler
// — never exposed to the browser.
//
// Requirements before live use (the user must supply these via the Secrets UI):
//   - RESEND_API_KEY: a Resend API key
//   - EMAIL_FROM_ADDRESS: a verified sender address (e.g. onboarding@localservicepro.com.au)
//   - The sender domain must be verified with the email provider.
// Until both are set, notifications are recorded as "failed" with a clear
// message — the saved call is never discarded.

import type { Database } from "@/integrations/supabase/types";

type SupabaseClient = ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>;

export const NOTIFICATION_RECIPIENT = "support@localservicepro.com.au";

export interface EmailPayload {
  callId: string;
  eventKey: string;
  subject: string;
  body: string;
}

export interface SendResult {
  status: "accepted" | "failed";
  providerMessageId?: string | undefined;
  error?: string | undefined;
}

// Attempt to send an email via Resend. Returns the provider response or a
// clear error. Does NOT throw — the caller records the outcome.
async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "failed",
        error: `Email provider returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "accepted", providerMessageId: data.id };
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Network error sending email",
    };
  }
}

// Queue + send a progress-summary email. Uses a unique event_key in
// notification_log to prevent duplicates. If the event already exists and
// was accepted, returns "accepted" without resending. If it failed, retries.
export async function sendProgressEmail(
  supabase: SupabaseClient,
  payload: EmailPayload,
): Promise<SendResult> {
  type NotificationRow = Database["public"]["Tables"]["notification_log"]["Row"];
  type NotificationInsert = Database["public"]["Tables"]["notification_log"]["Insert"];
  type NotificationUpdate = Database["public"]["Tables"]["notification_log"]["Update"];

  // Check for an existing record with this event_key.
  const existing = await supabase
    .from("notification_log")
    .select("*")
    .eq("event_key", payload.eventKey)
    .maybeSingle();

  const existingRow = existing.data as NotificationRow | null;

  if (existingRow && existingRow.status === "accepted") {
    return {
      status: "accepted",
      providerMessageId: existingRow.provider_message_id ?? undefined,
    };
  }

  // Insert or update the notification record.
  if (existingRow) {
    const upd: NotificationUpdate = {
      status: "pending",
      error: null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("notification_log").update(upd).eq("id", existingRow.id);
  } else {
    const ins: NotificationInsert = {
      event_key: payload.eventKey,
      call_id: payload.callId,
      recipient: NOTIFICATION_RECIPIENT,
      status: "pending",
    };
    const { error } = await supabase.from("notification_log").insert(ins);
    if (error) {
      // Unique constraint violation means another request already created it.
      if (error.code !== "23505") {
        return {
          status: "failed",
          error: `Could not queue notification: ${error.message}`,
        };
      }
    }
  }

  // Read email provider credentials inside the handler (call-time injection).
  const apiKey = process.env["RESEND_API_KEY"];
  const fromAddress = process.env["EMAIL_FROM_ADDRESS"];

  if (!apiKey || !fromAddress) {
    const errMsg =
      "Email not sent: RESEND_API_KEY and EMAIL_FROM_ADDRESS must be configured. " +
      "Supply them via the Secrets interface and verify the sender domain with Resend.";
    await updateNotificationStatus(supabase, payload.eventKey, "failed", errMsg);
    return { status: "failed", error: errMsg };
  }

  const result = await sendViaResend(
    apiKey,
    fromAddress,
    NOTIFICATION_RECIPIENT,
    payload.subject,
    payload.body,
  );

  await updateNotificationStatus(
    supabase,
    payload.eventKey,
    result.status,
    result.error,
    result.providerMessageId,
  );

  return result;
}

async function updateNotificationStatus(
  supabase: SupabaseClient,
  eventKey: string,
  status: string,
  error?: string,
  providerMessageId?: string,
): Promise<void> {
  type NotificationUpdate = Database["public"]["Tables"]["notification_log"]["Update"];
  const upd: NotificationUpdate = {
    status,
    error: error ?? null,
    provider_message_id: providerMessageId ?? null,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("notification_log").update(upd).eq("event_key", eventKey);
}

// Build the email subject and body from call + client data.
export function buildEmailSubject(businessName: string, callDate: string): string {
  return `[Onboarding — Follow-up required] ${businessName} — ${callDate}`;
}

export function buildEmailBody(params: {
  businessName: string;
  clientName: string;
  callType: string;
  callDate: string;
  staffMember: string;
  completedTasks: string[];
  outstandingWork: string[];
  followUpOwner: string;
  followUpAction: string;
  followUpDate: string;
  callStatus: string;
  clientLink: string;
}): string {
  const lines: string[] = [];
  lines.push("LSP Onboarding — Progress Update");
  lines.push("");
  lines.push(`Business: ${params.businessName}`);
  lines.push(`Client: ${params.clientName}`);
  lines.push(`Call type: ${params.callType}`);
  lines.push(`Call date: ${params.callDate}`);
  lines.push(`Observing staff: ${params.staffMember}`);
  lines.push(`Call/checklist status: ${params.callStatus}`);
  lines.push("");
  lines.push(`Completed tasks (${params.completedTasks.length}):`);
  if (params.completedTasks.length === 0) lines.push("  - None");
  else params.completedTasks.forEach((t) => lines.push(`  - ${t}`));
  lines.push("");
  lines.push(`Outstanding work (${params.outstandingWork.length}):`);
  if (params.outstandingWork.length === 0) lines.push("  - None");
  else params.outstandingWork.forEach((t) => lines.push(`  - ${t}`));
  lines.push("");
  lines.push("Follow-up:");
  lines.push(`  - Owner: ${params.followUpOwner}`);
  lines.push(`  - Next action: ${params.followUpAction}`);
  lines.push(`  - Due: ${params.followUpDate}`);
  lines.push("");
  lines.push(`Client record: ${params.clientLink}`);
  lines.push("(Accessible only after authorised staff sign-in.)");
  lines.push("");
  lines.push("— LSP Onboarding Checklist (staff tool)");
  return lines.join("\n");
}
