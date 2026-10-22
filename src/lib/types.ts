// Domain types for the LSP Onboarding Checklist.
// This is a staff tool. It only RECORDS the outcome of actions performed in
// LSP — it never sends review requests, creates CRM contacts, or connects
// integrations on the client's behalf.
//
// Optional properties are declared `?: T | undefined` so that callers may
// explicitly pass `undefined` (the project enables exactOptionalPropertyTypes).

export type OverallStatus = "not_started" | "in_progress" | "blocked" | "completed";

export type ConnectionStatus = "not_checked" | "connected" | "blocked" | "not_applicable";

export type TaskStatus =
  | "not_started"
  | "demonstrated_by_staff"
  | "client_completed"
  | "blocked"
  | "not_applicable";

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

export interface ConnectionItem {
  id: string;
  label: string;
  status: ConnectionStatus;
  verifiedAt?: string | undefined;
  verifier?: string | undefined;
  notes?: string | undefined;
  notApplicableReason?: string | undefined;
  audit: AuditEntry[];
}

export interface TaskItem {
  id: string;
  label: string;
  status: TaskStatus;
  clientConfirmed?: boolean | undefined;
  evidence?: string | undefined;
  completedBy?: string | undefined;
  completedAt?: string | undefined;
  notApplicableReason?: string | undefined;
  reviewOutcome?: ReviewOutcome | undefined;
  audit: AuditEntry[];
}

export interface Blocker {
  id: string;
  summary: string;
  owner: string;
  nextAction: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string | undefined;
  audit: AuditEntry[];
}

export interface GuideSentRecord {
  guideId: string;
  sent: boolean;
  sentAt?: string | undefined;
  channel?: GuideChannel | undefined;
  sentBy?: string | undefined;
  notes?: string | undefined;
  audit: AuditEntry[];
}

export interface CallSession {
  id: string;
  clientId: string;
  date: string;
  staffMember: string;
  summary?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
}

export interface Client {
  id: string;
  businessName: string;
  clientName: string;
  ghlLocationId?: string | undefined;
  ghlLink?: string | undefined;
  assignedTeamMember: string;
  callDate: string;
  plan: string;
  overallStatus: OverallStatus;
  notes?: string | undefined;
  nextCallDate?: string | undefined;
  connections: ConnectionItem[];
  tasks: TaskItem[];
  blockers: Blocker[];
  guides: GuideSentRecord[];
  callSessions: CallSession[];
  audit: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface GuideLink {
  id: string;
  label: string;
  url?: string | undefined;
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string | undefined;
  connectionLabels: string[];
  taskLabels: string[];
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

export const CONNECTION_STATUSES: { value: ConnectionStatus; label: string }[] = [
  { value: "not_checked", label: "Not checked" },
  { value: "connected", label: "Connected" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "Not applicable" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "demonstrated_by_staff", label: "Demonstrated by staff" },
  { value: "client_completed", label: "Client completed" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "Not applicable" },
];

export const REVIEW_OUTCOMES: { value: ReviewOutcome; label: string }[] = [
  { value: "recorded", label: "Request recorded" },
  { value: "sent", label: "Sent" },
  { value: "receipt_confirmed", label: "Receipt confirmed" },
  { value: "failed", label: "Failed" },
  { value: "unknown", label: "Unknown" },
];

export const OVERALL_STATUSES: { value: OverallStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

export const GUIDE_CHANNELS: { value: GuideChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "In-app" },
  { value: "call", label: "Call" },
  { value: "other", label: "Other" },
];

export const DEFAULT_CONNECTION_LABELS = [
  "Google account",
  "Google Business Profile + correct review destination",
  "Facebook business page",
  "Instagram (where applicable)",
  "Other agreed integrations",
];

export const DEFAULT_TASK_LABELS = [
  "Client searches for an existing contact (avoid duplicates)",
  "Client manually adds an agreed contact",
  "Client locates the saved contact",
  "Client opens the review-request feature",
  "Client selects an agreed recipient and reviews the message",
  "Client personally sends the Google review request",
  "Staff checks the recorded result",
];

export const DEFAULT_GUIDE_IDS = {
  addLead: "guide-add-lead",
  sendReview: "guide-send-review",
  onboardingHub: "guide-onboarding-hub",
} as const;