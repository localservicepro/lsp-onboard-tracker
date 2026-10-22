import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import {
  derivedOverallStatus,
  completionBlock,
  accessProgress,
  connectionProgress,
  practiceProgress,
  staffVerificationProgress,
  followupProgress,
  unresolvedBlockers,
} from "../lib/completion";
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
    const guides = state.settings.guides;
    return state.clients
      .map((c) => ({ client: c, derived: derivedOverallStatus(c, guides) }))
      .filter(({ client, derived }) => {
        if (staff !== "all" && client.assignedTeamMember !== staff) return false;
        if (status !== "all" && derived !== status) return false;
        if (q) {
          const hay = `${client.businessName} ${client.clientName} ${client.plan}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [state.clients, state.settings.guides, query, staff, status]);

  const totals = useMemo(() => {
    const all = state.clients;
    const guides = state.settings.guides;
    const blocked = all.filter((c) => derivedOverallStatus(c, guides) === "blocked").length;
    const completed = all.filter((c) => derivedOverallStatus(c, guides) === "completed").length;
    const openBlockers = all.reduce((n, c) => n + unresolvedBlockers(c).length, 0);
    return { total: all.length, blocked, completed, openBlockers };
  }, [state.clients, state.settings.guides]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-accent">Internal Staff Portal</span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            LSP Onboarding Checklist
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Track phone-app access, required connections, client practical skills and staff result verification across onboarding calls.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all cursor-pointer min-h-[44px]"
        >
          <span>+ New Client Record</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Clients" value={totals.total} />
        <StatCard label="Completed" value={totals.completed} tone="ok" />
        <StatCard label="Blocked / Action Required" value={totals.blocked} tone="warn" />
        <StatCard label="Open Issues / Blockers" value={totals.openBlockers} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <input
          aria-label="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search business name, client or plan..."
          className="min-w-48 flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]"
        />
        <select
          aria-label="Filter by assigned staff"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          <option value="all">All Assigned Staff</option>
          {team.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OverallStatus | "all")}
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent cursor-pointer min-h-[40px]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-secondary/80 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="px-4 py-3 font-bold">Business &amp; Client</th>
                <th className="hidden px-3 py-3 font-bold sm:table-cell">Assigned</th>
                <th className="hidden px-3 py-3 font-bold md:table-cell">Connections</th>
                <th className="hidden px-3 py-3 font-bold md:table-cell">Practice</th>
                <th className="hidden px-3 py-3 font-bold lg:table-cell">Staff Verif.</th>
                <th className="px-4 py-3 font-bold">Overall Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No client records match the current filter selection.
                  </td>
                </tr>
              )}
              {clients.map(({ client, derived }) => {
                const guides = state.settings.guides;
                const conn = connectionProgress(client);
                const prac = practiceProgress(client);
                const sv = staffVerificationProgress(client);
                const block = completionBlock(client, guides);
                return (
                  <tr key={client.id} className="hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link to="/clients/$clientId" params={{ clientId: client.id }} className="block group">
                        <div className="font-bold text-foreground group-hover:text-accent transition-colors">
                          {client.businessName}
                        </div>
                        <div className="text-xs text-muted-foreground">{client.clientName} · {client.plan}</div>
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3.5 text-muted-foreground font-medium sm:table-cell">{client.assignedTeamMember}</td>
                    <td className="hidden px-3 py-3.5 md:table-cell"><MiniBar done={conn.done} total={conn.total} /></td>
                    <td className="hidden px-3 py-3.5 md:table-cell"><MiniBar done={prac.done} total={prac.total} /></td>
                    <td className="hidden px-3 py-3.5 lg:table-cell"><MiniBar done={sv.done} total={sv.total} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={derived} />
                        {!block.ok && derived !== "completed" && (
                          <span className="text-[11px] font-semibold text-destructive" title={block.reasons.join(" · ")}>
                            {block.reasons.length} blocker(s)
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
      </div>

      {showNew && (
        <NewClientDialog
          onClose={() => setShowNew(false)}
          onCreate={(input) => {
            addClient(input);
            setShowNew(false);
          }}
          team={team}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-chart-1" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1.5 font-display text-2xl sm:text-3xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{done}/{total}</span>
    </div>
  );
}

function NewClientDialog({
  onClose,
  onCreate,
  team,
}: {
  onClose: () => void;
  onCreate: (input: import("../lib/store").NewClientInput) => void;
  team: { id: string; name: string }[];
}) {
  const [businessName, setBusinessName] = useState("");
  const [clientName, setClientName] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlLink, setGhlLink] = useState("");
  const [assignedTeamMember, setAssignedTeamMember] = useState(team[0]?.name ?? "Avery Chen");
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState("Digital Essentials — GBP & Web Management ($500/mo)");
  const [notes, setNotes] = useState("");

  const valid = businessName.trim() && clientName.trim() && assignedTeamMember && plan.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border-2 border-accent/40 bg-card p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Internal Staff Tool</span>
          <h2 className="font-display text-xl font-bold text-foreground">Create New Client Record</h2>
          <p className="mt-1 text-xs text-muted-foreground">Synthetic prototype store — do not enter real customer passwords or credentials.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <Field label="Business Name *">
            <input className={inputCls} placeholder="e.g. Miller Plumbing" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </Field>
          <Field label="Client Full Name *">
            <input className={inputCls} placeholder="e.g. Jack Miller" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>
          <Field label="GHL Location ID (optional)">
            <input className={inputCls} placeholder="e.g. loc_miller_99" value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} />
          </Field>
          <Field label="GHL App Link (optional)">
            <input className={inputCls} placeholder="https://..." value={ghlLink} onChange={(e) => setGhlLink(e.target.value)} />
          </Field>
          <Field label="Assigned Team Member *">
            <select className={inputCls} value={assignedTeamMember} onChange={(e) => setAssignedTeamMember(e.target.value)}>
              {team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Call Date *">
            <input type="date" className={inputCls} value={callDate} onChange={(e) => setCallDate(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Plan / Inclusions * (manually entered)">
              <input className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes / Call Agenda">
              <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Initial notes..." />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary cursor-pointer">
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onCreate({
                businessName,
                clientName,
                ...(ghlLocationId ? { ghlLocationId } : {}),
                ...(ghlLink ? { ghlLink } : {}),
                assignedTeamMember,
                callDate,
                plan,
                ...(notes ? { notes } : {}),
              })
            }
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
          >
            Create Record
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]";

function Field({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
