import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, type NewClientInput } from "../lib/store";
import { deriveClientStatus, nextCallTypeForClient, unfinishedCallOfType } from "../lib/completion";
import type { CallStatus, CallType } from "../lib/types";
import { CALL_TYPES, CALL_TYPE_LABEL } from "../lib/types";
import { StatusBadge } from "../components/status-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LSP Onboarding Tracker" },
      {
        name: "description",
        content:
          "Staff dashboard for client onboarding calls — progress, blockers and next actions.",
      },
      { property: "og:title", content: "Dashboard — LSP Onboarding Tracker" },
      {
        property: "og:description",
        content:
          "Staff dashboard for client onboarding calls — progress, blockers and next actions.",
      },
    ],
  }),
  component: Dashboard,
});

const STATUS_FILTERS: { value: CallStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "needs_followup", label: "Needs follow-up" },
  { value: "completed", label: "Completed" },
];

function Dashboard() {
  const { state, addClient, startCall } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState("all");
  const [callTypeFilter, setCallTypeFilter] = useState<CallType | "all">("all");
  const [status, setStatus] = useState<CallStatus | "all">("all");
  const [showTest, setShowTest] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const guides = state.settings.guides;
  const team = state.settings.team;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.clients
      .map((c) => ({
        client: c,
        derived: deriveClientStatus(c, guides),
        nextType: nextCallTypeForClient(c),
      }))
      .filter(({ client, derived, nextType }) => {
        if (!showTest && client.isTestRecord) return false;
        if (staff !== "all" && client.assignedTeamMember !== staff) return false;
        if (status !== "all" && derived !== status) return false;
        if (callTypeFilter !== "all" && nextType !== callTypeFilter) return false;
        if (q) {
          const hay =
            `${client.businessName} ${client.clientName} ${client.notes ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [state.clients, guides, query, staff, status, callTypeFilter, showTest]);

  const totals = useMemo(() => {
    const all = state.clients.filter((c) => !c.isTestRecord);
    const blocked = all.filter((c) => deriveClientStatus(c, guides) === "needs_followup").length;
    const completed = all.filter((c) => deriveClientStatus(c, guides) === "completed").length;
    return { total: all.length, blocked, completed };
  }, [state.clients, guides]);

  const onStart = (clientId: string, type: CallType) => {
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) return;
    // Reuse an existing unfinished call of this type, else start a new one.
    const existing = unfinishedCallOfType(client, type);
    if (existing) {
      navigate({
        to: "/clients/$clientId/call/$callId",
        params: { clientId, callId: existing.id },
      });
    } else {
      const id = startCall(
        clientId,
        type,
        client.assignedTeamMember,
        new Date().toISOString().slice(0, 10),
      );
      navigate({ to: "/clients/$clientId/call/$callId", params: { clientId, callId: id } });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-accent">
            Internal Staff Portal
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            LSP Onboarding Tracker
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Choose a client, start the appropriate call, and update the checklist as you go.{" "}
            <span className="text-foreground/80">Add Client</span> for a new client,{" "}
            <span className="text-foreground/80">Start Call</span> for a new session,{" "}
            <span className="text-foreground/80">Continue Call</span> for an unfinished one. A
            client name opens its details and history.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all cursor-pointer min-h-[44px]"
        >
          <span>+ Add Client</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Clients" value={totals.total} />
        <StatCard label="Completed" value={totals.completed} tone="ok" />
        <StatCard label="Needs Follow-up" value={totals.blocked} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <input
          aria-label="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search business, client or notes..."
          className="min-w-48 flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]"
        />
        <select
          aria-label="Filter by assigned staff"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          <option value="all">All Staff</option>
          {team.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by call type"
          value={callTypeFilter}
          onChange={(e) => setCallTypeFilter(e.target.value as CallType | "all")}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          <option value="all">All Call Types</option>
          {CALL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CallStatus | "all")}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground cursor-pointer px-1">
          <input
            type="checkbox"
            checked={showTest}
            onChange={(e) => setShowTest(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
          />
          Test records
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-secondary/80 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="px-4 py-3 font-bold">Business &amp; Client</th>
                <th className="hidden px-3 py-3 font-bold sm:table-cell">Assigned</th>
                <th className="hidden px-3 py-3 font-bold md:table-cell">Next Call</th>
                <th className="hidden px-3 py-3 font-bold md:table-cell">Date</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No client records match the current filter selection.
                  </td>
                </tr>
              )}
              {rows.map(({ client, derived, nextType }) => {
                const unfinished = unfinishedCallOfType(client, nextType);
                return (
                  <tr key={client.id} className="hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: client.id }}
                        className="block group"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground group-hover:text-accent transition-colors">
                            {client.businessName}
                          </span>
                          {client.isTestRecord && (
                            <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                              Test
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{client.clientName}</div>
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3.5 text-muted-foreground font-medium sm:table-cell">
                      {client.assignedTeamMember}
                    </td>
                    <td className="hidden px-3 py-3.5 md:table-cell">
                      <span className="text-xs font-semibold text-foreground">
                        {CALL_TYPE_LABEL[nextType]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3.5 text-muted-foreground font-mono md:table-cell">
                      {client.nextCallDate ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={derived} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => onStart(client.id, nextType)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors cursor-pointer min-h-[36px]"
                      >
                        {unfinished ? "Continue Call" : "Start Call"}
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewClientDialog
          team={team}
          onClose={() => setShowNew(false)}
          onCreate={(input) => {
            const id = addClient(input);
            setShowNew(false);
            // Start the appropriate call immediately so staff can begin the checklist.
            const callId = startCall(
              id,
              input.callType,
              input.assignedTeamMember,
              input.callDate ?? new Date().toISOString().slice(0, 10),
            );
            navigate({ to: "/clients/$clientId/call/$callId", params: { clientId: id, callId } });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color =
    tone === "ok" ? "text-chart-1" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 font-display text-2xl sm:text-3xl font-extrabold ${color}`}>
        {value}
      </div>
    </div>
  );
}

function NewClientDialog({
  team,
  onClose,
  onCreate,
}: {
  team: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (input: NewClientInput) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [clientName, setClientName] = useState("");
  const [assignedTeamMember, setAssignedTeamMember] = useState(team[0]?.name ?? "");
  const [callType, setCallType] = useState<CallType>("connection");
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [contactDetails, setContactDetails] = useState("");
  const [ghlLink, setGhlLink] = useState("");
  const [notes, setNotes] = useState("");

  const valid = businessName.trim() && clientName.trim() && assignedTeamMember && callType;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-accent/40 bg-card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">
            Internal Staff Tool
          </span>
          <h2 className="font-display text-xl font-bold text-foreground">Add New Client</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quick add. The appropriate checklist is created automatically. Do not enter real
            credentials.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <Field label="Business Name *">
            <input
              className={inputCls}
              placeholder="e.g. Miller Plumbing"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </Field>
          <Field label="Client Name *">
            <input
              className={inputCls}
              placeholder="e.g. Jack Miller"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </Field>
          <Field label="Assigned Staff *">
            <select
              className={inputCls}
              value={assignedTeamMember}
              onChange={(e) => setAssignedTeamMember(e.target.value)}
            >
              {team.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call Type *">
            <select
              className={inputCls}
              value={callType}
              onChange={(e) => setCallType(e.target.value as CallType)}
            >
              {CALL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call Date (optional)">
            <input
              type="date"
              className={inputCls}
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
            />
          </Field>
          <Field label="GHL Subaccount Link (optional)">
            <input
              className={inputCls}
              placeholder="https://..."
              value={ghlLink}
              onChange={(e) => setGhlLink(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Contact Details (optional)">
              <input
                className={inputCls}
                placeholder="Phone / email (no passwords)"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes (optional)">
              <textarea
                className={inputCls}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Initial notes..."
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onCreate({
                businessName: businessName.trim(),
                clientName: clientName.trim(),
                assignedTeamMember,
                callType,
                ...(callDate ? { callDate } : {}),
                ...(contactDetails ? { contactDetails } : {}),
                ...(ghlLink ? { ghlLink } : {}),
                ...(notes ? { notes } : {}),
              })
            }
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20 min-h-[40px]"
          >
            Add &amp; Start Call
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]";

function Field({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
