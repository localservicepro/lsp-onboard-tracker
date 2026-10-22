import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from "react";
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
  ConnectionStatus,
  TaskStatus,
  ReviewOutcome,
  GuideChannel,
} from "./types";
import { seedState } from "./seed";
import { DEFAULT_CONNECTION_LABELS, DEFAULT_TASK_LABELS } from "./types";

let counter = 1000;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function ts(): string {
  return new Date().toISOString();
}

function pushAudit(
  arr: AuditEntry[],
  actor: string,
  field: string,
  from: string,
  to: string,
  reason: string,
): AuditEntry[] {
  return [
    ...arr,
    { id: nextId("aud"), at: ts(), actor, field, from, to, reason },
  ];
}

interface StoreApi {
  state: AppState;
  // Clients
  addClient: (input: NewClientInput) => string;
  updateClient: (id: string, patch: Partial<Omit<Client, "id" | "audit">>, actor: string, reason?: string) => void;
  deleteClient: (id: string) => void;
  // Connections
  setConnection: (clientId: string, connId: string, patch: Partial<ConnectionItem>, actor: string, reason?: string) => void;
  // Tasks
  setTask: (clientId: string, taskId: string, patch: Partial<TaskItem>, actor: string, reason?: string) => void;
  // Blockers
  addBlocker: (clientId: string, input: NewBlockerInput, actor: string) => void;
  updateBlocker: (clientId: string, blockerId: string, patch: Partial<Blocker>, actor: string, reason?: string) => void;
  // Guides
  setGuide: (clientId: string, guideId: string, patch: Partial<GuideSentRecord>, actor: string, reason?: string) => void;
  // Call sessions
  addCallSession: (clientId: string, input: NewCallInput, actor: string) => string;
  updateCallSession: (clientId: string, callId: string, patch: Partial<CallSession>, actor: string) => void;
  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
  addGuide: (label: string, url?: string) => void;
  updateGuide: (id: string, patch: Partial<GuideLink>) => void;
  removeGuide: (id: string) => void;
  addTeamMember: (name: string) => void;
  removeTeamMember: (id: string) => void;
  addTemplate: (name: string, description?: string) => void;
  updateTemplate: (id: string, patch: Partial<ChecklistTemplate>) => void;
  removeTemplate: (id: string) => void;
  reset: () => void;
}

export interface NewClientInput {
  businessName: string;
  clientName: string;
  ghlLocationId?: string | undefined;
  ghlLink?: string | undefined;
  assignedTeamMember: string;
  callDate: string;
  plan: string;
  notes?: string | undefined;
  nextCallDate?: string | undefined;
}

export interface NewBlockerInput {
  summary: string;
  owner: string;
  nextAction: string;
}

export interface NewCallInput {
  date: string;
  staffMember: string;
  notes?: string | undefined;
  summary?: string | undefined;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedState());

  const updateClient = useCallback(
    (id: string, patch: Partial<Omit<Client, "id" | "audit">>, actor: string, reason?: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== id) return c;
          const next: Client = { ...c, ...patch, id: c.id, updatedAt: ts() };
          if (patch.overallStatus && patch.overallStatus !== c.overallStatus) {
            next.audit = pushAudit(c.audit, actor, "Overall status", c.overallStatus, patch.overallStatus, reason ?? "");
          }
          return next;
        }),
      }));
    },
    [],
  );

  const addClient = useCallback((input: NewClientInput) => {
    const id = nextId("client");
    const now = ts();
    const connections: ConnectionItem[] = DEFAULT_CONNECTION_LABELS.map((label, i) => ({
      id: `conn-${id}-${i}`,
      label,
      status: "not_checked",
      audit: [],
    }));
    const tasks: TaskItem[] = DEFAULT_TASK_LABELS.map((label, i) => ({
      id: `task-${id}-${i}`,
      label,
      status: "not_started",
      audit: [],
    }));
    const guides: GuideSentRecord[] = state.settings.guides.map((g) => ({
      guideId: g.id,
      sent: false,
      audit: [],
    }));
    const client: Client = {
      id,
      businessName: input.businessName,
      clientName: input.clientName,
      ghlLocationId: input.ghlLocationId,
      ghlLink: input.ghlLink,
      assignedTeamMember: input.assignedTeamMember,
      callDate: input.callDate,
      plan: input.plan,
      overallStatus: "not_started",
      notes: input.notes,
      nextCallDate: input.nextCallDate,
      connections,
      tasks,
      blockers: [],
      guides,
      callSessions: [],
      audit: [],
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({ ...s, clients: [...s.clients, client] }));
    return id;
  }, [state.settings.guides]);

  const deleteClient = useCallback((id: string) => {
    setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
  }, []);

  const setConnection = useCallback(
    (clientId: string, connId: string, patch: Partial<ConnectionItem>, actor: string, reason?: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            connections: c.connections.map((conn) => {
              if (conn.id !== connId) return conn;
              const from = conn.status;
              const next: ConnectionItem = { ...conn, ...patch };
              if (patch.status && patch.status !== from) {
                next.audit = pushAudit(conn.audit, actor, `Connection: ${conn.label}`, from, patch.status, reason ?? "");
              } else if (reason) {
                next.audit = pushAudit(conn.audit, actor, `Connection: ${conn.label}`, from, from, reason);
              }
              return next;
            }),
          };
        }),
      }));
    },
    [],
  );

  const setTask = useCallback(
    (clientId: string, taskId: string, patch: Partial<TaskItem>, actor: string, reason?: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            tasks: c.tasks.map((t) => {
              if (t.id !== taskId) return t;
              const from = t.status;
              const next: TaskItem = { ...t, ...patch };
              if (patch.status && patch.status !== from) {
                next.audit = pushAudit(t.audit, actor, `Task: ${t.label}`, from, patch.status, reason ?? "");
              } else if (reason) {
                next.audit = pushAudit(t.audit, actor, `Task: ${t.label}`, from, from, reason);
              }
              return next;
            }),
          };
        }),
      }));
    },
    [],
  );

  const addBlocker = useCallback(
    (clientId: string, input: NewBlockerInput, actor: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          const blocker: Blocker = {
            id: nextId("blk"),
            summary: input.summary,
            owner: input.owner,
            nextAction: input.nextAction,
            createdAt: ts(),
            resolved: false,
            audit: [{ id: nextId("aud"), at: ts(), actor, field: "Blocker created", from: "", to: "Open", reason: input.summary }],
          };
          return { ...c, updatedAt: ts(), blockers: [...c.blockers, blocker] };
        }),
      }));
    },
    [],
  );

  const updateBlocker = useCallback(
    (clientId: string, blockerId: string, patch: Partial<Blocker>, actor: string, reason?: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            blockers: c.blockers.map((b) => {
              if (b.id !== blockerId) return b;
              const next: Blocker = { ...b, ...patch };
              if (patch.resolved !== undefined && patch.resolved !== b.resolved) {
                next.audit = pushAudit(b.audit, actor, "Blocker resolution", String(b.resolved), String(patch.resolved), reason ?? "");
              } else if (reason) {
                next.audit = pushAudit(b.audit, actor, "Blocker updated", "", "", reason);
              }
              if (patch.resolved === true) next.resolvedAt = ts();
              return next;
            }),
          };
        }),
      }));
    },
    [],
  );

  const setGuide = useCallback(
    (clientId: string, guideId: string, patch: Partial<GuideSentRecord>, actor: string, reason?: string) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            guides: c.guides.map((g) => {
              if (g.guideId !== guideId) return g;
              const from = g.sent ? "Sent" : "Not sent";
              const next: GuideSentRecord = { ...g, ...patch };
              if (patch.sent !== undefined && patch.sent !== g.sent) {
                next.audit = pushAudit(g.audit, actor, `Guide: ${guideId}`, from, patch.sent ? "Sent" : "Not sent", reason ?? "Guide send recorded");
              } else if (reason) {
                next.audit = pushAudit(g.audit, actor, `Guide: ${guideId}`, from, from, reason);
              }
              return next;
            }),
          };
        }),
      }));
    },
    [],
  );

  const addCallSession = useCallback(
    (clientId: string, input: NewCallInput, actor: string) => {
      const id = nextId("call");
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          const session: CallSession = {
            id,
            clientId,
            date: input.date,
            staffMember: input.staffMember,
            notes: input.notes,
            summary: input.summary,
            createdAt: ts(),
          };
          return { ...c, updatedAt: ts(), callSessions: [...c.callSessions, session] };
        }),
      }));
      return id;
    },
    [],
  );

  const updateCallSession = useCallback(
    (clientId: string, callId: string, patch: Partial<CallSession>, actor: string) => {
      void actor;
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            callSessions: c.callSessions.map((cs) => (cs.id === callId ? { ...cs, ...patch } : cs)),
          };
        }),
      }));
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const addGuide = useCallback((label: string, url?: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, guides: [...s.settings.guides, { id: nextId("guide"), label, url }] },
    }));
  }, []);

  const updateGuide = useCallback((id: string, patch: Partial<GuideLink>) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, guides: s.settings.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)) },
    }));
  }, []);

  const removeGuide = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, guides: s.settings.guides.filter((g) => g.id !== id) },
    }));
  }, []);

  const addTeamMember = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, team: [...s.settings.team, { id: nextId("tm"), name }] },
    }));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, team: s.settings.team.filter((t) => t.id !== id) },
    }));
  }, []);

  const addTemplate = useCallback((name: string, description?: string) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        templates: [
          ...s.settings.templates,
          { id: nextId("tpl"), name, description, connectionLabels: [...DEFAULT_CONNECTION_LABELS], taskLabels: [...DEFAULT_TASK_LABELS] },
        ],
      },
    }));
  }, []);

  const updateTemplate = useCallback((id: string, patch: Partial<ChecklistTemplate>) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, templates: s.settings.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    }));
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, templates: s.settings.templates.filter((t) => t.id !== id) },
    }));
  }, []);

  const reset = useCallback(() => setState(seedState()), []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      addClient,
      updateClient,
      deleteClient,
      setConnection,
      setTask,
      addBlocker,
      updateBlocker,
      setGuide,
      addCallSession,
      updateCallSession,
      updateSettings,
      addGuide,
      updateGuide,
      removeGuide,
      addTeamMember,
      removeTeamMember,
      addTemplate,
      updateTemplate,
      removeTemplate,
      reset,
    }),
    [
      state,
      addClient,
      updateClient,
      deleteClient,
      setConnection,
      setTask,
      addBlocker,
      updateBlocker,
      setGuide,
      addCallSession,
      updateCallSession,
      updateSettings,
      addGuide,
      updateGuide,
      removeGuide,
      addTeamMember,
      removeTeamMember,
      addTemplate,
      updateTemplate,
      removeTemplate,
      reset,
    ],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Convenience hook returning just the state.
export function useAppState(): AppState {
  return useStore().state;
}

// Re-export status types for action helpers.
export type {
  ConnectionStatus,
  TaskStatus,
  ReviewOutcome,
  GuideChannel,
};