import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { derivedOverallStatus, completionBlock, connectionProgress, practiceProgress, followupProgress, unresolvedBlockers } from "../lib/completion";
import type { OverallStatus } from "../lib/types";
import { StatusBadge } from "../components/status-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LSP Onboarding Checklist" },
      { name: "description", content: "Staff dashboard for client onboarding calls — progress, blockers and next actions." },
      { property: "og:title", content: "Dashboard — LSP Onboarding Checklist" },
      { property: "og:description", content: "Staff dashboard for client onboarding calls — progress, blockers and next actions." },
    ],
  }),
  component: Dashboard,
});

const STATUS_FILTERS: { value: OverallStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

function Dashboard() {
  const { state, addClient } = useStore();
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState("all");
  const [status, setStatus] = useState<OverallStatus | "all">("all");
  const [showNew, setShowNew] = useState(false);

  const team = state.settings.team;

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.clients
      .map((c) => ({ client: c, derived: derivedOverallStatus(c) }))
      .filter(({ client, derived }) => {
        if (staff !== "all" && client.assignedTeamMember !== staff) return false;
        if (status !== "all" && derived !== status) return false;
        if (q) {
          const hay = `${client.businessName} ${client.clientName} ${client.plan}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [state.clients, query, staff, status]);

  const totals = useMemo(() => {
    const all = state.clients;
    const blocked = all.filter((c) => derivedOverallStatus(c) === "blocked").length;
    const completed = all.filter((c) => derivedOverallStatus(c) === "completed").length;
    const openBlockers = all.reduce((n, c) => n + unresolvedBlockers(c).length, 0);
    return { total: all.length, blocked, completed, openBlockers };
  }, [state.clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Onboarding dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track client connections, practical skills and follow-up across onboarding calls.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + New client
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Clients" value={totals.total} />
        <StatCard label="Completed" value={totals.completed} tone="ok" />
        <StatCard label="Blocked" value={totals.blocked} tone="warn" />
        <StatCard label="Open blockers" value={totals.openBlockers} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search business, client or plan…"
          className="min-w-48 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          aria-label="Filter by assigned staff"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All staff</option>
          {team.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OverallStatus | "all")}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business / client</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Assigned</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Connections</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Practice</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Follow-up</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No clients match these filters.
                </td>
              </tr>
            )}
            {clients.map(({ client, derived }) => {
              const conn = connectionProgress(client);
              const prac = practiceProgress(client);
              const fu = followupProgress(client);
              const block = completionBlock(client);
              return (
                <tr key={client.id} className="hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <Link to="/clients/$clientId" params={{ clientId: client.id }} className="block">
                      <div className="font-medium text-foreground">{client.businessName}</div>
                      <div className="text-xs text-muted-foreground">{client.clientName}</div>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{client.assignedTeamMember}</td>
                  <td className="hidden px-3 py-2.5 md:table-cell"><MiniBar done={conn.done} total={conn.total} /></td>
                  <td className="hidden px-3 py-2.5 md:table-cell"><MiniBar done={prac.done} total={prac.total} /></td>
                  <td className="hidden px-3 py-2.5 lg:table-cell"><MiniBar done={fu.done} total={fu.total} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={derived} />
                      {!block.ok && derived !== "completed" && (
                        <span className="text-xs text-destructive" title={block.reasons.join(" · ")}>
                          {block.reasons.length} issue(s)
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && <NewClientDialog onClose={() => setShowNew(false)} onCreate={(input) => { addClient(input); setShowNew(false); }} team={team} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-chart-1" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
    </div>
  );
}

function NewClientDialog({ onClose, onCreate, team }: { onClose: () => void; onCreate: (input: import("../lib/store").NewClientInput) => void; team: { id: string; name: string }[] }) {
  const [businessName, setBusinessName] = useState("");
  const [clientName, setClientName] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlLink, setGhlLink] = useState("");
  const [assignedTeamMember, setAssignedTeamMember] = useState(team[0]?.name ?? "");
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState("");
  const [notes, setNotes] = useState("");

  const valid = businessName.trim() && clientName.trim() && assignedTeamMember && plan.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold">New client record</h2>
        <p className="mt-1 text-xs text-muted-foreground">Synthetic demo data only — do not enter real client PII.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Business name *"><input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></Field>
          <Field label="Client name *"><input className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} /></Field>
          <Field label="GHL location ID (optional)"><input className={inputCls} value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} /></Field>
          <Field label="GHL link (optional)"><input className={inputCls} value={ghlLink} onChange={(e) => setGhlLink(e.target.value)} /></Field>
          <Field label="Assigned team member *">
            <select className={inputCls} value={assignedTeamMember} onChange={(e) => setAssignedTeamMember(e.target.value)}>
              {team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Call date *"><input type="date" className={inputCls} value={callDate} onChange={(e) => setCallDate(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Plan / inclusions * (entered manually)"><input className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Notes"><textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onCreate({ businessName, clientName, ghlLocationId: ghlLocationId || undefined, ghlLink: ghlLink || undefined, assignedTeamMember, callDate, plan, notes: notes || undefined })}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}