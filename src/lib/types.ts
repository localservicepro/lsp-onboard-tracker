// Domain types for the LSP Onboarding Checklist — a practical client-call tracker.
//
// This is a staff tool. It only RECORDS the outcome of actions performed in
// LSP — it never sends review requests, creates CRM contacts, connects
// integrations, or triggers workflows on the client's behalf.
//
// Optional properties are declared `?: T | undefined` so callers may explicitly
// pass `undefined` (the project enables exactOptionalPropertyTypes).

export type CallType = "connection" | "onboarding";

export type CallStatus = "not_started" | "in_progress" | "needs_followup" | "completed";

export type ItemKind = "client_action" | "staff_check";

// A simpler, practical item status.
//   not_checked   — untouched (NOT a blocker just because a call hasn't happened)
//   done          — completed (client did it for client_action; Done for staff_check)
//   needs_help    — an actual issue was recorded (this is what "needs follow-up" means)
//   not_applicable — exempted (requires a reason + reviewer acknowledgement)
export type ItemStatus = "not_checked" | "done" | "needs_help" | "not_applicable";

export type ReviewOutcome = "recorded" | "sent" | "receipt_confirmed" | "failed" | "unknown";

export type GuideChannel = "email" | "sms" | "in_app" | "call" | "other";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface CallItem {
  id: string;
  label: string;
  kind: ItemKind;
  required: boolean;
  status: ItemStatus;
  // `done` proof — a result/evidence note + staff + timestamp.
  // For client_action: "Client did it" means staff observed the client perform
  // it; a staff demonstration does NOT count. Requires a non-empty evidence note.
  // For staff_check: a brief verification note + verifier + timestamp.
  evidence?: string | undefined;
  completedBy?: string | undefined;
  completedAt?: string | undefined;
  // `needs_help` — an actual issue was recorded.
  issue?: string | undefined;
  nextAction?: string | undefined;
  // `not_applicable` — exemption requires a reason + reviewer acknowledgement.
  notApplicableReason?: string | undefined;
  acknowledgedByReviewer?: boolean | undefined;
  // Review-send task: keep "Sent" and "Receipt confirmed" distinct.
  reviewOutcome?: ReviewOutcome | undefined;
  // Marks the "send review request" item so the review-outcome selector shows.
  reviewSend?: boolean | undefined;
  // Marks an auto-derived staff_check (e.g. "Required how-to guides supplied").
  // Its status is computed from the call's guide records, not edited directly.
  guideDerived?: boolean | undefined;
  // Help text / guide link id hint copied from the template.
  helpText?: string | undefined;
  // Demo & Client Practice: staff demonstrated the task (does NOT complete it).
  // Only "Client performed" (status === "done" + evidence) counts as completion.
  demoPractice?: boolean | undefined;
  staffDemonstrated?: boolean | undefined;
  staffDemonstratedBy?: string | undefined;
  staffDemonstratedAt?: string | undefined;
  audit: AuditEntry[];
}

export interface CallGuideRecord {
  guideId: string;
  // "Guide sent" requires a valid supplied URL/version + date + channel + staff.
  // A verbal walkthrough is a SEPARATE activity and never counts as sent.
  // A guide with no configured URL cannot be marked Sent.
  sent: boolean;
  sentAt?: string | undefined;
  channel?: GuideChannel | undefined;
  sentBy?: string | undefined;
  suppliedUrlOrVersion?: string | undefined;
  // Verbal walkthrough (separate from guide delivery).
  walkthroughProvided?: boolean | undefined;
  walkthroughAt?: string | undefined;
  walkthroughBy?: string | undefined;
  walkthroughNotes?: string | undefined;
  // Documented exemption (only with reason + reviewer acknowledgement).
  notApplicableReason?: string | undefined;
  acknowledgedByReviewer?: boolean | undefined;
  audit: AuditEntry[];
}

export interface Call {
  id: string;
  clientId: string;
  type: CallType;
  date: string;
  staffMember: string;
  // Status is derived (see completion.ts), not stored — kept here only for
  // type compatibility with optional persistence; the UI always recomputes.
  notes?: string | undefined;
  followUpAction?: string | undefined;
  followUpOwner?: string | undefined;
  followUpDate?: string | undefined;
  finishedAt?: string | undefined;
  items: CallItem[];
  guides: CallGuideRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  businessName: string;
  clientName: string;
  assignedTeamMember: string;
  contactDetails?: string | undefined;
  ghlLink?: string | undefined;
  notes?: string | undefined;
  // Next call planning (set via "Schedule Next Call").
  nextCallType?: CallType | undefined;
  nextCallDate?: string | undefined;
  calls: Call[];
  // Internal test records are clearly labelled and never pre-completed.
  isTestRecord?: boolean | undefined;
  testPurpose?: string | undefined;
  accountContext?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface GuideLink {
  id: string;
  label: string;
  // A configured URL for an in-app guide, OR a document title + version for a
  // resource supplied outside the app. At least one makes the guide "supplied".
  url?: string | undefined;
  documentTitle?: string | undefined;
  documentVersion?: string | undefined;
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface TemplateItem {
  id: string;
  label: string;
  kind: ItemKind;
  required: boolean;
  archived?: boolean | undefined;
  helpText?: string | undefined;
  reviewSend?: boolean | undefined;
  // When true this staff_check item is auto-derived from the call's guide
  // records (sent-valid or exempted) and is NOT independently editable. It
  // becomes Done only when every required guide is satisfied or exempted.
  guideDerived?: boolean | undefined;
  demoPractice?: boolean | undefined;
}

export interface ChecklistTemplate {
  id: string;
  callType: CallType;
  name: string;
  description?: string | undefined;
  items: TemplateItem[];
}

export interface Settings {
  guides: GuideLink[];
  team: TeamMember[];
  templates: ChecklistTemplate[];
}

export interface AppState {
  clients: Client[];
  settings: Settings;
}

export const CALL_TYPES: { value: CallType; label: string }[] = [
  { value: "connection", label: "Integration & Connection" },
  { value: "onboarding", label: "Onboarding & Training" },
];

export const CALL_TYPE_LABEL: Record<CallType, string> = {
  connection: "Integration & Connection",
  onboarding: "Onboarding & Training",
};

export const ITEM_STATUSES: { value: ItemStatus; label: string }[] = [
  { value: "not_checked", label: "Not checked" },
  { value: "done", label: "Done" },
  { value: "needs_help", label: "Needs help" },
  { value: "not_applicable", label: "Not applicable" },
];

// Client-action items use a friendlier "Client did it" label for `done`.
export const CLIENT_ACTION_STATUSES: { value: ItemStatus; label: string }[] = [
  { value: "not_checked", label: "Not checked" },
  { value: "done", label: "Client did it" },
  { value: "needs_help", label: "Needs help" },
  { value: "not_applicable", label: "Not applicable" },
];

export const STAFF_CHECK_STATUSES: { value: ItemStatus; label: string }[] = [
  { value: "not_checked", label: "Not checked" },
  { value: "done", label: "Done" },
  { value: "needs_help", label: "Needs help" },
  { value: "not_applicable", label: "Not applicable" },
];

export const REVIEW_OUTCOMES: { value: ReviewOutcome; label: string }[] = [
  { value: "recorded", label: "Request recorded" },
  { value: "sent", label: "Sent" },
  { value: "receipt_confirmed", label: "Receipt confirmed" },
  { value: "failed", label: "Failed" },
  { value: "unknown", label: "Unknown" },
];

export const GUIDE_CHANNELS: { value: GuideChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "In-app" },
  { value: "call", label: "Call" },
  { value: "other", label: "Other" },
];

export const CALL_STATUSES: { value: CallStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "needs_followup", label: "Needs follow-up" },
  { value: "completed", label: "Completed" },
];

export const DEFAULT_GUIDE_IDS = {
  addLead: "guide-add-lead",
  sendReview: "guide-send-review",
  onboardingHub: "guide-onboarding-hub",
} as const;

// ---- Default template items ----

export const DEFAULT_CONNECTION_ITEMS: Omit<TemplateItem, "id">[] = [
  { label: "Client can access the correct LSP subaccount", kind: "staff_check", required: true },
  { label: "Google account connected, where required", kind: "staff_check", required: true },
  { label: "Correct Google Business Profile connected", kind: "staff_check", required: true },
  { label: "Google review destination checked", kind: "staff_check", required: true },
  {
    label: "Facebook business page connected, where required",
    kind: "staff_check",
    required: false,
  },
  { label: "Instagram connected, if included/applicable", kind: "staff_check", required: false },
  { label: "Calendar connected, if included/applicable", kind: "staff_check", required: false },
  { label: "Other agreed integrations checked", kind: "staff_check", required: false },
];

export const DEFAULT_ONBOARDING_ITEMS: Omit<TemplateItem, "id">[] = [
  { label: "Client personally logs into the phone app", kind: "client_action", required: true },
  {
    label: "Client selects the correct business/subaccount",
    kind: "client_action",
    required: true,
  },
  {
    label: "Client searches existing contacts to avoid duplicates",
    kind: "client_action",
    required: true,
  },
  {
    label: "Client manually adds an agreed contact",
    kind: "client_action",
    required: true,
    demoPractice: true,
  },
  { label: "Client finds the saved contact", kind: "client_action", required: true },
  { label: "Client opens the review-request feature", kind: "client_action", required: true },
  {
    label: "Client selects the agreed recipient and previews the message",
    kind: "client_action",
    required: true,
  },
  {
    label: "Client personally sends the Google review request",
    kind: "client_action",
    required: true,
    reviewSend: true,
    demoPractice: true,
  },
  {
    label: "Staff checks the recorded result",
    kind: "staff_check",
    required: true,
    reviewSend: true,
  },
  {
    label: "Required how-to guides supplied",
    kind: "staff_check",
    required: true,
    // Auto-calculated from the call's guide records — not independently editable.
    guideDerived: true,
  },
  { label: "Client questions answered and next steps agreed", kind: "staff_check", required: true },
];
