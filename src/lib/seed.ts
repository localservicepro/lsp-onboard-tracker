import type {
  AppState,
  Client,
  AccessCheckItem,
  ConnectionItem,
  TaskItem,
  StaffVerificationItem,
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
  DEFAULT_ACCESS_CHECKS,
  DEFAULT_CONNECTION_CONFIGS,
  DEFAULT_CLIENT_PRACTICAL_TASKS,
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

function makeAccessChecks(
  n: number,
  overrides: Partial<Record<number, Partial<AccessCheckItem>>>,
): AccessCheckItem[] {
  return DEFAULT_ACCESS_CHECKS.map((label, i) => {
    const base: AccessCheckItem = {
      id: `acc-${n}-${i}`,
      label,
      checked: false,
      audit: [],
    };
    const ov = overrides[i];
    return ov ? { ...base, ...ov, audit: ov.audit ?? [] } : base;
  });
}

function makeConnections(
  n: number,
  overrides: Partial<Record<number, Partial<ConnectionItem>>>,
): ConnectionItem[] {
  return DEFAULT_CONNECTION_CONFIGS.map((cfg, i) => {
    const base: ConnectionItem = {
      id: `conn-${n}-${i}`,
      label: cfg.label,
      required: cfg.required,
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
  return DEFAULT_CLIENT_PRACTICAL_TASKS.map((label, i) => {
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

export function defaultSettings(): Settings {
  const guides: GuideLink[] = [
    { id: DEFAULT_GUIDE_IDS.addLead, label: "Add a lead manually in the phone app", url: undefined },
    { id: DEFAULT_GUIDE_IDS.sendReview, label: "Send a Google review request in the phone app", url: undefined },
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
  const templates: ChecklistTemplate[] = [
    {
      id: "tpl-standard",
      name: "Digital Essentials standard onboarding",
      description: "Default connections, phone app login, practical skills and review request.",
      connectionLabels: DEFAULT_CONNECTION_CONFIGS.map((c) => ({ label: c.label, required: c.required })),
      taskLabels: [...DEFAULT_CLIENT_PRACTICAL_TASKS],
    },
  ];
  return { guides, team, templates };
}

function makeClient(
  n: number,
  data: {
    businessName: string;
    clientName: string;
    ghlLocationId?: string | undefined;
    ghlLink?: string | undefined;
    assignedTeamMember: string;
    callDate: string;
    plan: string;
    overallStatus: Client["overallStatus"];
    notes?: string | undefined;
    nextCallDate?: string | undefined;
    accessChecks: AccessCheckItem[];
    connections: ConnectionItem[];
    tasks: TaskItem[];
    staffVerification: StaffVerificationItem;
    blockers: Blocker[];
    guides: GuideSentRecord[];
    callSessions: CallSession[];
    audit: AuditEntry[];
    isTestRecord?: boolean | undefined;
    testPurpose?: string | undefined;
    accountContext?: string | undefined;
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

  // Client 1 — Northwind Dental: In Progress.
  // Google + GBP connected. Facebook & Instagram NOT checked.
  // Practical tasks: staff demonstrated on call, but client did NOT do them yet.
  const c1Access = makeAccessChecks(1, {
    0: { checked: true, verifiedAt: nowISO(3), verifier: "Avery Chen", resultNote: "Observed Dr Lena sign into mobile app via magic link." },
    1: { checked: true, verifiedAt: nowISO(3), verifier: "Avery Chen", resultNote: "Subaccount Northwind Dental selected." },
  });
  const c1Connections = makeConnections(1, {
    0: { status: "connected", verifiedAt: nowISO(3), verifier: "Avery Chen", notes: "Google account OAuth connected." },
    1: { status: "connected", verifiedAt: nowISO(3), verifier: "Avery Chen", notes: "GBP listing linked; review destination confirmed." },
    2: { status: "not_checked" }, // Facebook not checked
    3: { status: "blocked", notes: "Instagram credentials needed" },
  });
  const c1Tasks = makeTasks(1, {
    0: { status: "demonstrated_by_staff", audit: [audit(1, nowISO(3), "Avery Chen", "Search existing contact", "Not started", "Demonstrated by staff", "Walked client through on screen share")] },
    1: { status: "demonstrated_by_staff", audit: [audit(2, nowISO(3), "Avery Chen", "Add contact", "Not started", "Demonstrated by staff", "Showed contact form")] },
  });
  const c1StaffVer: StaffVerificationItem = {
    id: "sv-1",
    label: "Staff checks recorded result in LSP",
    status: "not_checked",
    audit: [],
  };
  const c1 = makeClient(1, {
    businessName: "Northwind Dental",
    clientName: "Dr. Lena Okafor",
    ghlLocationId: "loc_northwind_8842",
    ghlLink: "https://app.example.com/locations/loc_northwind_8842",
    assignedTeamMember: "Avery Chen",
    callDate: dateISO(3),
    plan: "Digital Essentials — GBP & Web Management ($500/mo)",
    overallStatus: "in_progress",
    notes: "Client observed demo on Zoom; needs to complete practical steps themselves during next call.",
    nextCallDate: dateISO(-3),
    accessChecks: c1Access,
    connections: c1Connections,
    tasks: c1Tasks,
    staffVerification: c1StaffVer,
    blockers: [
      {
        id: "blk-1-1",
        summary: "Facebook page & Instagram not yet linked — client needs admin access",
        owner: "Jordan Patel",
        nextAction: "Send client Meta Business Manager guide & request FB admin invite",
        dueDate: dateISO(-2),
        createdAt: nowISO(3),
        resolved: false,
        audit: [audit(3, nowISO(3), "Avery Chen", "Blocker created", "", "Open", "Meta access pending")],
      },
    ],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: true, sentAt: nowISO(3), channel: "email", sentBy: "Avery Chen", suppliedUrlOrVersion: "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ", notes: "Emailed onboarding hub link.", audit: [audit(4, nowISO(3), "Avery Chen", "Guide sent", "Not sent", "Sent", "Emailed")] },
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
    ],
    callSessions: [
      { id: "call-1-1", clientId: "client-1", date: dateISO(3), staffMember: "Avery Chen", notes: "Initial onboarding session. Google & GBP linked. Staff demonstrated phone app search and contact add. Facebook/Instagram pending.", createdAt: nowISO(3) },
    ],
    audit: [audit(5, nowISO(3), "Avery Chen", "Overall status", "Not started", "In progress", "Initial call completed")],
    createdAt: nowISO(5),
  });

  // Client 2 — Summit Physio: Blocked. Review request sent, but receipt NOT confirmed.
  const c2Access = makeAccessChecks(2, {
    0: { checked: true, verifiedAt: nowISO(5), verifier: "Jordan Patel", resultNote: "Client verified on iPhone app." },
    1: { checked: true, verifiedAt: nowISO(5), verifier: "Jordan Patel", resultNote: "Subaccount Summit Physio confirmed." },
  });
  const c2Connections = makeConnections(2, {
    0: { status: "connected", verifiedAt: nowISO(5), verifier: "Jordan Patel", notes: "Google account connected." },
    1: { status: "connected", verifiedAt: nowISO(5), verifier: "Jordan Patel", notes: "GBP listing verified." },
    2: { status: "connected", verifiedAt: nowISO(5), verifier: "Jordan Patel", notes: "FB business page linked." },
    3: { status: "not_applicable", notApplicableReason: "Client does not operate an Instagram business account.", acknowledgedByReviewer: true, verifiedAt: nowISO(5), verifier: "Jordan Patel" },
    4: { status: "not_applicable", notApplicableReason: "No custom integrations requested.", acknowledgedByReviewer: true, verifiedAt: nowISO(5), verifier: "Jordan Patel" },
  });
  const c2Tasks = makeTasks(2, {
    0: { status: "client_completed", clientConfirmed: true, evidence: "Client typed 'Marcus' in contact search and identified existing duplicates.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(6, nowISO(5), "Jordan Patel", "Search contact", "Not started", "Client completed", "Client verified")] },
    1: { status: "client_completed", clientConfirmed: true, evidence: "Client added test contact 'Sarah Miller - Test' with phone 0400000000.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(7, nowISO(5), "Jordan Patel", "Add contact", "Not started", "Client completed", "Client verified")] },
    2: { status: "client_completed", clientConfirmed: true, evidence: "Client navigated back to contact list and opened Sarah Miller.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(8, nowISO(5), "Jordan Patel", "Locate contact", "Not started", "Client completed", "Client verified")] },
    3: { status: "client_completed", clientConfirmed: true, evidence: "Client tapped 'Send Review Request' button from contact record.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(9, nowISO(5), "Jordan Patel", "Open review feature", "Not started", "Client completed", "Client verified")] },
    4: { status: "client_completed", clientConfirmed: true, evidence: "Client verified SMS copy and Google review link in preview drawer.", completedBy: "Jordan Patel", completedAt: nowISO(5), audit: [audit(10, nowISO(5), "Jordan Patel", "Select recipient & preview", "Not started", "Client completed", "Client verified")] },
    5: { status: "client_completed", clientConfirmed: true, evidence: "Client tapped Send. SMS sent to agreed test number. Review outcome recorded as 'sent'.", completedBy: "Jordan Patel", completedAt: nowISO(5), reviewOutcome: "sent", audit: [audit(11, nowISO(5), "Jordan Patel", "Send review request", "Not started", "Client completed", "Sent recorded")] },
  });
  const c2StaffVer: StaffVerificationItem = {
    id: "sv-2",
    label: "Staff checks recorded result in LSP",
    status: "blocked",
    verifier: "Jordan Patel",
    resultNote: "Staff checked conversations: message shows as Sent, but recipient has not confirmed receipt yet.",
    reviewOutcome: "sent",
    audit: [audit(12, nowISO(5), "Jordan Patel", "Staff verification", "Not checked", "Blocked", "Waiting on delivery/receipt confirmation")],
  };
  const c2 = makeClient(2, {
    businessName: "Summit Physio",
    clientName: "Marcus Bell",
    ghlLocationId: "loc_summit_2210",
    ghlLink: "https://app.example.com/locations/loc_summit_2210",
    assignedTeamMember: "Jordan Patel",
    callDate: dateISO(5),
    plan: "Digital Essentials — GBP & Web Management ($500/mo)",
    overallStatus: "blocked",
    notes: "Review SMS was Sent by client, but receipt is not confirmed by recipient yet. Blocker open.",
    nextCallDate: dateISO(-1),
    accessChecks: c2Access,
    connections: c2Connections,
    tasks: c2Tasks,
    staffVerification: c2StaffVer,
    blockers: [
      {
        id: "blk-2-1",
        summary: "SMS gateway delivery delayed — review request Sent but Receipt not confirmed",
        owner: "Jordan Patel",
        nextAction: "Call recipient to confirm SMS arrived; verify review link opens GBP review dialog",
        dueDate: dateISO(-1),
        createdAt: nowISO(5),
        resolved: false,
        audit: [audit(13, nowISO(5), "Jordan Patel", "Blocker created", "", "Open", "Receipt confirmation pending")],
      },
    ],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: true, sentAt: nowISO(5), channel: "email", sentBy: "Jordan Patel", suppliedUrlOrVersion: "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ", notes: "Provided on onboarding call.", audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
    ],
    callSessions: [
      { id: "call-2-1", clientId: "client-2", date: dateISO(5), staffMember: "Jordan Patel", notes: "Full onboarding call. Client executed all 6 practical tasks. SMS sent. Waiting on delivery confirmation.", createdAt: nowISO(5) },
    ],
    audit: [audit(14, nowISO(5), "Jordan Patel", "Overall status", "In progress", "Blocked", "Pending receipt confirmation")],
    createdAt: nowISO(7),
  });

  // Client 3 — Harbor Coffee Roasters: Fully COMPLETED!
  // All access checks, all required connections verified, N/A acknowledged with reasons,
  // all client practical tasks completed with evidence, staff verification verified with receipt_confirmed.
  const c3Access = makeAccessChecks(3, {
    0: { checked: true, verifiedAt: nowISO(10), verifier: "Sam Rivera", resultNote: "Priya logged into phone app." },
    1: { checked: true, verifiedAt: nowISO(10), verifier: "Sam Rivera", resultNote: "Harbor Coffee Roasters location selected." },
  });
  const c3Connections = makeConnections(3, {
    0: { status: "connected", verifiedAt: nowISO(10), verifier: "Sam Rivera", notes: "OAuth active." },
    1: { status: "connected", verifiedAt: nowISO(10), verifier: "Sam Rivera", notes: "Google Business Profile linked to primary store." },
    2: { status: "connected", verifiedAt: nowISO(10), verifier: "Sam Rivera", notes: "FB Business Page connected with manage permissions." },
    3: { status: "not_applicable", notApplicableReason: "Client does not have an Instagram handle.", acknowledgedByReviewer: true, verifiedAt: nowISO(10), verifier: "Sam Rivera" },
    4: { status: "not_applicable", notApplicableReason: "No additional 3rd party tools agreed.", acknowledgedByReviewer: true, verifiedAt: nowISO(10), verifier: "Sam Rivera" },
  });
  const c3Tasks = makeTasks(3, {
    0: { status: "client_completed", clientConfirmed: true, evidence: "Client executed search for 'Liam' to ensure no duplication.", completedBy: "Sam Rivera", completedAt: nowISO(10), audit: [] },
    1: { status: "client_completed", clientConfirmed: true, evidence: "Client entered test customer details and saved contact.", completedBy: "Sam Rivera", completedAt: nowISO(10), audit: [] },
    2: { status: "client_completed", clientConfirmed: true, evidence: "Client pulled up newly created contact in app contact view.", completedBy: "Sam Rivera", completedAt: nowISO(10), audit: [] },
    3: { status: "client_completed", clientConfirmed: true, evidence: "Client initiated review request flow.", completedBy: "Sam Rivera", completedAt: nowISO(10), audit: [] },
    4: { status: "client_completed", clientConfirmed: true, evidence: "Client inspected review text and recipient mobile number.", completedBy: "Sam Rivera", completedAt: nowISO(10), audit: [] },
    5: { status: "client_completed", clientConfirmed: true, evidence: "Client tapped send button. Sent message reflected immediately in conversation.", completedBy: "Sam Rivera", completedAt: nowISO(10), reviewOutcome: "sent", audit: [] },
  });
  const c3StaffVer: StaffVerificationItem = {
    id: "sv-3",
    label: "Staff checks recorded result in LSP",
    status: "verified",
    verifier: "Sam Rivera",
    verifiedAt: nowISO(10),
    reviewOutcome: "receipt_confirmed",
    resultNote: "Staff reviewed conversation thread: delivered timestamp present, recipient clicked review link and verified GBP destination.",
    audit: [audit(15, nowISO(10), "Sam Rivera", "Staff verification", "Not checked", "Verified", "Receipt confirmed on call")],
  };
  const c3 = makeClient(3, {
    businessName: "Harbor Coffee Roasters",
    clientName: "Priya Nair",
    assignedTeamMember: "Sam Rivera",
    callDate: dateISO(10),
    plan: "Digital Essentials — GBP & Web Management ($500/mo)",
    overallStatus: "completed",
    notes: "Client successfully demonstrated all skills. Review request confirmed delivered and opened.",
    nextCallDate: dateISO(-30),
    accessChecks: c3Access,
    connections: c3Connections,
    tasks: c3Tasks,
    staffVerification: c3StaffVer,
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: true, sentAt: nowISO(10), channel: "email", sentBy: "Sam Rivera", suppliedUrlOrVersion: "https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ", notes: "Sent guide pack.", audit: [] },
      // CORRECTION: the add-lead and send-review guides previously had no URL
      // but were marked "Sent" with "Guide link not added (verbal walkthrough)".
      // That was incorrect — a verbal walkthrough is NOT a sent guide. They are
      // now recorded as verbal walkthroughs (separate) and remain outstanding
      // required guides until real URLs are supplied.
      {
        guideId: DEFAULT_GUIDE_IDS.addLead,
        sent: false,
        walkthroughProvided: true,
        walkthroughAt: nowISO(10),
        walkthroughBy: "Sam Rivera",
        walkthroughNotes: "Walked through adding a lead verbally on the call (not a sent guide).",
        audit: [
          audit(901, nowISO(0), "System", "Guide sent", "Sent", "Not sent", "Corrected: verbal walkthrough must not count as a sent guide"),
          audit(902, nowISO(0), "System", "Verbal walkthrough", "", "Provided", "Migrated from invalid sent-guide record"),
        ],
      },
      {
        guideId: DEFAULT_GUIDE_IDS.sendReview,
        sent: false,
        walkthroughProvided: true,
        walkthroughAt: nowISO(10),
        walkthroughBy: "Sam Rivera",
        walkthroughNotes: "Walked through sending a review request verbally on the call (not a sent guide).",
        audit: [
          audit(903, nowISO(0), "System", "Guide sent", "Sent", "Not sent", "Corrected: verbal walkthrough must not count as a sent guide"),
          audit(904, nowISO(0), "System", "Verbal walkthrough", "", "Provided", "Migrated from invalid sent-guide record"),
        ],
      },
    ],
    callSessions: [
      { id: "call-3-1", clientId: "client-3", date: dateISO(10), staffMember: "Sam Rivera", notes: "Complete onboarding call. All practical tasks verified. Receipt confirmed.", createdAt: nowISO(10) },
    ],
    audit: [audit(16, nowISO(10), "Sam Rivera", "Overall status", "In progress", "Completed", "Full onboarding requirements verified")],
    createdAt: nowISO(12),
  });

  // Client 4 — Cedar & Stone Salon: Not started.
  const c4 = makeClient(4, {
    businessName: "Cedar & Stone Salon",
    clientName: "Tom Whitfield",
    assignedTeamMember: "Avery Chen",
    callDate: dateISO(-1),
    plan: "Digital Essentials — GBP & Web Management ($500/mo)",
    overallStatus: "not_started",
    notes: "Call scheduled for tomorrow 10am.",
    accessChecks: makeAccessChecks(4, {}),
    connections: makeConnections(4, {}),
    tasks: makeTasks(4, {}),
    staffVerification: {
      id: "sv-4",
      label: "Staff checks recorded result in LSP",
      status: "not_checked",
      audit: [],
    },
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
    ],
    callSessions: [],
    audit: [],
    createdAt: nowISO(1),
  });

  // Internal test records (RECORD A & B) — clearly labelled, never pre-completed.
  // These are for practicing the onboarding call flow, NOT completed onboarding examples.
  // Nathaniel and Jay swap roles so each experiences both the client and observer side.
  const c5 = makeClient(5, {
    businessName: "LSP Trial — Onboarding Test",
    clientName: "Nathaniel",
    ghlLocationId: undefined,
    ghlLink: undefined,
    assignedTeamMember: "Jay",
    callDate: dateISO(0),
    plan: "",
    overallStatus: "not_started",
    notes: "Internal test record. Nathaniel performs the client-side tasks while Jay observes and records evidence.",
    accessChecks: makeAccessChecks(5, {}),
    connections: makeConnections(5, {}),
    tasks: makeTasks(5, {}),
    staffVerification: {
      id: "sv-5",
      label: "Staff checks recorded result in LSP",
      status: "not_checked",
      audit: [],
    },
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
    ],
    callSessions: [],
    audit: [],
    isTestRecord: true,
    testPurpose: "Nathaniel performs the client-side tasks while Jay observes and records evidence.",
    accountContext: "LSP Trial subaccount",
    createdAt: nowISO(0),
  });

  const c6 = makeClient(6, {
    businessName: "LSP Main — Onboarding Test",
    clientName: "Jay",
    ghlLocationId: undefined,
    ghlLink: undefined,
    assignedTeamMember: "Nathaniel",
    callDate: dateISO(0),
    plan: "",
    overallStatus: "not_started",
    notes: "Internal test record. Jay performs the client-side tasks while Nathaniel observes and records evidence.",
    accessChecks: makeAccessChecks(6, {}),
    connections: makeConnections(6, {}),
    tasks: makeTasks(6, {}),
    staffVerification: {
      id: "sv-6",
      label: "Staff checks recorded result in LSP",
      status: "not_checked",
      audit: [],
    },
    blockers: [],
    guides: [
      { guideId: DEFAULT_GUIDE_IDS.onboardingHub, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.addLead, sent: false, audit: [] },
      { guideId: DEFAULT_GUIDE_IDS.sendReview, sent: false, audit: [] },
    ],
    callSessions: [],
    audit: [],
    isTestRecord: true,
    testPurpose: "Jay performs the client-side tasks while Nathaniel observes and records evidence.",
    accountContext: "LSP Main subaccount",
    createdAt: nowISO(0),
  });

  return { clients: [c1, c2, c3, c4, c5, c6], settings };
}
