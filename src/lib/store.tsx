import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from "react";
import type {
  AppState,
  Client,
  Call,
  CallItem,
  CallGuideRecord,
  Settings,
  GuideLink,
  TeamMember,
  ChecklistTemplate,
  TemplateItem,
  AuditEntry,
  CallType,
  ItemStatus,
  GuideChannel,
  ReviewOutcome,
} from "./types";
import { seedState, buildCallItems, buildCallGuides } from "./seed";
import { DEFAULT_CONNECTION_ITEMS, DEFAULT_ONBOARDING_ITEMS } from "./types";

let counter = 2000;
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
  return [...arr, { id: nextId("aud"), at: ts(), actor, field, from, to, reason }];
}

interface StoreApi {
  state: AppState;
  // Clients
  addClient: (input: NewClientInput) => string;
  updateClient: (
    id: string,
    patch: Partial<Omit<Client, "id" | "calls" | "audit">>,
    actor: string,
    reason?: string,
  ) => void;
  deleteClient: (id: string) => void;
  // Calls
  startCall: (clientId: string, type: CallType, staffMember: string, date?: string) => string;
  updateCall: (clientId: string, callId: string, patch: Partial<Call>, actor: string) => void;
  finishCall: (clientId: string, callId: string, patch: Partial<Call>, actor: string) => void;
  // Session-only save. State already lives in React memory; this simulates a
  // commit so the UI can show honest saving/saved/error feedback. It does NOT
  // persist across reloads or share records between browsers/staff.
  saveProgress: () => Promise<void>;
  // Call items
  setCallItem: (
    clientId: string,
    callId: string,
    itemId: string,
    patch: Partial<CallItem>,
    actor: string,
    reason?: string,
  ) => void;
  // Call guides
  setCallGuide: (
    clientId: string,
    callId: string,
    guideId: string,
    patch: Partial<CallGuideRecord>,
    actor: string,
    reason?: string,
  ) => void;
  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
  addGuide: (label: string, url?: string) => void;
  updateGuide: (id: string, patch: Partial<GuideLink>) => void;
  updateGuideLink: (id: string, patch: Partial<GuideLink>) => void;
  removeGuide: (id: string) => void;
  addTeamMember: (name: string) => void;
  removeTeamMember: (id: string) => void;
  // Templates
  addTemplateItem: (
    templateId: string,
    label: string,
    kind: TemplateItem["kind"],
    required: boolean,
  ) => void;
  updateTemplateItem: (templateId: string, itemId: string, patch: Partial<TemplateItem>) => void;
  removeTemplateItem: (templateId: string, itemId: string) => void;
  reorderTemplateItem: (templateId: string, itemId: string, dir: -1 | 1) => void;
  updateTemplate: (id: string, patch: Partial<ChecklistTemplate>) => void;
  reset: () => void;
}

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

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedState());

  const updateClient = useCallback(
    (
      id: string,
      patch: Partial<Omit<Client, "id" | "calls" | "audit">>,
      actor: string,
      reason?: string,
    ) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch, id, updatedAt: ts() } : c)),
      }));
      void actor;
      void reason;
    },
    [],
  );

  const addClient = useCallback((input: NewClientInput) => {
    const id = nextId("client");
    const now = ts();
    const client: Client = {
      id,
      businessName: input.businessName,
      clientName: input.clientName,
      assignedTeamMember: input.assignedTeamMember,
      contactDetails: input.contactDetails,
      ghlLink: input.ghlLink,
      notes: input.notes,
      nextCallType: input.callType,
      nextCallDate: input.callDate,
      calls: [],
      isTestRecord: input.isTestRecord,
      testPurpose: input.testPurpose,
      accountContext: input.accountContext,
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({ ...s, clients: [...s.clients, client] }));
    return id;
  }, []);

  const deleteClient = useCallback((id: string) => {
    setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
  }, []);

  const startCall = useCallback(
    (clientId: string, type: CallType, staffMember: string, date?: string) => {
      const id = nextId("call");
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          const tpl = s.settings.templates.find((t) => t.callType === type);
          const items = tpl ? buildCallItems(tpl) : [];
          // Guides only apply to onboarding calls (the connection template has
          // no guide-derived item). Avoid attaching meaningless guide records
          // (and therefore bogus completion blockers) to connection calls.
          const guides = type === "onboarding" ? buildCallGuides(s.settings.guides) : [];
          const call: Call = {
            id,
            clientId,
            type,
            date: date ?? new Date().toISOString().slice(0, 10),
            staffMember,
            items,
            guides,
            createdAt: ts(),
            updatedAt: ts(),
          };
          return { ...c, updatedAt: ts(), calls: [...c.calls, call] };
        }),
      }));
      return id;
    },
    [],
  );

  const updateCall = useCallback(
    (clientId: string, callId: string, patch: Partial<Call>, actor: string) => {
      void actor;
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) =>
          c.id !== clientId
            ? c
            : {
                ...c,
                updatedAt: ts(),
                calls: c.calls.map((call) =>
                  call.id === callId ? { ...call, ...patch, updatedAt: ts() } : call,
                ),
              },
        ),
      }));
    },
    [],
  );

  const finishCall = useCallback(
    (clientId: string, callId: string, patch: Partial<Call>, actor: string) => {
      void actor;
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) =>
          c.id !== clientId
            ? c
            : {
                ...c,
                updatedAt: ts(),
                calls: c.calls.map((call) =>
                  call.id === callId
                    ? { ...call, ...patch, finishedAt: ts(), updatedAt: ts() }
                    : call,
                ),
              },
        ),
      }));
    },
    [],
  );

  const saveProgress = useCallback(async (): Promise<void> => {
    // Session-only: state is already held in React memory. Simulate a commit
    // so the UI can show honest saving/saved/error feedback. This does NOT
    // persist across reloads or share records between browsers/staff.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, []);

  const setCallItem = useCallback(
    (
      clientId: string,
      callId: string,
      itemId: string,
      patch: Partial<CallItem>,
      actor: string,
      reason?: string,
    ) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            calls: c.calls.map((call) => {
              if (call.id !== callId) return call;
              return {
                ...call,
                updatedAt: ts(),
                items: call.items.map((it) => {
                  if (it.id !== itemId) return it;
                  const from = it.status;
                  const next: CallItem = { ...it, ...patch };
                  let audited = it.audit;
                  if (patch.status && patch.status !== from) {
                    audited = pushAudit(
                      audited,
                      actor,
                      `Item: ${it.label}`,
                      from,
                      patch.status,
                      reason ?? "",
                    );
                  }
                  if (
                    patch.staffDemonstrated !== undefined &&
                    patch.staffDemonstrated !== it.staffDemonstrated
                  ) {
                    audited = pushAudit(
                      audited,
                      actor,
                      `Item: ${it.label} (staff demonstrated)`,
                      it.staffDemonstrated ? "Demonstrated" : "Not demonstrated",
                      patch.staffDemonstrated ? "Demonstrated" : "Not demonstrated",
                      reason ?? "Staff demonstration recorded",
                    );
                  }
                  if (audited.length === it.audit.length && reason) {
                    audited = pushAudit(audited, actor, `Item: ${it.label}`, from, from, reason);
                  }
                  next.audit = audited;
                  return next;
                }),
              };
            }),
          };
        }),
      }));
    },
    [],
  );

  const setCallGuide = useCallback(
    (
      clientId: string,
      callId: string,
      guideId: string,
      patch: Partial<CallGuideRecord>,
      actor: string,
      reason?: string,
    ) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            updatedAt: ts(),
            calls: c.calls.map((call) => {
              if (call.id !== callId) return call;
              return {
                ...call,
                updatedAt: ts(),
                guides: call.guides.map((g) => {
                  if (g.guideId !== guideId) return g;
                  const fromSent = g.sent ? "Sent" : "Not sent";
                  const fromWalk = g.walkthroughProvided ? "Walkthrough" : "No walkthrough";
                  const next: CallGuideRecord = { ...g, ...patch };
                  const logs: AuditEntry[] = [...g.audit];
                  if (patch.sent !== undefined && patch.sent !== g.sent) {
                    logs.push({
                      id: nextId("aud"),
                      at: ts(),
                      actor,
                      field: `Guide: ${guideId} (sent)`,
                      from: fromSent,
                      to: patch.sent ? "Sent" : "Not sent",
                      reason: reason ?? "Guide send recorded",
                    });
                  }
                  if (
                    patch.walkthroughProvided !== undefined &&
                    patch.walkthroughProvided !== g.walkthroughProvided
                  ) {
                    logs.push({
                      id: nextId("aud"),
                      at: ts(),
                      actor,
                      field: `Guide: ${guideId} (walkthrough)`,
                      from: fromWalk,
                      to: patch.walkthroughProvided ? "Walkthrough" : "No walkthrough",
                      reason: reason ?? "Verbal walkthrough recorded",
                    });
                  }
                  if (logs.length === g.audit.length && reason) {
                    logs.push({
                      id: nextId("aud"),
                      at: ts(),
                      actor,
                      field: `Guide: ${guideId}`,
                      from: fromSent,
                      to: fromSent,
                      reason,
                    });
                  }
                  next.audit = logs;
                  return next;
                }),
              };
            }),
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
      settings: {
        ...s.settings,
        guides: [...s.settings.guides, { id: nextId("guide"), label, url }],
      },
    }));
  }, []);

  const updateGuide = useCallback((id: string, patch: Partial<GuideLink>) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        guides: s.settings.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      },
    }));
  }, []);

  // Alias used by the call screen's "Add/Edit Resource" flow — updates the
  // configured guide link (URL or document title+version) for all calls.
  const updateGuideLink = useCallback((id: string, patch: Partial<GuideLink>) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        guides: s.settings.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      },
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

  const addTemplateItem = useCallback(
    (templateId: string, label: string, kind: TemplateItem["kind"], required: boolean) => {
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          templates: s.settings.templates.map((t) =>
            t.id === templateId
              ? { ...t, items: [...t.items, { id: nextId("ti"), label, kind, required }] }
              : t,
          ),
        },
      }));
    },
    [],
  );

  const updateTemplateItem = useCallback(
    (templateId: string, itemId: string, patch: Partial<TemplateItem>) => {
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          templates: s.settings.templates.map((t) =>
            t.id === templateId
              ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
              : t,
          ),
        },
      }));
    },
    [],
  );

  const removeTemplateItem = useCallback((templateId: string, itemId: string) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        templates: s.settings.templates.map((t) =>
          t.id === templateId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t,
        ),
      },
    }));
  }, []);

  const reorderTemplateItem = useCallback((templateId: string, itemId: string, dir: -1 | 1) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        templates: s.settings.templates.map((t) => {
          if (t.id !== templateId) return t;
          const idx = t.items.findIndex((i) => i.id === itemId);
          if (idx < 0) return t;
          const ni = idx + dir;
          if (ni < 0 || ni >= t.items.length) return t;
          const items = [...t.items];
          const moved = items[idx];
          if (!moved) return t;
          items.splice(idx, 1);
          items.splice(ni, 0, moved);
          return { ...t, items };
        }),
      },
    }));
  }, []);

  const updateTemplate = useCallback((id: string, patch: Partial<ChecklistTemplate>) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        templates: s.settings.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }));
  }, []);

  const reset = useCallback(() => setState(seedState()), []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      addClient,
      updateClient,
      deleteClient,
      startCall,
      updateCall,
      finishCall,
      saveProgress,
      setCallItem,
      setCallGuide,
      updateSettings,
      addGuide,
      updateGuide,
      updateGuideLink,
      removeGuide,
      addTeamMember,
      removeTeamMember,
      addTemplateItem,
      updateTemplateItem,
      removeTemplateItem,
      reorderTemplateItem,
      updateTemplate,
      reset,
    }),
    [
      state,
      addClient,
      updateClient,
      deleteClient,
      startCall,
      updateCall,
      finishCall,
      saveProgress,
      setCallItem,
      setCallGuide,
      updateSettings,
      addGuide,
      updateGuide,
      updateGuideLink,
      removeGuide,
      addTeamMember,
      removeTeamMember,
      addTemplateItem,
      updateTemplateItem,
      removeTemplateItem,
      reorderTemplateItem,
      updateTemplate,
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

export function useAppState(): AppState {
  return useStore().state;
}

export type { CallType, ItemStatus, GuideChannel, ReviewOutcome };
