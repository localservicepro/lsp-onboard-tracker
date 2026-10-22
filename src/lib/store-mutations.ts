// Optimistic mutation actions for the Cloud-backed store.
// These are called by StoreProvider; they update local state synchronously
// and fire DB writes via the server functions in the background.

import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import type {
  AppState,
  Client,
  Call,
  CallItem,
  CallGuideRecord,
  GuideLink,
  ChecklistTemplate,
  TemplateItem,
  CallType,
} from "./types";
import { buildCallItems, buildCallGuides } from "./seed";
import {
  getState,
  addClient as addClientFn,
  updateClient as updateClientFn,
  deleteClient as deleteClientFn,
  startCall as startCallFn,
  updateCall as updateCallFn,
  setCallItem as setCallItemFn,
  setCallGuide as setCallGuideFn,
  upsertGuide as upsertGuideFn,
  removeGuide as removeGuideFn,
  addGuide as addGuideFn,
  addTeamMember as addTeamMemberFn,
  removeTeamMember as removeTeamMemberFn,
  addTemplateItem as addTemplateItemFn,
  removeTemplateItem as removeTemplateItemFn,
  upsertTemplateFn,
  upsertTemplateItemFn,
  finishCall as finishCallFn,
  sendProgressUpdate as sendProgressUpdateFn,
} from "./api.functions";
import type { NewClientInput } from "./store-types";
void type NewClientInput;

const nowISO = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type SetState = React.Dispatch<React.SetStateAction<AppState>>;
type Reload = () => Promise<void>;

export function useStoreActions(state: AppState, setState: SetState, reload: Reload) {
  const _getState = useServerFn(getState);
  const _addClient = useServerFn(addClientFn);
  const _updateClient = useServerFn(updateClientFn);
  const _deleteClient = useServerFn(deleteClientFn);
  const _startCall = useServerFn(startCallFn);
  const _updateCall = useServerFn(updateCallFn);
  const _setCallItem = useServerFn(setCallItemFn);
  const _setCallGuide = useServerFn(setCallGuideFn);
  const _upsertGuide = useServerFn(upsertGuideFn);
  const _removeGuide = useServerFn(removeGuideFn);
  const _addGuide = useServerFn(addGuideFn);
  const _addTeamMember = useServerFn(addTeamMemberFn);
  const _removeTeamMember = useServerFn(removeTeamMemberFn);
  const _addTemplateItem = useServerFn(addTemplateItemFn);
  const _removeTemplateItem = useServerFn(removeTemplateItemFn);
  const _upsertTemplate = useServerFn(upsertTemplateFn);
  const _upsertTemplateItem = useServerFn(upsertTemplateItemFn);
  const _finishCall = useServerFn(finishCallFn);
  const _sendProgressUpdate = useServerFn(sendProgressUpdateFn);
  void _getState;

  const patchClient = useCallback(
    (clientId: string, fn: (c: Client) => Client) =>
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => (c.id === clientId ? fn(c) : c)),
      })),
    [setState],
  );

  const patchCall = useCallback(
    (clientId: string, callId: string, fn: (call: Call) => Call) =>
      patchClient(clientId, (c) => ({
        ...c,
        updatedAt: nowISO(),
        calls: c.calls.map((call) => (call.id === callId ? fn(call) : call)),
      })),
    [patchClient],
  );

  const addClient = useCallback(
    (input: NewClientInput): string => {
      const id = crypto.randomUUID();
      const now = nowISO();
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
      void _addClient({ data: input }).catch(() => void reload());
      return id;
    },
    [setState, _addClient, reload],
  );

  const updateClient = useCallback(
    (
      id: string,
      patch: Partial<Omit<Client, "id" | "calls" | "audit">>,
      _actor?: string,
      _reason?: string,
    ): void => {
      patchClient(id, (c) => ({ ...c, ...patch, updatedAt: nowISO() }));
      void _updateClient({
        data: {
          id,
          ...(patch.businessName ? { businessName: patch.businessName } : {}),
          ...(patch.clientName ? { clientName: patch.clientName } : {}),
          ...(patch.assignedTeamMember ? { assignedTeamMember: patch.assignedTeamMember } : {}),
          ...(patch.contactDetails !== undefined ? { contactDetails: patch.contactDetails } : {}),
          ...(patch.ghlLink !== undefined ? { ghlLink: patch.ghlLink } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.nextCallType ? { nextCallType: patch.nextCallType } : {}),
          ...(patch.nextCallDate !== undefined ? { nextCallDate: patch.nextCallDate } : {}),
        },
      }).catch(() => void reload());
    },
    [patchClient, _updateClient, reload],
  );

  const deleteClient = useCallback(
    (id: string): void => {
      setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
      void _deleteClient({ data: { id } }).catch(() => void reload());
    },
    [setState, _deleteClient, reload],
  );

  const startCall = useCallback(
    (clientId: string, type: CallType, staffMember: string, date?: string): string => {
      const id = crypto.randomUUID();
      const callDate = date ?? new Date().toISOString().slice(0, 10);
      const tpl = state.settings.templates.find((t) => t.callType === type);
      const items = tpl ? buildCallItems(tpl) : [];
      const guides = type === "onboarding" ? buildCallGuides(state.settings.guides) : [];
      const call: Call = {
        id,
        clientId,
        type,
        date: callDate,
        staffMember,
        items,
        guides,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      patchClient(clientId, (c) => ({
        ...c,
        updatedAt: nowISO(),
        calls: [...c.calls, call],
      }));
      void _startCall({ data: { clientId, type, staffMember, ...(date ? { date } : {}) } }).catch(() =>
        void reload(),
      );
      return id;
    },
    [state.settings, patchClient, _startCall, reload],
  );

  const updateCall = useCallback(
    (clientId: string, callId: string, patch: Partial<Call>, _actor?: string): void => {
      patchCall(clientId, callId, (call) => ({ ...call, ...patch, updatedAt: nowISO() }));
      void _updateCall({
        data: {
          callId,
          ...(patch.staffMember ? { staffMember: patch.staffMember } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.followUpAction !== undefined ? { followUpAction: patch.followUpAction } : {}),
          ...(patch.followUpOwner !== undefined ? { followUpOwner: patch.followUpOwner } : {}),
          ...(patch.followUpDate !== undefined ? { followUpDate: patch.followUpDate } : {}),
        },
      }).catch(() => void reload());
    },
    [patchCall, _updateCall, reload],
  );

  const finishCall = useCallback(
    async (
      clientId: string,
      callId: string,
      patch: Partial<Call>,
      _actor?: string,
    ): Promise<{ ok: boolean; emailError?: string | undefined }> => {
      patchCall(clientId, callId, (call) => ({
        ...call,
        ...patch,
        finishedAt: nowISO(),
        updatedAt: nowISO(),
      }));
      try {
        await _updateCall({
          data: {
            callId,
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(patch.followUpAction !== undefined ? { followUpAction: patch.followUpAction } : {}),
            ...(patch.followUpOwner !== undefined ? { followUpOwner: patch.followUpOwner } : {}),
            ...(patch.followUpDate !== undefined ? { followUpDate: patch.followUpDate } : {}),
          },
        });
        const res = await _finishCall({
          data: {
            callId,
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(patch.followUpAction !== undefined ? { followUpAction: patch.followUpAction } : {}),
            ...(patch.followUpOwner !== undefined ? { followUpOwner: patch.followUpOwner } : {}),
            ...(patch.followUpDate !== undefined ? { followUpDate: patch.followUpDate } : {}),
          },
        });
        await reload();
        const email = (res as { email?: { status?: string; error?: string } | undefined }).email;
        return { ok: true, emailError: email?.status === "failed" ? email.error : undefined };
      } catch (e) {
        await reload();
        return { ok: false, emailError: e instanceof Error ? e.message : "Failed to finish call" };
      }
    },
    [patchCall, _updateCall, _finishCall, reload],
  );

  const saveProgress = useCallback(async (): Promise<void> => {
    await Promise.resolve();
  }, []);

  const sendProgressEmail = useCallback(
    async (callId: string): Promise<{ ok: boolean; emailError?: string | undefined }> => {
      try {
        const res = await _sendProgressUpdate({ data: { callId } });
        const email = (res as { email?: { status?: string; error?: string } | undefined }).email;
        return { ok: true, emailError: email?.status === "failed" ? email.error : undefined };
      } catch (e) {
        return { ok: true, emailError: e instanceof Error ? e.message : "Email failed" };
      }
    },
    [_sendProgressUpdate],
  );

  const setCallItem = useCallback(
    (
      clientId: string,
      callId: string,
      itemId: string,
      patch: Partial<CallItem>,
      _actor?: string,
      _reason?: string,
    ): void => {
      patchCall(clientId, callId, (call) => ({
        ...call,
        updatedAt: nowISO(),
        items: call.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      }));
      void _setCallItem({
        data: {
          callId,
          itemId,
          patch: {
            ...(patch.status ? { status: patch.status } : {}),
            ...(patch.evidence !== undefined ? { evidence: patch.evidence } : {}),
            ...(patch.completedBy !== undefined ? { completedBy: patch.completedBy } : {}),
            ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
            ...(patch.issue !== undefined ? { issue: patch.issue } : {}),
            ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction } : {}),
            ...(patch.notApplicableReason !== undefined
              ? { notApplicableReason: patch.notApplicableReason }
              : {}),
            ...(patch.acknowledgedByReviewer !== undefined
              ? { acknowledgedByReviewer: patch.acknowledgedByReviewer }
              : {}),
            ...(patch.reviewOutcome !== undefined ? { reviewOutcome: patch.reviewOutcome } : {}),
            ...(patch.staffDemonstrated !== undefined
              ? { staffDemonstrated: patch.staffDemonstrated }
              : {}),
            ...(patch.staffDemonstratedBy !== undefined
              ? { staffDemonstratedBy: patch.staffDemonstratedBy }
              : {}),
            ...(patch.staffDemonstratedAt !== undefined
              ? { staffDemonstratedAt: patch.staffDemonstratedAt }
              : {}),
          },
        },
      }).catch(() => void reload());
    },
    [patchCall, _setCallItem, reload],
  );

  const setCallGuide = useCallback(
    (
      clientId: string,
      callId: string,
      guideId: string,
      patch: Partial<CallGuideRecord>,
      _actor?: string,
      _reason?: string,
    ): void => {
      patchCall(clientId, callId, (call) => ({
        ...call,
        updatedAt: nowISO(),
        guides: call.guides.map((g) => (g.guideId === guideId ? { ...g, ...patch } : g)),
      }));
      void _setCallGuide({
        data: {
          callId,
          guideId,
          patch: {
            ...(patch.sent !== undefined ? { sent: patch.sent } : {}),
            ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
            ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
            ...(patch.sentBy !== undefined ? { sentBy: patch.sentBy } : {}),
            ...(patch.suppliedUrlOrVersion !== undefined
              ? { suppliedUrlOrVersion: patch.suppliedUrlOrVersion }
              : {}),
            ...(patch.walkthroughProvided !== undefined
              ? { walkthroughProvided: patch.walkthroughProvided }
              : {}),
            ...(patch.walkthroughAt !== undefined ? { walkthroughAt: patch.walkthroughAt } : {}),
            ...(patch.walkthroughBy !== undefined ? { walkthroughBy: patch.walkthroughBy } : {}),
            ...(patch.walkthroughNotes !== undefined
              ? { walkthroughNotes: patch.walkthroughNotes }
              : {}),
            ...(patch.notApplicableReason !== undefined
              ? { notApplicableReason: patch.notApplicableReason }
              : {}),
            ...(patch.acknowledgedByReviewer !== undefined
              ? { acknowledgedByReviewer: patch.acknowledgedByReviewer }
              : {}),
          },
        },
      }).catch(() => void reload());
    },
    [patchCall, _setCallGuide, reload],
  );

  const updateGuide = useCallback(
    (id: string, patch: Partial<GuideLink>): void => {
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          guides: s.settings.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        },
      }));
      void _upsertGuide({
        data: {
          id,
          label: patch.label ?? state.settings.guides.find((g) => g.id === id)?.label ?? "",
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.documentTitle !== undefined ? { documentTitle: patch.documentTitle } : {}),
          ...(patch.documentVersion !== undefined ? { documentVersion: patch.documentVersion } : {}),
        },
      }).catch(() => void reload());
    },
    [state, setState, _upsertGuide, reload],
  );

  const updateGuideLink = useCallback(
    (id: string, patch: Partial<GuideLink>): void => updateGuide(id, patch),
    [updateGuide],
  );

  const addGuide = useCallback(
    (label: string, url?: string): void => {
      const id = rid("guide");
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          guides: [...s.settings.guides, { id, label, ...(url ? { url } : {}) }],
        },
      }));
      void _addGuide({ data: { label, ...(url ? { url } : {}) } }).catch(() => void reload());
    },
    [setState, _addGuide, reload],
  );

  const removeGuide = useCallback(
    (id: string): void => {
      setState((s) => ({
        ...s,
        settings: { ...s.settings, guides: s.settings.guides.filter((g) => g.id !== id) },
      }));
      void _removeGuide({ data: { id } }).catch(() => void reload());
    },
    [setState, _removeGuide, reload],
  );

  const addTeamMember = useCallback(
    (name: string): void => {
      const id = rid("tm");
      setState((s) => ({
        ...s,
        settings: { ...s.settings, team: [...s.settings.team, { id, name }] },
      }));
      void _addTeamMember({ data: { name } }).catch(() => void reload());
    },
    [setState, _addTeamMember, reload],
  );

  const removeTeamMember = useCallback(
    (id: string): void => {
      setState((s) => ({
        ...s,
        settings: { ...s.settings, team: s.settings.team.filter((t) => t.id !== id) },
      }));
      void _removeTeamMember({ data: { id } }).catch(() => void reload());
    },
    [setState, _removeTeamMember, reload],
  );

  const addTemplateItem = useCallback(
    (templateId: string, label: string, kind: TemplateItem["kind"], required: boolean): void => {
      const id = rid("ti");
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          templates: s.settings.templates.map((t) =>
            t.id === templateId ? { ...t, items: [...t.items, { id, label, kind, required }] } : t,
          ),
        },
      }));
      void _addTemplateItem({ data: { templateId, label, kind, required } }).catch(() =>
        void reload(),
      );
    },
    [setState, _addTemplateItem, reload],
  );

  const updateTemplateItem = useCallback(
    (templateId: string, itemId: string, patch: Partial<TemplateItem>): void => {
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
      void _upsertTemplateItem({
        data: {
          id: itemId,
          templateId,
          label: patch.label ?? "",
          kind: patch.kind ?? "staff_check",
          required: patch.required ?? true,
          ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
          ...(patch.helpText !== undefined ? { helpText: patch.helpText } : {}),
          ...(patch.reviewSend !== undefined ? { reviewSend: patch.reviewSend } : {}),
          ...(patch.guideDerived !== undefined ? { guideDerived: patch.guideDerived } : {}),
          ...(patch.demoPractice !== undefined ? { demoPractice: patch.demoPractice } : {}),
          sortOrder: 0,
        },
      }).catch(() => void reload());
    },
    [setState, _upsertTemplateItem, reload],
  );

  const removeTemplateItem = useCallback(
    (templateId: string, itemId: string): void => {
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          templates: s.settings.templates.map((t) =>
            t.id === templateId
              ? { ...t, items: t.items.filter((i) => i.id !== itemId) }
              : t,
          ),
        },
      }));
      void _removeTemplateItem({ data: { id: itemId } }).catch(() => void reload());
    },
    [setState, _removeTemplateItem, reload],
  );

  const reorderTemplateItem = useCallback(
    (templateId: string, itemId: string, dir: -1 | 1): void => {
      setState((s) => {
        const tpl = s.settings.templates.find((t) => t.id === templateId);
        if (!tpl) return s;
        const idx = tpl.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return s;
        const ni = idx + dir;
        if (ni < 0 || ni >= tpl.items.length) return s;
        const items = [...tpl.items];
        const moved = items[idx];
        if (!moved) return s;
        items.splice(idx, 1);
        items.splice(ni, 0, moved);
        return {
          ...s,
          settings: {
            ...s.settings,
            templates: s.settings.templates.map((t) =>
              t.id === templateId ? { ...t, items } : t,
            ),
          },
        };
      });
    },
    [setState],
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<ChecklistTemplate>): void => {
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          templates: s.settings.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        },
      }));
      void _upsertTemplate({
        data: {
          id,
          callType: patch.callType ?? "connection",
          name: patch.name ?? "",
          ...(patch.description !== undefined ? { description: patch.description } : {}),
        },
      }).catch(() => void reload());
    },
    [setState, _upsertTemplate, reload],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppState["settings"]>): void => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    [setState],
  );

  const reset = useCallback((): void => {
    void reload();
  }, [reload]);

  return {
    addClient,
    updateClient,
    deleteClient,
    startCall,
    updateCall,
    finishCall,
    saveProgress,
    sendProgressEmail,
    setCallItem,
    setCallGuide,
    updateSettings,
    updateGuide,
    updateGuideLink,
    addGuide,
    removeGuide,
    addTeamMember,
    removeTeamMember,
    addTemplateItem,
    updateTemplateItem,
    removeTemplateItem,
    reorderTemplateItem,
    updateTemplate,
    reset,
  };
}