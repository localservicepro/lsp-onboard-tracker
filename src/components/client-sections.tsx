import { useState } from "react";
import type {
  Client,
  AccessCheckItem,
  ConnectionItem,
  TaskItem,
  StaffVerificationItem,
  Blocker,
  GuideSentRecord,
  GuideLink,
  ConnectionStatus,
  TaskStatus,
  StaffVerificationStatus,
  ReviewOutcome,
  GuideChannel,
} from "../lib/types";
import {
  isAccessDone,
  isConnectionSatisfied,
  isTaskSatisfied,
  taskCompletionProofValid,
  isStaffVerificationDone,
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
  guideLabel,
  guideHasUrl,
} from "../lib/completion";
import {
  CONNECTION_STATUSES,
  TASK_STATUSES,
  STAFF_VERIFICATION_STATUSES,
  REVIEW_OUTCOMES,
  GUIDE_CHANNELS,
} from "../lib/types";

export const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]";

export function AuditTrail({ entries }: { entries: import("../lib/types").AuditEntry[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <details className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
        Audit trail ({entries.length} log{entries.length === 1 ? "" : "s"})
      </summary>
      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground pl-2 border-l border-border/80">
        {entries.map((e) => (
          <li key={e.id}>
            <span className="font-semibold text-foreground">{e.field}</span>: {e.from || "—"} →{" "}
            <span className="text-accent font-bold">{e.to || "—"}</span>
            {e.reason && <span className="italic text-muted-foreground"> ({e.reason})</span>}
            <span className="block text-[11px] text-muted-foreground/80 font-mono">
              {new Date(e.at).toLocaleString()} · {e.actor}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AccessSection({
  client,
  actor,
  onCheck,
}: {
  client: Client;
  actor: string;
  onCheck: (checkId: string, patch: Partial<AccessCheckItem>, reason?: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Section A</span>
          <h2 className="font-display text-lg font-bold text-foreground">Phone-App Access Checks</h2>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Verify the client personally logged into the mobile app and selected the correct business. Do not record passwords or credentials.
      </p>

      <div className="space-y-3">
        {client.accessChecks.map((a) => {
          const verified = isAccessDone(a);
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-4 transition-colors ${
                verified ? "border-chart-1/40 bg-chart-1/5" : "border-border bg-background"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 font-semibold text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.checked}
                    onChange={(e) =>
                      onCheck(
                        a.id,
                        {
                          checked: e.target.checked,
                          verifier: e.target.checked ? actor : undefined,
                          verifiedAt: e.target.checked ? new Date().toISOString() : undefined,
                        },
                        e.target.checked ? "Verified login" : "Unverified",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span>{a.label}</span>
                </label>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    verified ? "bg-chart-1/20 text-chart-1" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {verified ? "Verified" : "Pending"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-1">Staff Verifier:</span>
                  <input
                    className={inputCls}
                    defaultValue={a.verifier ?? ""}
                    onBlur={(e) => onCheck(a.id, { verifier: e.target.value || undefined }, "Verifier updated")}
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-1">Result / Observation Note:</span>
                  <input
                    className={inputCls}
                    placeholder="e.g. Observed client sign in via magic link"
                    defaultValue={a.resultNote ?? ""}
                    onBlur={(e) => onCheck(a.id, { resultNote: e.target.value || undefined }, "Note updated")}
                  />
                </div>
              </div>

              {a.audit.length > 0 && <AuditTrail entries={a.audit} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ConnectionsSection({
  client,
  actor,
  onSetConnection,
}: {
  client: Client;
  actor: string;
  onSetConnection: (connId: string, patch: Partial<ConnectionItem>, reason?: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Section B</span>
          <h2 className="font-display text-lg font-bold text-foreground">Integrations &amp; Connections</h2>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        A connected integration does NOT complete practical tasks. Required connections cannot remain unchecked. Any "Not applicable" requires an explicit reason and reviewer acknowledgement.
      </p>

      <div className="space-y-3">
        {client.connections.map((c) => {
          const isNa = c.status === "not_applicable";
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-4 ${
                c.status === "connected"
                  ? "border-chart-1/40 bg-chart-1/5"
                  : c.status === "blocked"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{c.label}</span>
                  {c.required ? (
                    <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                      Required
                    </span>
                  ) : (
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Optional
                    </span>
                  )}
                </div>
                <select
                  className={inputCls + " w-44 font-semibold"}
                  value={c.status}
                  onChange={(e) =>
                    onSetConnection(
                      c.id,
                      {
                        status: e.target.value as ConnectionStatus,
                        verifiedAt: e.target.value === "connected" ? (c.verifiedAt ?? new Date().toISOString()) : c.verifiedAt,
                        verifier: e.target.value === "connected" ? (c.verifier ?? actor) : c.verifier,
                      },
                      `Status changed to ${e.target.value}`,
                    )
                  }
                >
                  {CONNECTION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {isNa && (
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 p-3 space-y-2">
                  <div className="text-xs font-bold text-accent">Exemption Requirements (Reason + Reviewer Acknowledgement):</div>
                  <input
                    className={inputCls}
                    placeholder="Exemption reason (mandatory)..."
                    defaultValue={c.notApplicableReason ?? ""}
                    onBlur={(e) => onSetConnection(c.id, { notApplicableReason: e.target.value }, "Exemption reason recorded")}
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!c.acknowledgedByReviewer}
                      onChange={(e) => onSetConnection(c.id, { acknowledgedByReviewer: e.target.checked }, "Reviewer acknowledged N/A")}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <span>Reviewer Acknowledgement: I confirm this integration is not applicable.</span>
                  </label>
                </div>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-1">Verification Date:</span>
                  <input
                    type="date"
                    className={inputCls}
                    defaultValue={c.verifiedAt?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      onSetConnection(
                        c.id,
                        { verifiedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined },
                        "Date updated",
                      )
                    }
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-1">Verifier:</span>
                  <input
                    className={inputCls}
                    defaultValue={c.verifier ?? ""}
                    onBlur={(e) => onSetConnection(c.id, { verifier: e.target.value || undefined }, "Verifier updated")}
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-1">Notes:</span>
                  <input
                    className={inputCls}
                    defaultValue={c.notes ?? ""}
                    placeholder="Notes"
                    onBlur={(e) => onSetConnection(c.id, { notes: e.target.value || undefined }, "Notes updated")}
                  />
                </div>
              </div>

              {c.audit.length > 0 && <AuditTrail entries={c.audit} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PracticalSection({
  client,
  actor,
  onSetTask,
}: {
  client: Client;
  actor: string;
  onSetTask: (taskId: string, patch: Partial<TaskItem>, reason?: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Section C</span>
          <h2 className="font-display text-lg font-bold text-foreground">Client-Led Practical Tasks</h2>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        "Demonstrated by staff" does NOT count as client completion. To mark "Client completed", staff must confirm the client performed the action, provide a non-empty evidence note, staff member and timestamp.
      </p>

      <div className="space-y-3">
        {client.tasks.map((t) => {
          const isReviewSend = t.id.includes("-5") || t.label.toLowerCase().includes("sends the google review");
          const proofValid = taskCompletionProofValid(t);

          return (
            <div
              key={t.id}
              className={`rounded-xl border p-4 transition-colors ${
                t.status === "client_completed" && proofValid
                  ? "border-chart-1/40 bg-chart-1/5"
                  : t.status === "client_completed" && !proofValid
                  ? "border-destructive/60 bg-destructive/10"
                  : t.status === "demonstrated_by_staff"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm text-foreground">{t.label}</div>
                <select
                  className={inputCls + " w-56 font-semibold"}
                  value={t.status}
                  onChange={(e) => {
                    const st = e.target.value as TaskStatus;
                    onSetTask(
                      t.id,
                      {
                        status: st,
                        completedBy: st === "client_completed" ? (t.completedBy ?? actor) : t.completedBy,
                        completedAt: st === "client_completed" ? (t.completedAt ?? new Date().toISOString()) : t.completedAt,
                      },
                      `Status changed to ${st}`,
                    );
                  }}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {t.status === "demonstrated_by_staff" && (
                <div className="mt-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                  ⚠️ <strong>Staff demonstration only:</strong> this does NOT count as client completion.
                </div>
              )}

              {t.status === "not_applicable" && (
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 p-3 space-y-2">
                  <div className="text-xs font-bold text-accent">Task Exemption (Reason + Reviewer Acknowledgement):</div>
                  <input
                    className={inputCls}
                    placeholder="Exemption reason (mandatory)..."
                    defaultValue={t.notApplicableReason ?? ""}
                    onBlur={(e) => onSetTask(t.id, { notApplicableReason: e.target.value }, "N/A reason recorded")}
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!t.acknowledgedByReviewer}
                      onChange={(e) => onSetTask(t.id, { acknowledgedByReviewer: e.target.checked }, "Acknowledged N/A")}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <span>Reviewer Acknowledgement: I confirm this practical task is exempted.</span>
                  </label>
                </div>
              )}

              {t.status === "client_completed" && (
                <div className="mt-3 space-y-3 rounded-lg border border-border/80 bg-card/60 p-3">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                    <input
                      type="checkbox"
                      checked={!!t.clientConfirmed}
                      onChange={(e) => onSetTask(t.id, { clientConfirmed: e.target.checked }, "Client confirmation toggled")}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <span>Confirmation: I personally observed the client execute this task themselves</span>
                  </label>

                  <div>
                    <span className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Evidence / Result Note * (Mandatory — describe what was observed):
                    </span>
                    <textarea
                      className={inputCls}
                      rows={2}
                      placeholder="e.g. Client opened review flow, selected test contact and previewed SMS."
                      defaultValue={t.evidence ?? ""}
                      onBlur={(e) =>
                        onSetTask(
                          t.id,
                          {
                            evidence: e.target.value,
                            completedBy: actor,
                            completedAt: t.completedAt ?? new Date().toISOString(),
                          },
                          "Evidence note updated",
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Staff Member:</span>
                      <input
                        className={inputCls}
                        defaultValue={t.completedBy ?? actor}
                        onBlur={(e) => onSetTask(t.id, { completedBy: e.target.value }, "Staff updated")}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Completion Timestamp:</span>
                      <input
                        type="datetime-local"
                        className={inputCls}
                        defaultValue={t.completedAt ? t.completedAt.slice(0, 16) : ""}
                        onChange={(e) =>
                          onSetTask(
                            t.id,
                            { completedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined },
                            "Timestamp updated",
                          )
                        }
                      />
                    </div>
                  </div>

                  {isReviewSend && (
                    <div className="border-t border-border/60 pt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-accent">Review Outcome on Send:</span>
                      <select
                        className={inputCls + " w-48 font-semibold"}
                        value={t.reviewOutcome ?? "sent"}
                        onChange={(e) => onSetTask(t.id, { reviewOutcome: e.target.value as ReviewOutcome }, "Outcome updated")}
                      >
                        {REVIEW_OUTCOMES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!proofValid && (
                    <div className="rounded border border-destructive/40 bg-destructive/15 px-2.5 py-1.5 text-xs text-destructive font-medium">
                      Missing proof: Check confirmation box, supply non-empty evidence, staff verifier and timestamp.
                    </div>
                  )}
                </div>
              )}

              {t.audit.length > 0 && <AuditTrail entries={t.audit} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StaffVerificationSection({
  client,
  actor,
  onSetVerification,
}: {
  client: Client;
  actor: string;
  onSetVerification: (patch: Partial<StaffVerificationItem>, reason?: string) => void;
}) {
  const sv = client.staffVerification;
  const verified = isStaffVerificationDone(sv);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Section D</span>
          <h2 className="font-display text-lg font-bold text-foreground">Staff Verification of Recorded Result</h2>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            verified ? "bg-chart-1/20 text-chart-1" : "bg-secondary text-muted-foreground"
          }`}
        >
          {verified ? "Verified" : "Pending"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Staff-only check. Verify the outcome of actions recorded in LSP CRM. Do not ask client to confirm this.
      </p>

      <div className="rounded-xl border border-border bg-background p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-sm text-foreground">{sv.label}</span>
          <select
            className={inputCls + " w-48 font-semibold"}
            value={sv.status}
            onChange={(e) =>
              onSetVerification(
                {
                  status: e.target.value as StaffVerificationStatus,
                  verifier: e.target.value === "verified" ? (sv.verifier ?? actor) : sv.verifier,
                  verifiedAt: e.target.value === "verified" ? (sv.verifiedAt ?? new Date().toISOString()) : sv.verifiedAt,
                },
                `Status set to ${e.target.value}`,
              )
            }
          >
            {STAFF_VERIFICATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div>
            <span className="block text-[11px] font-semibold text-muted-foreground mb-1">Review Outcome in LSP:</span>
            <select
              className={inputCls}
              value={sv.reviewOutcome ?? "unknown"}
              onChange={(e) => onSetVerification({ reviewOutcome: e.target.value as ReviewOutcome }, "Outcome updated")}
            >
              {REVIEW_OUTCOMES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted-foreground mb-1">Staff Verifier:</span>
            <input
              className={inputCls}
              defaultValue={sv.verifier ?? actor}
              onBlur={(e) => onSetVerification({ verifier: e.target.value }, "Verifier updated")}
            />
          </div>
          <div className="sm:col-span-2">
            <span className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Result / Evidence Note * (Mandatory for verification):
            </span>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="e.g. Inspected conversation thread: request recorded, sent and receipt confirmed by recipient."
              defaultValue={sv.resultNote ?? ""}
              onBlur={(e) =>
                onSetVerification(
                  {
                    resultNote: e.target.value,
                    verifiedAt: sv.verifiedAt ?? new Date().toISOString(),
                  },
                  "Result note updated",
                )
              }
            />
          </div>
        </div>

        {sv.audit.length > 0 && <AuditTrail entries={sv.audit} />}
      </div>
    </section>
  );
}
