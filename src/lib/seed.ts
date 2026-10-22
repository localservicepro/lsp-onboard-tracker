import type {
  AppState,
  Client,
  ConnectionItem,
  TaskItem,
  Blocker,
  GuideSentRecord,
  CallSession,
  Settings,
  GuideLink,
  TeamMember,
  ChecklistTemplate,
  AuditEntry,
} from "./types";
import {
  DEFAULT_CONNECTION_LABELS,
  DEFAULT_TASK_LABELS,
  DEFAULT_GUIDE_IDS,
} from "./types";

function uid(prefix: string, n: number): string {
  return `${prefix}-${n}`;
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
  id: number,
  at: string,
  actor: string,
  field: string,
  from: string,
  to: string,
  reason: string,
): AuditEntry {
  return { id: uid("aud", id), at, actor, field, from, to, reason };
}

function makeConnections(
  n: number,
  overrides: Partial<Record<number, Partial<ConnectionItem>>>,
): ConnectionItem[] {
  return DEFAULT_CONNECTION_LABELS.map((label, i) => {
    const base: ConnectionItem = {
      id: `conn-${n}-${i}`,
      label,
      status: "not_checked",
      audit: [],
    };
    const ov = overrides[i];
    return ov ? { ...base, ...ov, audit: ov.audit ?? [] } : base;
  });
}

function makeTasks(
  n: number,
  overrides: Partial<Record<number, Partial<TaskItem>>>,
): TaskItem[] {
  return DEFAULT_TASK_LABELS.map((label, i) => {
    const base: TaskItem = {
      id: `task-${n}-${i}`,
      label,
      status: "not_started",
      audit: [],
    };
    const ov = overrides[i];
    return ov ? { ...base, ...ov, audit: ov.audit ?? [] } : base;
  });
}

// Stable task ids used for review-request semantics in the seed.
function reviewTaskIds(n: number): string[] {
  return DEFAULT_TASK_LABELS.map((_, i) => `task-${n}-${i}`).filter((_, i) =>
    [5, 6].includes(i),
  );
}

export function defaultSettings(): Settings {
  const guides: GuideLink[] = [
    { id: DEFAULT_GUIDE_IDS.addLead, label: "Add a lead manually in the phone app" },
    { id: DEFAULT_GUIDE_IDS.sendReview, label: "Send a Google review request in the phone app" },
    { id: DEFAULT_GUIDE_IDS.onboardingHub, label: "Existing LSP Client Onboarding hub" },
  ];
  const team: TeamMember[] = [
    { id: "tm-1", name: "Avery Chen" },
    { id: "tm-2", name: "Jordan Patel" },
    { id: "tm-3", name: "Sam Rivera" },
  ];
  const templates: ChecklistTemplate[] = [
    {
      id: "tpl-standard",
      name: "Standard onboarding",
      description: "Default connections and practical skills for new clients.",
      connectionLabels: [...DEFAULT_CONNECTION_LABELS],
      taskLabels: [...DEFAULT_TASK_LABELS],
    },
  ];
  return { guides, team, templates };
}

function makeClient(
  n: number,
  data: {
    businessName: string;
    clientName: string;
    ghlLocationId?: string;
    ghlLink?: string;
    assignedTeamMember: string;
    callDate: string;
    plan: string;
    overallStatus: Client["overallStatus"];
    notes?: string;
    nextCallDate?: string;
    connections: ConnectionItem[];
    tasks: TaskItem[];
    blockers: Blocker[];
    guides: GuideSentRecord[];
    callSessions: CallSession[];
    audit: AuditEntry[];
    createdAt: string;
  },
): Client {
  return {
    id: uid("client", n),
    ...data,
    updatedAt: nowISO(0),
  };
}

export function seedState(): AppState {
  const settings = defaultSettings();

  // Client 1 — in progress, Google connected but practical tasks NOT done.
  const c1Connections = makeConnections(1, {
    0: { status: "connected", verifiedAt: nowISO(3), verifier: "Avery Chen", notes: "OAuth completed; scopes confirmed." },
    1: { status: "connected", verifiedAt: nowISO(3), verifier: "Avery Chen", notes: "GBP linked; review destination set to the business listing." },
  });
  // Practical tasks: staff demonstrated but client has NOT completed.
  const c1Tasks = makeTasks(1, {
    0: { status: "demonstrated_by_staff", audit: [audit(1, nowISO(3), "Avery Chen", "Search existing contact", "Not started", "Demonstrated by staff", "Walked through on call")] },
    1: { status: "demonstrated_by_staff", audit: [audit(2, nowISO(3), "Avery Chen", "Add contact", "Not started", "Demonstrated by staff", "Showed the flow")] },
  });
  const c1 = makeClient(1, {
    businessName: "Northwind Dental",
    clientName: "Dr. Lena Okafor",
    ghlLocationId: "loc_northwind_8842",
    ghlLink: "https://app.example.com/locations/loc_northwind_8842",
    assignedTeamMember: "Avery Chen",
    callDate: dateISO(3),
    plan: "Starter — phone app, review requests, GBP connection",
    overallStatus: "in_progress",
    notes: "Client is comfortable with the phone app but has not yet performed the steps themselves.",
    nextCallDate: dateISO(-4),
    connections: c1Connections,
    tasks: c1Tasks,
    blockers: [
      {
        id: "blk-1-1",
        summary: "Instagram not yet linked — client needs business login",
        owner: "Jordan Patel",
        nextAction: "Send client the Instagram connection walkthrough",
        createdAt: nowISO(3),
        resolved: false,
        audit: [audit(3, nowISO(3), "Avery Chen", "Blocker created", "", "Open", "Instagram pending")],
      },
    ],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: true, sentAt: nowISO(3), channel: "email", sentBy: "Avery Chen", notes: "Emailed PDF guide.", audit: [audit(4, nowISO(3), "Avery Chen", "Guide sent", "Not sent", "Sent", "Emailed")] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
    ],
    callSessions: [
      { id: "call-1-1", clientId: "client-1", date: dateISO(3), staffMember: "Avery Chen", notes: "Initial onboarding call. Google + GBP connected. Demonstrated contact search/add.", createdAt: nowISO(3) },
    ],
    audit: [audit(5, nowISO(3), "Avery Chen", "Overall status", "Not started", "In progress", "Started onboarding")],
    createdAt: nowISO(5),
  });

  // Client 2 — blocked: review request sent but NOT receipt confirmed; a blocker open.
  const c2Connections = makeConnections(2, {
    0: { status: "connected", verifiedAt: nowISO(6), verifier: "Jordan Patel" },
    1: { status: "connected", verifiedAt: nowISO(6), verifier: "Jordan Patel" },
    2: { status: "connected", verifiedAt: nowISO(6), verifier: "Jordan Patel" },
  });
  const c2Tasks = makeTasks(2, {
    0: { status: "client_completed", clientConfirmed: true, evidence: "Client searched and found 3 existing contacts.", completedBy: "Jordan Patel", completedAt: nowISO(6), audit: [audit(6, nowISO(6), "Jordan Patel", "Search existing contact", "Demonstrated by staff", "Client completed", "Client did it")] },
    1: { status: "client_completed", clientConfirmed: true, evidence: "Client added a contact 'Test Patient' and it appeared in the list.", completedBy: "Jordan Patel", completedAt: nowISO(6), audit: [audit(7, nowISO(6), "Jordan Patel", "Add contact", "Not started", "Client completed", "Client did it")] },
    2: { status: "client_completed", clientConfirmed: true, evidence: "Client located the contact just added.", completedBy: "Jordan Patel", completedAt: nowISO(6), audit: [audit(8, nowISO(6), "Jordan Patel", "Locate saved contact", "Not started", "Client completed", "Client did it")] },
    3: { status: "client_completed", clientConfirmed: true, evidence: "Client opened the review-request screen.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(9, nowISO(5), "Jordan Patel", "Open review-request feature", "Not started", "Client completed", "Client did it")] },
    4: { status: "client_completed", clientConfirmed: true, evidence: "Client selected a recipient and reviewed the message.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(10, nowISO(5), "Jordan Patel", "Select recipient + review message", "Not started", "Client completed", "Client did it")] },
    // Sent but NOT receipt confirmed — must remain distinct.
    5: { status: "client_completed", clientConfirmed: true, evidence: "Client pressed send; request shows as Sent in the app.", completedBy: "Jordan Patel", completedAt: nowISO(5), reviewOutcome: "sent", audit: [audit(11, nowISO(5), "Jordan Patel", "Send review request", "Not started", "Client completed", "Client sent it; outcome: Sent")] },
    6: { status: "blocked", reviewOutcome: "unknown", audit: [audit(12, nowISO(5), "Jordan Patel", "Check recorded result", "Not started", "Blocked", "No receipt confirmation yet")] },
  });
  const c2 = makeClient(2, {
    businessName: "Summit Physio",
    clientName: "Marcus Bell",
    ghlLocationId: "loc_summit_2210",
    ghlLink: "https://app.example.com/locations/loc_summit_2210",
    assignedTeamMember: "Jordan Patel",
    callDate: dateISO(6),
    plan: "Growth — phone app, review requests, GBP + Facebook + Instagram",
    overallStatus: "blocked",
    notes: "Review request was sent but receipt is not yet confirmed. Waiting on the client to confirm the recipient received it.",
    nextCallDate: dateISO(-2),
    connections: c2Connections,
    tasks: c2Tasks,
    blockers: [
      {
        id: "blk-2-1",
        summary: "Review request Sent but not Receipt confirmed",
        owner: "Jordan Patel",
        nextAction: "Confirm with client that the recipient received the review request",
        createdAt: nowISO(5),
        resolved: false,
        audit: [audit(13, nowISO(5), "Jordan Patel", "Blocker created", "", "Open", "Receipt not confirmed")],
      },
    ],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: true, sentAt: nowISO(6), channel: "in_app", sentBy: "Jordan Patel", audit: [audit(14, nowISO(6), "Jordan Patel", "Guide sent", "Not sent", "Sent", "In-app")] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: true, sentAt: nowISO(6), channel: "email", sentBy: "Jordan Patel", audit: [audit(15, nowISO(6), "Jordan Patel", "Guide sent", "Not sent", "Sent", "Emailed")] },
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
    ],
    callSessions: [
      { id: "call-2-1", clientId: "client-2", date: dateISO(6), staffMember: "Jordan Patel", notes: "Onboarding call. All connections verified. Client performed contact tasks. Review request sent.", createdAt: nowISO(6) },
      { id: "call-2-2", clientId: "client-2", date: dateISO(5), staffMember: "Jordan Patel", notes: "Follow-up call. Client sent the review request; receipt not yet confirmed.", createdAt: nowISO(5) },
    ],
    audit: [audit(16, nowISO(6), "Jordan Patel", "Overall status", "Not started", "Blocked", "Receipt not confirmed")],
    createdAt: nowISO(8),
  });

  // Client 3 — completed: all practical tasks done with proof, no open blockers.
  const c3Connections = makeConnections(3, {
    0: { status: "connected", verifiedAt: nowISO(10), verifier: "Sam Rivera" },
    1: { status: "connected", verifiedAt: nowISO(10), verifier: "Sam Rivera" },
    4: { status: "not_applicable", notApplicableReason: "No other integrations agreed for this plan.", audit: [audit(17, nowISO(10), "Sam Rivera", "Other integrations", "Not checked", "Not applicable", "None agreed")] },
  });
  const c3Tasks = makeTasks(3, {
    0: { status: "client_completed", clientConfirmed: true, evidence: "Client searched and found existing contact.", completedBy: "Sam Rivera", completedAt: nowISO(9), audit: [audit(18, nowISO(9), "Sam Rivera", "Search existing contact", "Not started", "Client completed", "Client did it")] },
    1: { status: "client_completed", clientConfirmed: true, evidence: "Client added a contact and it saved.", completedBy: "Sam Rivera", completedAt: nowISO(9), audit: [audit(19, nowISO(9), "Sam Rivera", "Add contact", "Not started", "Client completed", "Client did it")] },
    2: { status: "client_completed", clientConfirmed: true, evidence: "Client located the saved contact.", completedBy: "Sam Rivera", completedAt: nowISO(9), audit: [audit(20, nowISO(9), "Sam Rivera", "Locate saved contact", "Not started", "Client completed", "Client did it")] },
    3: { status: "client_completed", clientConfirmed: true, evidence: "Client opened the review-request feature.", completedBy: "Sam Rivera", completedAt: nowISO(9), audit: [audit(21, nowISO(9), "Sam Rivera", "Open review-request feature", "Not started", "Client completed", "Client did it")] },
    4: { status: "client_completed", clientConfirmed: true, evidence: "Client selected recipient and reviewed message.", completedBy: "Sam Rivera", completedAt: nowISO(9), audit: [audit(22, nowISO(9), "Sam Rivera", "Select recipient + review message", "Not started", "Client completed", "Client did it")] },
    5: { status: "client_completed", clientConfirmed: true, evidence: "Client sent the request; receipt confirmed by recipient.", completedBy: "Sam Rivera", completedAt: nowISO(9), reviewOutcome: "receipt_confirmed", audit: [audit(23, nowISO(9), "Sam Rivera", "Send review request", "Not started", "Client completed", "Client sent; receipt confirmed")] },
    6: { status: "client_completed", clientConfirmed: true, evidence: "Staff checked the recorded result; review shows as requested.", completedBy: "Sam Rivera", completedAt: nowISO(9), reviewOutcome: "receipt_confirmed", audit: [audit(24, nowISO(9), "Sam Rivera", "Check recorded result", "Not started", "Client completed", "Receipt confirmed")] },
  });
  const c3 = makeClient(3, {
    businessName: "Harbor Coffee Roasters",
    clientName: "Priya Nair",
    assignedTeamMember: "Sam Rivera",
    callDate: dateISO(10),
    plan: "Starter — phone app, review requests, GBP connection",
    overallStatus: "completed",
    notes: "Onboarding complete. Client demonstrated all practical tasks and receipt was confirmed.",
    connections: c3Connections,
    tasks: c3Tasks,
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: true, sentAt: nowISO(10), channel: "email", sentBy: "Sam Rivera", audit: [audit(25, nowISO(10), "Sam Rivera", "Guide sent", "Not sent", "Sent", "Emailed")] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: true, sentAt: nowISO(10), channel: "email", sentBy: "Sam Rivera", audit: [audit(26, nowISO(10), "Sam Rivera", "Guide sent", "Not sent", "Sent", "Emailed")] },
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: true, sentAt: nowISO(10), channel: "in_app", sentBy: "Sam Rivera", audit: [audit(27, nowISO(10), "Sam Rivera", "Guide sent", "Not sent", "Sent", "In-app")] },
    ],
    callSessions: [
      { id: "call-3-1", clientId: "client-3", date: dateISO(10), staffMember: "Sam Rivera", notes: "Onboarding call. All tasks completed by client; receipt confirmed.", createdAt: nowISO(10) },
    ],
    audit: [audit(28, nowISO(9), "Sam Rivera", "Overall status", "In progress", "Completed", "All tasks + receipt confirmed")],
    createdAt: nowISO(12),
  });

  // Client 4 — not started.
  const c4 = makeClient(4, {
    businessName: "Cedar & Stone Salon",
    clientName: "Tom Whitfield",
    assignedTeamMember: "Avery Chen",
    callDate: dateISO(-1),
    plan: "Starter — phone app, review requests, GBP connection",
    overallStatus: "not_started",
    notes: "Onboarding call scheduled for tomorrow.",
    connections: makeConnections(4, {}),
    tasks: makeTasks(4, {}),
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
    ],
    callSessions: [],
    audit: [],
    createdAt: nowISO(1),
  });

  return { clients: [c1, c2, c3, c4], settings };
}

// Re-export for convenience.
export { reviewTaskIds };