import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import {
  CONNECTION_STATUSES,
  TASK_STATUSES,
  STAFF_VERIFICATION_STATUSES,
  REVIEW_OUTCOMES,
  type ConnectionStatus,
  type TaskStatus,
  type StaffVerificationStatus,
  type ReviewOutcome,
} from "../lib/types";
import { buildCallSummary, copyToClipboard } from "../lib/call-summary";
import { inputCls } from "../components/client-sections";

export const Route = createFileRoute("/clients/$clientId/call/$callId")({
  head: () => ({
    meta: [
      { title: "Live Call Checklist — LSP Onboarding" },
      { name: "description", content: "Focused checklist usable during a live onboarding call." },
      { property: "og:title", content: "Live Call Checklist — LSP Onboarding" },
      { property: "og:description", content: "Focused checklist usable during a live onboarding call." },
    ],
  }),
  component: CallSessionPage,
});

function CallSessionPage() {
  const { clientId, callId } = Route.useParams();
  const {
    state,
    setAccessCheck,
    setConnection,
    setTask,
    setStaffVerification,
    updateCallSession,
  } = useStore();
  const client = state.clients.find((c) => c.id === clientId);
  const session = client?.callSessions.find((s) => s.id === callId);
  const [actor, setActor] = useState(state.settings.team[0]?.name ?? "Staff Member");
  const [copied, setCopied] = useState(false);

  if (!client || !session) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Call session not found.</p>
        <Link to="/clients/$clientId" params={{ clientId }} className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Return to Client Record
        </Link>
      </div>
    );
  }

  const onCopy = async () => {
    await copyToClipboard(buildCallSummary(client, state.settings.guides));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <Link to="/clients/$clientId" params={{ clientId }} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            ← Back to {client.businessName}
          </Link>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Live Call Session — {session.date}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Client: <span className="font-semibold text-foreground">{client.clientName}</span> · Staff:{" "}
            <span className="font-semibold text-foreground">{session.staffMember}</span>
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 cursor-pointer"
          >
            {copied ? "✓ Copied!" : "📋 Copy Call Summary"}
          </button>
        </div>
      </div>

      {/* Session Notes */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Call Session Notes &amp; Observations
          </span>
          <textarea
            className={inputCls}
            rows={3}
            placeholder="Record live call notes here..."
            defaultValue={session.notes ?? ""}
            onBlur={(e) => updateCallSession(client.id, session.id, { notes: e.target.value }, actor)}
          />
        </label>
      </div>

      {/* A. Phone-App Access */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">A. Phone-App Access Checks</h2>
        <div className="space-y-2">
          {client.accessChecks.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3.5">
              <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={a.checked}
                  onChange={(e) =>
                    setAccessCheck(
                      client.id,
                      a.id,
                      {
                        checked: e.target.checked,
                        verifier: e.target.checked ? actor : undefined,
                        verifiedAt: e.target.checked ? new Date().toISOString() : undefined,
                      },
                      actor,
                      e.target.checked ? "Verified during call" : "Unverified",
                    )
                  }
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <span>{a.label}</span>
              </label>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded ${a.checked ? "bg-chart-1/20 text-chart-1" : "bg-secondary text-muted-foreground"}`}>
                {a.checked ? "Verified" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* B. Connections */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">B. Integrations &amp; Connections</h2>
        <p className="text-xs text-muted-foreground">A connected integration does NOT automatically complete any practical task.</p>
        <div className="space-y-2">
          {client.connections.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span>{c.label}</span>
                {c.required && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary uppercase">Req</span>}
              </div>
              <select
                className={inputCls + " w-44 text-xs font-semibold"}
                value={c.status}
                onChange={(e) =>
                  setConnection(
                    client.id,
                    c.id,
                    {
                      status: e.target.value as ConnectionStatus,
                      verifiedAt: e.target.value === "connected" ? (c.verifiedAt ?? new Date().toISOString()) : c.verifiedAt,
                      verifier: e.target.value === "connected" ? (c.verifier ?? actor) : c.verifier,
                    },
                    actor,
                  )
                }
              >
                {CONNECTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* C. Client-Led Practice */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">C. Client-Led Practical Tasks</h2>
        <p className="text-xs text-muted-foreground">"Demonstrated by staff" does NOT count as client completion.</p>
        <div className="space-y-3">
          {client.tasks.map((t) => {
            const isReviewSend = t.id.includes("-5") || t.label.toLowerCase().includes("sends the google review");
            return (
              <div key={t.id} className="rounded-xl border border-border bg-background p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm text-foreground">{t.label}</span>
                  <select
                    className={inputCls + " w-52 text-xs font-semibold"}
                    value={t.status}
                    onChange={(e) => {
                      const st = e.target.value as TaskStatus;
                      setTask(
                        client.id,
                        t.id,
                        {
                          status: st,
                          completedBy: st === "client_completed" ? (t.completedBy ?? actor) : t.completedBy,
                          completedAt: st === "client_completed" ? (t.completedAt ?? new Date().toISOString()) : t.completedAt,
                        },
                        actor,
                      );
                    }}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {t.status === "client_completed" && (
                  <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!t.clientConfirmed}
                        onChange={(e) => setTask(client.id, t.id, { clientConfirmed: e.target.checked }, actor)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span>Confirmed: Client personally executed this task during call</span>
                    </label>
                    <textarea
                      className={inputCls}
                      rows={1}
                      placeholder="Evidence note observed during live call..."
                      defaultValue={t.evidence ?? ""}
                      onBlur={(e) => setTask(client.id, t.id, { evidence: e.target.value, completedBy: actor, completedAt: new Date().toISOString() }, actor)}
                    />
                    {isReviewSend && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-semibold">Review Outcome:</span>
                        <select
                          className={inputCls + " w-44"}
                          value={t.reviewOutcome ?? "sent"}
                          onChange={(e) => setTask(client.id, t.id, { reviewOutcome: e.target.value as ReviewOutcome }, actor)}
                        >
                          {REVIEW_OUTCOMES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* D. Staff Verification */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">D. Staff Verification</h2>
        <div className="rounded-xl border border-border bg-background p-3.5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-foreground">{client.staffVerification.label}</span>
            <select
              className={inputCls + " w-48 font-semibold"}
              value={client.staffVerification.status}
              onChange={(e) =>
                setStaffVerification(
                  client.id,
                  {
                    status: e.target.value as StaffVerificationStatus,
                    verifier: e.target.value === "verified" ? actor : client.staffVerification.verifier,
                    verifiedAt: e.target.value === "verified" ? new Date().toISOString() : client.staffVerification.verifiedAt,
                  },
                  actor,
                )
              }
            >
              {STAFF_VERIFICATION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Result note (e.g. Verified in conversations tab: review SMS sent, receipt confirmed)..."
            defaultValue={client.staffVerification.resultNote ?? ""}
            onBlur={(e) => setStaffVerification(client.id, { resultNote: e.target.value, verifier: actor, verifiedAt: new Date().toISOString() }, actor)}
          />
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-2">
        <Link to="/clients/$clientId" params={{ clientId }} className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary">
          Done &amp; Return to Client Detail
        </Link>
        <button onClick={onCopy} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20">
          {copied ? "✓ Summary Copied!" : "📋 Copy Call Summary"}
        </button>
      </div>
    </div>
  );
}
