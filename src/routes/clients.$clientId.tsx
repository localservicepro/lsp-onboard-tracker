import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  OVERALL_STATUSES,
  GUIDE_CHANNELS,
  type GuideChannel,
  type OverallStatus,
  type Client,
} from "../lib/types";
import { StatusBadge } from "../components/status-badge";
import { buildCallSummary, copyToClipboard } from "../lib/call-summary";
import {
  inputCls,
  AuditTrail,
  AccessSection,
  ConnectionsSection,
  PracticalSection,
  StaffVerificationSection,
} from "../components/client-sections";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client Detail — LSP Onboarding Checklist" },
      { name: "description", content: "Connection checklist, practical tasks, guides and call history for a client." },
      { property: "og:title", content: "Client Detail — LSP Onboarding Checklist" },
      { property: "og:description", content: "Connection checklist, practical tasks, guides and call history." },
    ],
  }),
  component: ClientDetailPage,
});

export function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const {
    state,
    setAccessCheck,
    setConnection,
    setTask,
    setStaffVerification,
    addBlocker,
    updateBlocker,
    setGuide,
    updateClient,
    addCallSession,
  } = useStore();
  const client = state.clients.find((c) => c.id === clientId);
  const [actor, setActor] = useState(state.settings.team[0]?.name ?? "Staff Member");
  const [copied, setCopied] = useState(false);

  if (!client) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-bold">Client record not found</h2>
        <p className="text-sm text-muted-foreground">The requested client ID does not exist in this store.</p>
        <Link to="/" className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const acc = accessProgress(client);
  const conn = connectionProgress(client);
  const prac = practiceProgress(client);
  const sv = staffVerificationProgress(client);
  const block = completionBlock(client);
  const derived = derivedOverallStatus(client);

  const onCopy = async () => {
    await copyToClipboard(buildCallSummary(client));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
            ← Back to Onboarding Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {client.businessName}
            </h1>
            <StatusBadge status={derived} />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Client: <span className="font-semibold text-foreground">{client.clientName}</span> · Assigned:{" "}
            <span className="font-semibold text-foreground">{client.assignedTeamMember}</span> · Call:{" "}
            <span className="font-mono">{client.callDate}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Acting Staff:</label>
            <select
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-hidden cursor-pointer"
            >
              {state.settings.team.map((t) => (
                <option key={t.id} value={t.name} className="bg-card text-foreground">{t.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 min-h-[40px] cursor-pointer"
          >
            {copied ? "✓ Copied!" : "📋 Copy Call Summary"}
          </button>
        </div>
      </div>

      {/* Completion Warning Banner */}
      {!block.ok ? (
        <div className="rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-4 sm:p-5 text-sm">
          <div className="flex items-center gap-2 font-bold text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
            Overall Onboarding Cannot Be Marked Completed ({block.reasons.length} issues remaining)
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive/90">
            {block.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-chart-1/50 bg-chart-1/10 p-4 text-sm font-bold text-chart-1 flex items-center gap-2">
          <span>✓</span>
          <span>All completion criteria verified: access confirmed, required connections satisfied, client practical tasks demonstrated with evidence, staff check confirmed, and zero unresolved blockers.</span>
        </div>
      )}

      {/* Progress Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProgressCard title="Phone-App Access" done={acc.done} total={acc.total} />
        <ProgressCard title="Connections" done={conn.done} total={conn.total} exempt={conn.exemptCount ?? 0} />
        <ProgressCard title="Client Practical Skills" done={prac.done} total={prac.total} exempt={prac.exemptCount ?? 0} />
        <ProgressCard title="Staff Verification" done={sv.done} total={sv.total} exempt={sv.exemptCount ?? 0} />
      </section>

      {/* Record Info Form */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
          <h2 className="font-display text-base font-bold text-foreground">Client Record Information</h2>
          <span className="text-xs text-muted-foreground font-mono">ID: {client.id}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <Field label="Business Name">
            <input className={inputCls} defaultValue={client.businessName} onBlur={(e) => updateClient(client.id, { businessName: e.target.value }, actor)} />
          </Field>
          <Field label="Client Full Name">
            <input className={inputCls} defaultValue={client.clientName} onBlur={(e) => updateClient(client.id, { clientName: e.target.value }, actor)} />
          </Field>
          <Field label="GHL Location ID (optional)">
            <input className={inputCls} defaultValue={client.ghlLocationId ?? ""} placeholder="e.g. loc_123" onBlur={(e) => updateClient(client.id, { ghlLocationId: e.target.value || undefined }, actor)} />
          </Field>
          <Field label="GHL Link (optional)">
            <input className={inputCls} defaultValue={client.ghlLink ?? ""} placeholder="https://..." onBlur={(e) => updateClient(client.id, { ghlLink: e.target.value || undefined }, actor)} />
          </Field>
          <Field label="Assigned Team Member">
            <select className={inputCls} defaultValue={client.assignedTeamMember} onChange={(e) => updateClient(client.id, { assignedTeamMember: e.target.value }, actor)}>
              {state.settings.team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Call Date">
            <input type="date" className={inputCls} defaultValue={client.callDate} onChange={(e) => updateClient(client.id, { callDate: e.target.value }, actor)} />
          </Field>
          <Field label="Plan / Inclusions (entered manually, not inferred)">
            <input className={inputCls} defaultValue={client.plan} onBlur={(e) => updateClient(client.id, { plan: e.target.value }, actor)} />
          </Field>
          <Field label="Next Call / Follow-up Date">
            <input type="date" className={inputCls} defaultValue={client.nextCallDate ?? ""} onChange={(e) => updateClient(client.id, { nextCallDate: e.target.value || undefined }, actor)} />
          </Field>
          <Field label="Manual Override Status">
            <select className={inputCls} value={client.overallStatus} onChange={(e) => updateClient(client.id, { overallStatus: e.target.value as OverallStatus }, actor, "Manual status select")}>
              {OVERALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Notes / Client Context">
              <textarea className={inputCls} rows={2} defaultValue={client.notes ?? ""} onBlur={(e) => updateClient(client.id, { notes: e.target.value || undefined }, actor)} />
            </Field>
          </div>
        </div>
      </section>

      {/* Sections A, B, C, D */}
      <AccessSection client={client} actor={actor} onCheck={(id, patch, reason) => setAccessCheck(client.id, id, patch, actor, reason)} />
      <ConnectionsSection client={client} actor={actor} onSetConnection={(id, patch, reason) => setConnection(client.id, id, patch, actor, reason)} />
      <PracticalSection client={client} actor={actor} onSetTask={(id, patch, reason) => setTask(client.id, id, patch, actor, reason)} />
      <StaffVerificationSection client={client} actor={actor} onSetVerification={(patch, reason) => setStaffVerification(client.id, patch, actor, reason)} />

      {/* Section E: Guides */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-1">How-To Guides &amp; Documentation</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Opening a guide link does NOT mark it sent. Recording a guide as sent requires date, delivery channel, staff member, and link version or URL supplied.
        </p>

        <div className="space-y-3">
          {client.guides.map((g) => {
            const def = state.settings.guides.find((d) => d.id === g.guideId);
            const label = def?.label ?? g.guideId;
            const url = def?.url;

            return (
              <div key={g.guideId} className={`rounded-xl border p-4 ${g.sent ? "border-chart-1/40 bg-chart-1/5" : "border-border bg-background"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm text-foreground">{label}</div>
                  <div className="flex items-center gap-3">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                      >
                        <span>Open Guide Link</span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <span className="rounded bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                        Guide link not added
                      </span>
                    )}

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                      <input
                        type="checkbox"
                        checked={g.sent}
                        onChange={(e) =>
                          setGuide(
                            client.id,
                            g.guideId,
                            {
                              sent: e.target.checked,
                              sentAt: e.target.checked ? new Date().toISOString() : undefined,
                              sentBy: e.target.checked ? actor : undefined,
                              channel: e.target.checked ? (g.channel ?? "email") : undefined,
                              suppliedUrlOrVersion: e.target.checked ? (url ?? "Guide link not added (verbal walkthrough)") : undefined,
                            },
                            actor,
                            e.target.checked ? "Guide send recorded" : "Guide send cleared",
                          )
                        }
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                      <span>Mark as Sent</span>
                    </label>
                  </div>
                </div>

                {g.sent && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs border-t border-border/60 pt-3">
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Date Sent:</span>
                      <input
                        type="date"
                        className={inputCls}
                        defaultValue={g.sentAt?.slice(0, 10) ?? ""}
                        onChange={(e) => setGuide(client.id, g.guideId, { sentAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }, actor)}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Delivery Channel:</span>
                      <select
                        className={inputCls}
                        defaultValue={g.channel ?? "email"}
                        onChange={(e) => setGuide(client.id, g.guideId, { channel: e.target.value as GuideChannel }, actor)}
                      >
                        {GUIDE_CHANNELS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Sent By (Staff):</span>
                      <input
                        className={inputCls}
                        defaultValue={g.sentBy ?? actor}
                        onBlur={(e) => setGuide(client.id, g.guideId, { sentBy: e.target.value }, actor)}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <span className="block text-[11px] text-muted-foreground mb-1">Supplied URL / Version Recorded:</span>
                      <input
                        className={inputCls}
                        defaultValue={g.suppliedUrlOrVersion ?? (url ?? "Guide link not added")}
                        onBlur={(e) => setGuide(client.id, g.guideId, { suppliedUrlOrVersion: e.target.value }, actor)}
                      />
                    </div>
                  </div>
                )}

                {g.audit.length > 0 && <AuditTrail entries={g.audit} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section F: Blockers */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Blockers &amp; Outstanding Issues</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Any unresolved blocker prevents overall completion. Assign each blocker an owner, next action and follow-up due date.
        </p>

        <BlockerSection
          client={client}
          actor={actor}
          onAdd={(input) => addBlocker(client.id, input, actor)}
          onUpdate={(id, patch, reason) => updateBlocker(client.id, id, patch, actor, reason)}
        />
      </section>

      {/* Section G: Call History */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Call Session History</h2>
            <p className="text-xs text-muted-foreground">Multiple call sessions are preserved without erasing previous results.</p>
          </div>
          <button
            onClick={() =>
              addCallSession(
                client.id,
                {
                  date: new Date().toISOString().slice(0, 10),
                  staffMember: actor,
                  notes: "Follow-up onboarding call session",
                },
                actor,
              )
            }
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 cursor-pointer"
          >
            + Log New Call Session
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {client.callSessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No call sessions logged yet.
            </div>
          )}
          {[...client.callSessions].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-background p-4 text-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-foreground flex items-center gap-2">
                  <span>Call Date: {s.date}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground font-mono">{s.staffMember}</span>
                </div>
                {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
              </div>
              <Link
                to="/clients/$clientId/call/$callId"
                params={{ clientId: client.id, callId: s.id }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors"
              >
                <span>Open Live-Call Checklist</span>
                <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Section H: Copyable Call Summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Copyable Call-Summary Draft</h2>
            <p className="text-xs text-muted-foreground">Accurately reflects completed items, staff demos, exemptions, staff verification and blockers. Copying does not send anything.</p>
          </div>
          <button
            onClick={onCopy}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer min-h-[40px]"
          >
            {copied ? "✓ Copied!" : "📋 Copy Summary"}
          </button>
        </div>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border/80 bg-background/80 p-4 font-mono text-xs text-foreground">
          {buildCallSummary(client)}
        </pre>
      </section>

      {/* Section I: Audit Trail */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-base font-bold text-foreground mb-1">Client Overall Audit Trail</h2>
        <p className="text-xs text-muted-foreground mb-3">Immutable record of status and record modifications.</p>
        <AuditTrail entries={client.audit} />
      </section>
    </div>
  );
}

function BlockerSection({
  client,
  actor,
  onAdd,
  onUpdate,
}: {
  client: Client;
  actor: string;
  onAdd: (input: { summary: string; owner: string; nextAction: string; dueDate?: string }) => void;
  onUpdate: (id: string, patch: Partial<Client["blockers"][number]>, reason?: string) => void;
}) {
  const [summary, setSummary] = useState("");
  const [owner, setOwner] = useState(actor);
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="space-y-3">
      {client.blockers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No blockers recorded for this client.
        </div>
      )}

      {client.blockers.map((b) => (
        <div key={b.id} className={`rounded-xl border p-4 ${b.resolved ? "border-chart-1/30 bg-chart-1/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-sm text-foreground">{b.summary}</div>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={b.resolved}
                onChange={(e) => onUpdate(b.id, { resolved: e.target.checked }, e.target.checked ? "Blocker resolved" : "Blocker reopened")}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className={b.resolved ? "text-chart-1" : "text-destructive font-extrabold"}>
                {b.resolved ? "Resolved" : "Open Blocker (Blocks Completion)"}
              </span>
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">Owner:</span>
              <input className={inputCls} defaultValue={b.owner} onBlur={(e) => onUpdate(b.id, { owner: e.target.value }, "Owner updated")} />
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">Next Action:</span>
              <input className={inputCls} defaultValue={b.nextAction} onBlur={(e) => onUpdate(b.id, { nextAction: e.target.value }, "Next action updated")} />
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground mb-1">Follow-up Due Date:</span>
              <input
                type="date"
                className={inputCls}
                defaultValue={b.dueDate ?? ""}
                onChange={(e) => onUpdate(b.id, { dueDate: e.target.value || undefined }, "Due date updated")}
              />
            </div>
          </div>

          {b.audit.length > 0 && <AuditTrail entries={b.audit} />}
        </div>
      ))}

      {/* Add New Blocker */}
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-4 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">+ Add New Issue or Blocker</div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <input className={inputCls} placeholder="Issue summary *" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <input className={inputCls} placeholder="Responsible Owner *" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <input className={inputCls} placeholder="Next Action *" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Follow-up Date:</span>
            <input type="date" className={inputCls + " w-44"} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <button
            disabled={!summary.trim() || !owner.trim() || !nextAction.trim()}
            onClick={() => {
              onAdd({
                summary,
                owner,
                nextAction,
                ...(dueDate ? { dueDate } : {}),
              });
              setSummary("");
              setNextAction("");
              setDueDate("");
            }}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 cursor-pointer min-h-[38px]"
          >
            + Add Blocker
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ title, done, total, exempt }: { title: string; done: number; total: number; exempt?: number }) {
  const pct = total === 0 ? (exempt && exempt > 0 ? 100 : 0) : Math.round((done / total) * 100);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-display text-2xl font-extrabold text-foreground">{pct}%</span>
        <span className="text-xs font-mono text-muted-foreground">
          {done}/{total}
          {exempt && exempt > 0 ? ` (${exempt} N/A)` : ""}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
