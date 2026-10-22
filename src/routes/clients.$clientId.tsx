import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import {
  derivedOverallStatus,
  completionBlock,
  connectionProgress,
  practiceProgress,
  followupProgress,
  unresolvedBlockers,
  taskCompletionProofValid,
  isTaskDoneForOverall,
} from "../lib/completion";
import {
  CONNECTION_STATUSES,
  TASK_STATUSES,
  REVIEW_OUTCOMES,
  OVERALL_STATUSES,
  GUIDE_CHANNELS,
  type ConnectionStatus,
  type TaskStatus,
  type ReviewOutcome,
  type GuideChannel,
  type OverallStatus,
  type Client,
} from "../lib/types";
import { StatusBadge } from "../components/status-badge";
import { buildCallSummary, copyToClipboard } from "../lib/call-summary";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client — LSP Onboarding Checklist" },
      { name: "description", content: "Connection checklist, practical tasks, guides and call history for a client." },
      { property: "og:title", content: "Client — LSP Onboarding Checklist" },
      { property: "og:description", content: "Connection checklist, practical tasks, guides and call history." },
    ],
  }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { state, setConnection, setTask, addBlocker, updateBlocker, setGuide, updateClient, addCallSession } = useStore();
  const client = state.clients.find((c) => c.id === clientId);
  const [actor, setActor] = useState(state.settings.team[0]?.name ?? "Staff");
  const [copied, setCopied] = useState(false);

  if (!client) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/" className="text-primary underline">Back to dashboard</Link>
      </div>
    );
  }

  const conn = connectionProgress(client);
  const prac = practiceProgress(client);
  const fu = followupProgress(client);
  const block = completionBlock(client);
  const derived = derivedOverallStatus(client);
  const blockers = unresolvedBlockers(client);

  const onCopy = async () => {
    await copyToClipboard(buildCallSummary(client));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{client.businessName}</h1>
          <p className="text-sm text-muted-foreground">{client.clientName} · assigned to {client.assignedTeamMember}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Acting as</label>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={inputCls + " w-40"}>
            {state.settings.team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Record fields */}
      <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Business name"><input className={inputCls} defaultValue={client.businessName} onBlur={(e) => updateClient(client.id, { businessName: e.target.value }, actor)} /></Field>
        <Field label="Client name"><input className={inputCls} defaultValue={client.clientName} onBlur={(e) => updateClient(client.id, { clientName: e.target.value }, actor)} /></Field>
        <Field label="GHL location ID (optional)"><input className={inputCls} defaultValue={client.ghlLocationId ?? ""} placeholder="Optional" onBlur={(e) => updateClient(client.id, { ghlLocationId: e.target.value || undefined }, actor)} /></Field>
        <Field label="GHL link (optional)"><input className={inputCls} defaultValue={client.ghlLink ?? ""} placeholder="Optional" onBlur={(e) => updateClient(client.id, { ghlLink: e.target.value || undefined }, actor)} /></Field>
        <Field label="Assigned team member">
          <select className={inputCls} defaultValue={client.assignedTeamMember} onChange={(e) => updateClient(client.id, { assignedTeamMember: e.target.value }, actor)}>
            {state.settings.team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Call date"><input type="date" className={inputCls} defaultValue={client.callDate} onChange={(e) => updateClient(client.id, { callDate: e.target.value }, actor)} /></Field>
        <Field label="Plan / inclusions (manual)"><input className={inputCls} defaultValue={client.plan} onBlur={(e) => updateClient(client.id, { plan: e.target.value }, actor)} /></Field>
        <Field label="Next call date (optional)"><input type="date" className={inputCls} defaultValue={client.nextCallDate ?? ""} onChange={(e) => updateClient(client.id, { nextCallDate: e.target.value || undefined }, actor)} /></Field>
        <Field label="Overall status">
          <div className="flex items-center gap-2">
            <select className={inputCls} value={client.overallStatus} onChange={(e) => updateClient(client.id, { overallStatus: e.target.value as OverallStatus }, actor, "Manual status change")}>
              {OVERALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <StatusBadge status={derived} />
          </div>
        </Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><textarea className={inputCls} rows={2} defaultValue={client.notes ?? ""} onBlur={(e) => updateClient(client.id, { notes: e.target.value || undefined }, actor)} /></Field></div>
      </section>

      {/* Progress + completion block */}
      <section className="grid gap-3 sm:grid-cols-3">
        <ProgressCard title="Connection setup" done={conn.done} total={conn.total} />
        <ProgressCard title="Client practical skills" done={prac.done} total={prac.total} />
        <ProgressCard title="Follow-up / documentation" done={fu.done} total={fu.total} />
      </section>

      {!block.ok && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-medium text-destructive">Onboarding cannot be marked complete</div>
          <ul className="mt-1 list-disc pl-5 text-destructive/90">
            {block.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* A. ACCESS + B. CONNECTIONS */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">A. Access &amp; B. Connections</h2>
        <p className="mt-1 text-xs text-muted-foreground">A connected integration does NOT complete any practical task. Each connection has its own status, verifier and verification date.</p>
        <div className="mt-3 space-y-2">
          {client.connections.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{c.label}</div>
                <select
                  className={inputCls + " w-44"}
                  value={c.status}
                  onChange={(e) => setConnection(client.id, c.id, { status: e.target.value as ConnectionStatus }, actor)}
                >
                  {CONNECTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {c.status === "not_applicable" && (
                <input className={inputCls + " mt-2"} placeholder="Reason required (why N/A)" defaultValue={c.notApplicableReason ?? ""} onBlur={(e) => setConnection(client.id, c.id, { notApplicableReason: e.target.value }, actor, "N/A reason recorded")} />
              )}
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={inputCls} type="date" title="Verification date" defaultValue={c.verifiedAt?.slice(0, 10) ?? ""} onChange={(e) => setConnection(client.id, c.id, { verifiedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }, actor)} />
                <input className={inputCls} placeholder="Verifier" defaultValue={c.verifier ?? ""} onBlur={(e) => setConnection(client.id, c.id, { verifier: e.target.value || undefined }, actor)} />
                <input className={inputCls} placeholder="Notes (describe result, no private contact details)" defaultValue={c.notes ?? ""} onBlur={(e) => setConnection(client.id, c.id, { notes: e.target.value || undefined }, actor)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* C. CLIENT-LED PRACTICE */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">C. Client-led practice</h2>
        <p className="mt-1 text-xs text-muted-foreground">"Demonstrated by staff" does NOT count as client completion. To mark "Client completed" you must confirm the client performed the action, add an evidence/result note, and record the staff member + timestamp.</p>
        <div className="mt-3 space-y-2">
          {client.tasks.map((t) => {
            const isReview = t.id.endsWith("-5") || t.id.endsWith("-6");
            const proofValid = taskCompletionProofValid(t);
            const doneForOverall = isTaskDoneForOverall(t);
            return (
              <div key={t.id} className={"rounded-md border bg-background p-3 " + (t.status === "client_completed" && !proofValid ? "border-destructive/50" : "border-border")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{t.label}</div>
                  <select className={inputCls + " w-52"} value={t.status} onChange={(e) => setTask(client.id, t.id, { status: e.target.value as TaskStatus }, actor)}>
                    {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {t.status === "not_applicable" && (
                  <input className={inputCls + " mt-2"} placeholder="Reason required (why N/A) + reviewer acknowledgement" defaultValue={t.notApplicableReason ?? ""} onBlur={(e) => setTask(client.id, t.id, { notApplicableReason: e.target.value }, actor, "N/A reason recorded")} />
                )}
                {t.status === "client_completed" && (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!t.clientConfirmed} onChange={(e) => setTask(client.id, t.id, { clientConfirmed: e.target.checked }, actor, "Client confirmation recorded")} />
                      I confirm the client performed this action themselves
                    </label>
                    <textarea className={inputCls} rows={2} placeholder="Evidence / result note (describe the result, no private contact details)" defaultValue={t.evidence ?? ""} onBlur={(e) => setTask(client.id, t.id, { evidence: e.target.value, completedBy: actor, completedAt: new Date().toISOString() }, actor, "Evidence recorded")} />
                    {isReview && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Review outcome:</span>
                        <select className={inputCls + " w-52"} value={t.reviewOutcome ?? "unknown"} onChange={(e) => setTask(client.id, t.id, { reviewOutcome: e.target.value as ReviewOutcome }, actor)}>
                          {REVIEW_OUTCOMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <span className="text-xs text-muted-foreground">"Sent" ≠ "Receipt confirmed".</span>
                      </div>
                    )}
                    {!proofValid && (
                      <div className="text-xs text-destructive">Proof incomplete: client confirmation, evidence note, staff and timestamp are all required.</div>
                    )}
                  </div>
                )}
                {t.status === "demonstrated_by_staff" && (
                  <div className="mt-2 text-xs text-muted-foreground">Demonstrated by staff — this does NOT count as client completion.</div>
                )}
                {t.audit.length > 0 && <AuditTrail entries={t.audit} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* D. FOLLOW-UP */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">D. Follow-up</h2>
        <BlockerList client={client} actor={actor} onAdd={(input) => addBlocker(client.id, input, actor)} onUpdate={(id, patch, reason) => updateBlocker(client.id, id, patch, actor, reason)} />
        <GuideList client={client} actor={actor} guides={state.settings.guides} onSet={(guideId, patch, reason) => setGuide(client.id, guideId, patch, actor, reason)} />
      </section>

      {/* Call history */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Call history</h2>
          <button onClick={() => addCallSession(client.id, { date: new Date().toISOString().slice(0, 10), staffMember: actor, notes: "New call session" }, actor)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">+ Session</button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Multiple call sessions are preserved — previous results are never erased.</p>
        <div className="mt-3 space-y-2">
          {client.callSessions.length === 0 && <div className="text-sm text-muted-foreground">No call sessions recorded yet.</div>}
          {[...client.callSessions].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
            <div key={s.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{s.date}</div>
                <Link to="/clients/$clientId/call/$callId" params={{ clientId: client.id, callId: s.id }} className="text-primary underline">Open live-call view</Link>
              </div>
              <div className="text-xs text-muted-foreground">{s.staffMember}</div>
              {s.notes && <div className="mt-1 text-sm">{s.notes}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Copyable summary */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Call-summary draft</h2>
          <button onClick={onCopy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{copied ? "Copied!" : "Copy summary"}</button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">This is a record only. Copying does not send anything.</p>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-secondary/60 p-3 text-xs">{buildCallSummary(client)}</pre>
      </section>

      {/* Client audit trail */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Status-change audit trail</h2>
        <AuditTrail entries={client.audit} />
      </section>
    </div>
  );
}

function BlockerList({ client, actor, onAdd, onUpdate }: {
  client: Client;
  actor: string;
  onAdd: (input: { summary: string; owner: string; nextAction: string }) => void;
  onUpdate: (id: string, patch: Partial<Client["blockers"][number]>, reason?: string) => void;
}) {
  const [summary, setSummary] = useState("");
  const [owner, setOwner] = useState(actor);
  const [nextAction, setNextAction] = useState("");
  return (
    <div className="mt-3">
      <div className="text-sm font-medium">Unresolved issues &amp; blockers</div>
      <div className="mt-2 space-y-2">
        {client.blockers.length === 0 && <div className="text-sm text-muted-foreground">No blockers recorded.</div>}
        {client.blockers.map((b) => (
          <div key={b.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{b.summary}</div>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={b.resolved} onChange={(e) => onUpdate(b.id, { resolved: e.target.checked }, e.target.checked ? "Resolved" : "Reopened")} />
                Resolved
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Owner" defaultValue={b.owner} onBlur={(e) => onUpdate(b.id, { owner: e.target.value }, "Owner updated")} />
              <input className={inputCls} placeholder="Next action" defaultValue={b.nextAction} onBlur={(e) => onUpdate(b.id, { nextAction: e.target.value }, "Next action updated")} />
            </div>
            <AuditTrail entries={b.audit} />
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="New blocker summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <input className={inputCls} placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <input className={inputCls} placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </div>
      <button
        disabled={!summary.trim() || !owner.trim() || !nextAction.trim()}
        onClick={() => { onAdd({ summary, owner, nextAction }); setSummary(""); setNextAction(""); }}
        className="mt-2 rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50"
      >+ Add blocker</button>
    </div>
  );
}

function GuideList({ client, actor, guides, onSet }: {
  client: Client;
  actor: string;
  guides: { id: string; label: string; url?: string | undefined }[];
  onSet: (guideId: string, patch: Partial<Client["guides"][number]>, reason?: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-sm font-medium">How-to guides</div>
      <p className="mt-1 text-xs text-muted-foreground">Opening a guide link does NOT mark it sent. Record the send explicitly with date, channel and staff.</p>
      <div className="mt-2 space-y-2">
        {client.guides.map((g) => {
          const def = guides.find((d) => d.id === g.guideId);
          const label = def?.label ?? g.guideId;
          const url = def?.url;
          return (
            <div key={g.guideId} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{label}</div>
                <div className="flex items-center gap-2">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open guide</a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Guide link not added</span>
                  )}
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={g.sent}
                      onChange={(e) => onSet(g.guideId, { sent: e.target.checked, sentAt: e.target.checked ? new Date().toISOString() : undefined, sentBy: e.target.checked ? actor : undefined }, e.target.checked ? "Guide send recorded" : "Guide send cleared")}
                    />
                    Sent
                  </label>
                </div>
              </div>
              {g.sent && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input className={inputCls} type="date" defaultValue={g.sentAt?.slice(0, 10) ?? ""} onChange={(e) => onSet(g.guideId, { sentAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
                  <select className={inputCls} defaultValue={g.channel ?? "email"} onChange={(e) => onSet(g.guideId, { channel: e.target.value as GuideChannel })}>
                    {GUIDE_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input className={inputCls} placeholder="Sent by" defaultValue={g.sentBy ?? ""} onBlur={(e) => onSet(g.guideId, { sentBy: e.target.value || undefined })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressCard({ title, done, total }: { title: string; done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-end justify-between">
        <span className="font-display text-xl font-bold">{pct}%</span>
        <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function AuditTrail({ entries }: { entries: Client["audit"] }) {
  if (entries.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Audit trail ({entries.length})</summary>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
        {entries.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-2">
            <span className="text-foreground">{e.field}</span>: {e.from || "—"} → {e.to || "—"}
            {e.reason && <span> ({e.reason})</span>}
            <span className="block">{new Date(e.at).toLocaleString()} · {e.actor}</span>
          </li>
        ))}
      </ul>
    </details>
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