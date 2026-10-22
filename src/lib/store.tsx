// Cloud-backed store for the LSP Onboarding Checklist.
//
// All state is loaded from the Cloud database via server functions and
// persisted back through them. The in-memory React state is an optimistic
// cache of the database — mutations update local state synchronously (so the
// UI and navigation stay responsive) and fire DB writes in the background.
// On write failure, we reload from the DB to reconcile. Save Progress and
// Finish Call await successful database writes before showing success.
//
// Auth is handled by AuthProvider (src/lib/auth.tsx). This store is only
// mounted for authenticated, approved staff. The "Acting as" staff selector
// on the call screen is for assigning the observing staff member — it is NOT
// authentication.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import type { AppState, Settings } from "./types";
import { getState } from "./api.functions";
import { useStoreActions } from "./store-mutations";

const EMPTY_STATE: AppState = {
  clients: [],
  settings: { guides: [], team: [], templates: [] },
};

export interface StoreApi {
  state: AppState;
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  addClient: (input: import("./store-types").NewClientInput) => string;
  updateClient: (
    id: string,
    patch: Partial<import("./types").Client>,
    actor?: string,
    reason?: string,
  ) => void;
  deleteClient: (id: string) => void;
  startCall: (
    clientId: string,
    type: import("./types").CallType,
    staffMember: string,
    date?: string,
  ) => string;
  updateCall: (
    clientId: string,
    callId: string,
    patch: Partial<import("./types").Call>,
    actor?: string,
  ) => void;
  finishCall: (
    clientId: string,
    callId: string,
    patch: Partial<import("./types").Call>,
    actor?: string,
  ) => Promise<{ ok: boolean; emailError?: string | undefined }>;
  saveProgress: () => Promise<void>;
  sendProgressEmail: (callId: string) => Promise<{ ok: boolean; emailError?: string | undefined }>;
  setCallItem: (
    clientId: string,
    callId: string,
    itemId: string,
    patch: Partial<import("./types").CallItem>,
    actor?: string,
    reason?: string,
  ) => void;
  setCallGuide: (
    clientId: string,
    callId: string,
    guideId: string,
    patch: Partial<import("./types").CallGuideRecord>,
    actor?: string,
    reason?: string,
  ) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateGuide: (id: string, patch: Partial<import("./types").GuideLink>) => void;
  updateGuideLink: (id: string, patch: Partial<import("./types").GuideLink>) => void;
  addGuide: (label: string, url?: string) => void;
  removeGuide: (id: string) => void;
  addTeamMember: (name: string) => void;
  removeTeamMember: (id: string) => void;
  addTemplateItem: (
    templateId: string,
    label: string,
    kind: import("./types").TemplateItem["kind"],
    required: boolean,
  ) => void;
  updateTemplateItem: (
    templateId: string,
    itemId: string,
    patch: Partial<import("./types").TemplateItem>,
  ) => void;
  removeTemplateItem: (templateId: string, itemId: string) => void;
  reorderTemplateItem: (templateId: string, itemId: string, dir: -1 | 1) => void;
  updateTemplate: (id: string, patch: Partial<import("./types").ChecklistTemplate>) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const _getState = useServerFn(getState);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await _getState();
      setState({
        clients: data.clients,
        settings: { guides: data.guides, team: data.team, templates: data.templates },
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [_getState]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const actions = useStoreActions(state, setState, reload);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      loading,
      loadError,
      reload,
      ...actions,
    }),
    [state, loading, loadError, reload, actions],
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

export type { CallType } from "./types";
export type { NewClientInput } from "./store-types";