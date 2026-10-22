import { useState } from "react";
import type { Client, Blocker, GuideSentRecord, GuideLink, GuideChannel } from "../lib/types";
import {
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
  guideLabel,
  guideHasUrl,
} from "../lib/completion";
import { GUIDE_CHANNELS } from "../lib/types";
import { inputCls, AuditTrail } from "./client-sections";

// Guides section — separates "Guide sent" (requires valid URL/version + date +
// channel + staff) from "Verbal walkthrough" (separate, never counts as sent).
// A guide with no configured URL shows "Guide link not added" and cannot be
// marked Sent. It may be exempted only with a reason + reviewer acknowledgement.
export function GuidesSection({
  client,
  actor,
  guides,
  onSetGuide,
}: {
  client: Client;
  actor: string;
  guides: GuideLink[];
  onSetGuide: (guideId: string, patch: Partial<GuideSentRecord>, reason?: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2">
        <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Section E</span>
        <h2 className="font-display text-lg font-bold text-foreground">How-To Guides &amp; Documentation</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Opening a guide link does NOT mark it sent. Recording a guide as sent requires a valid supplied URL/version,
        date, delivery channel and staff member. A verbal walkthrough is recorded separately and never counts as a
        sent guide. A guide with no configured URL shows "Guide link not added" and cannot be marked Sent.
      </p>

      <div className="space-y-3">
        {client.guides.map((g) => {
          const label = guideLabel(g, guides);
          const url = guides.find((d) => d.id === g.guideId)?.url;
          const hasUrl = guideHasUrl(g, guides);
          const sentValid = isGuideSentValid(g, guides);
          const outstanding = isGuideOutstanding(g, guides);
          const exempt = isGuideExempt(g);

          return (
            <div
              key={g.guideId}
              className={`rounded-xl border p-4 ${
                sentValid
                  ? "border-chart-1/40 bg-chart-1/5"
                  : outstanding
                  ? "border-amber-500/40 bg-amber-500/5"
                  : exempt
                  ? "border-accent/30 bg-accent/10"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm text-foreground">{label}</div>
                <div className="flex items-center gap-3">
                  {hasUrl ? (
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
                </div>
              </div>

              {/* Guide sent — disabled when no URL */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={g.sent}
                    disabled={!hasUrl}
                    onChange={(e) =>
                      onSetGuide(
                        g.guideId,
                        {
                          sent: e.target.checked,
                          sentAt: e.target.checked ? (g.sentAt ?? new Date().toISOString()) : undefined,
                          sentBy: e.target.checked ? (g.sentBy ?? actor) : undefined,
                          channel: e.target.checked ? (g.channel ?? "email") : undefined,
                          suppliedUrlOrVersion: e.target.checked ? (g.suppliedUrlOrVersion ?? url ?? "") : undefined,
                        },
                        e.target.checked ? "Guide send recorded" : "Guide send cleared",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:opacity-40"
                  />
                  <span>Mark as Sent {hasUrl ? "" : "(disabled — no guide URL)"}</span>
                </label>
                {g.sent && !sentValid && (
                  <span className="rounded border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Invalid: missing URL/version, date, channel or staff
                  </span>
                )}
              </div>

              {g.sent && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="block text-[11px] text-muted-foreground mb-1">Date Sent:</span>
                    <input
                      type="date"
                      className={inputCls}
                      defaultValue={g.sentAt?.slice(0, 10) ?? ""}
                      onChange={(e) => onSetGuide(g.guideId, { sentAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }, actor)}
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground mb-1">Delivery Channel:</span>
                    <select
                      className={inputCls}
                      defaultValue={g.channel ?? "email"}
                      onChange={(e) => onSetGuide(g.guideId, { channel: e.target.value as GuideChannel }, actor)}
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
                      onBlur={(e) => onSetGuide(g.guideId, { sentBy: e.target.value }, actor)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <span className="block text-[11px] text-muted-foreground mb-1">Supplied URL / Version Recorded *:</span>
                    <input
                      className={inputCls}
                      placeholder={hasUrl ? url : "Enter the supplied URL or document version"}
                      defaultValue={g.suppliedUrlOrVersion ?? ""}
                      onBlur={(e) => onSetGuide(g.guideId, { suppliedUrlOrVersion: e.target.value }, actor)}
                    />
                  </div>
                </div>
              )}

              {/* Verbal walkthrough — separate activity */}
              <div className="mt-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Verbal Walkthrough (separate — does NOT count as a sent guide)
                </div>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={!!g.walkthroughProvided}
                    onChange={(e) =>
                      onSetGuide(
                        g.guideId,
                        {
                          walkthroughProvided: e.target.checked,
                          walkthroughAt: e.target.checked ? (g.walkthroughAt ?? new Date().toISOString()) : undefined,
                          walkthroughBy: e.target.checked ? (g.walkthroughBy ?? actor) : undefined,
                        },
                        e.target.checked ? "Verbal walkthrough recorded" : "Walkthrough cleared",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
                  />
                  <span>Verbal walkthrough provided on call</span>
                </label>
                {g.walkthroughProvided && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Walkthrough Date:</span>
                      <input
                        type="date"
                        className={inputCls}
                        defaultValue={g.walkthroughAt?.slice(0, 10) ?? ""}
                        onChange={(e) => onSetGuide(g.guideId, { walkthroughAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }, actor)}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Walkthrough By (Staff):</span>
                      <input
                        className={inputCls}
                        defaultValue={g.walkthroughBy ?? actor}
                        onBlur={(e) => onSetGuide(g.guideId, { walkthroughBy: e.target.value }, actor)}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <span className="block text-[11px] text-muted-foreground mb-1">Walkthrough Notes:</span>
                      <input
                        className={inputCls}
                        defaultValue={g.walkthroughNotes ?? ""}
                        onBlur={(e) => onSetGuide(g.guideId, { walkthroughNotes: e.target.value }, actor)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Exemption (reason + reviewer acknowledgement) */}
              <div className="mt-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Documented Exemption (only with reason + reviewer acknowledgement)
                </div>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={!!g.acknowledgedByReviewer && !!g.notApplicableReason?.trim()}
                    onChange={(e) =>
                      onSetGuide(
                        g.guideId,
                        { acknowledgedByReviewer: e.target.checked },
                        e.target.checked ? "Guide exemption acknowledged" : "Exemption cleared",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span>Reviewer acknowledges this guide is not applicable</span>
                </label>
                <input
                  className={inputCls + " mt-2"}
                  placeholder="Exemption reason (mandatory)..."
                  defaultValue={g.notApplicableReason ?? ""}
                  onBlur={(e) => onSetGuide(g.guideId, { notApplicableReason: e.target.value }, "Exemption reason recorded")}
                />
              </div>

              {g.audit.length > 0 && <AuditTrail entries={g.audit} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Blocker section — supports issue, owner, next action, due date, open/resolved,
// resolution note + timestamp. Reopening preserves the audit trail.
export function BlockerSection({
  client,
  actor,
  onAdd,
  onUpdate,
}: {
  client: Client;
  actor: string;
  onAdd: (input: { summary: string; owner: string; nextAction: string; dueDate?: string }) => void;
  onUpdate: (id: string, patch: Partial<Blocker>, reason?: string) => void;
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

          {b.resolved && (
            <div className="mt-2 text-xs">
              <span className="block text-[11px] text-muted-foreground mb-1">Resolution Note:</span>
              <input
                className={inputCls}
                placeholder="How was this resolved?"
                defaultValue={b.resolutionNote ?? ""}
                onBlur={(e) => onUpdate(b.id, { resolutionNote: e.target.value }, "Resolution note updated")}
              />
              {b.resolvedAt && <div className="mt-1 text-[11px] text-muted-foreground font-mono">Resolved at: {new Date(b.resolvedAt).toLocaleString()}</div>}
            </div>
          )}

          {b.audit.length > 0 && <AuditTrail entries={b.audit} />}
        </div>
      ))}

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