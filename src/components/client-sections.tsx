import type {
  Call,
  CallItem,
  CallGuideRecord,
  GuideLink,
  ItemStatus,
  ReviewOutcome,
  GuideChannel,
  AuditEntry,
} from "../lib/types";
import {
  isItemDone,
  isItemExempt,
  itemStatusLabel,
  effectiveItem,
  guideDerivedStatus,
  guideLabel,
  guideHasUrl,
  guideUrl,
  isGuideSentValid,
  isGuideExempt,
  isGuideOutstanding,
} from "../lib/completion";
import {
  CLIENT_ACTION_STATUSES,
  STAFF_CHECK_STATUSES,
  REVIEW_OUTCOMES,
  GUIDE_CHANNELS,
} from "../lib/types";

export const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-accent min-h-[40px]";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <details className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2">
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

const STATUS_TONE: Record<ItemStatus, string> = {
  not_checked: "border-border bg-background",
  done: "border-chart-1/40 bg-chart-1/5",
  needs_help: "border-destructive/40 bg-destructive/5",
  not_applicable: "border-accent/30 bg-accent/10",
};

const STATUS_BADGE: Record<ItemStatus, string> = {
  not_checked: "bg-secondary text-muted-foreground",
  done: "bg-chart-1/20 text-chart-1",
  needs_help: "bg-destructive/15 text-destructive",
  not_applicable: "bg-accent/20 text-accent",
};

// A compact, single-row checklist item. Staff identity + timestamps are
// recorded automatically and hidden under an expandable "Details" control —
// not repeated beneath every task.
export function CallItemRow({
  item,
  actor,
  onSet,
}: {
  item: CallItem;
  actor: string;
  onSet: (patch: Partial<CallItem>, reason?: string) => void;
}) {
  const isClientAction = item.kind === "client_action";
  const statuses = isClientAction ? CLIENT_ACTION_STATUSES : STAFF_CHECK_STATUSES;
  const done = isItemDone(item);
  const exempt = isItemExempt(item);

  const setStatus = (st: ItemStatus) =>
    onSet(
      {
        status: st,
        completedBy: st === "done" ? (item.completedBy ?? actor) : item.completedBy,
        completedAt: st === "done" ? (item.completedAt ?? new Date().toISOString()) : item.completedAt,
      },
      `Status → ${st}`,
    );

  return (
    <div className={`rounded-xl border p-3 transition-colors ${STATUS_TONE[item.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isClientAction ? "text-accent" : "text-primary"}`}
          >
            {isClientAction ? "Client" : "Staff"}
          </span>
          <span className="truncate text-sm font-bold text-foreground">{item.label}</span>
          {item.required ? (
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
              Req
            </span>
          ) : (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Opt
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_BADGE[item.status]}`}>
            {itemStatusLabel(item)}
          </span>
          <select
            className={inputCls + " w-auto font-semibold"}
            value={item.status}
            onChange={(e) => setStatus(e.target.value as ItemStatus)}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Done: short result/verification note (mandatory evidence for client actions) */}
      {item.status === "done" && (
        <div className="mt-2.5 space-y-2">
          <div>
            <span className="block text-[11px] text-muted-foreground mb-1">
              {isClientAction
                ? "Result / observation note * (mandatory):"
                : "Verification note:"}
            </span>
            <textarea
              className={inputCls}
              rows={1}
              placeholder={
                isClientAction
                  ? "e.g. Client opened review flow, selected test contact and previewed SMS."
                  : "Brief verification note..."
              }
              defaultValue={item.evidence ?? ""}
              onBlur={(e) =>
                onSet(
                  {
                    evidence: e.target.value,
                    completedBy: actor,
                    completedAt: item.completedAt ?? new Date().toISOString(),
                  },
                  "Evidence note updated",
                )
              }
            />
          </div>
          {isClientAction && !done && (
            <div className="rounded border border-destructive/40 bg-destructive/15 px-2.5 py-1.5 text-xs text-destructive font-medium">
              Missing result note — client completion not valid yet.
            </div>
          )}
          {item.reviewSend && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              <span className="text-xs font-semibold text-accent">Review Outcome:</span>
              <select
                className={inputCls + " w-auto"}
                value={item.reviewOutcome ?? "sent"}
                onChange={(e) =>
                  onSet({ reviewOutcome: e.target.value as ReviewOutcome }, "Review outcome updated")
                }
              >
                {REVIEW_OUTCOMES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">"Sent" ≠ "Receipt confirmed".</span>
            </div>
          )}
        </div>
      )}

      {/* Needs help: issue + next action (owner auto = actor) */}
      {item.status === "needs_help" && (
        <div className="mt-2.5 space-y-2">
          <div>
            <span className="block text-[11px] text-destructive mb-1">Issue * (required):</span>
            <input
              className={inputCls}
              placeholder="Describe the issue..."
              defaultValue={item.issue ?? ""}
              onBlur={(e) => onSet({ issue: e.target.value }, "Issue recorded")}
            />
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground mb-1">Next action:</span>
            <input
              className={inputCls}
              placeholder="What needs to happen next..."
              defaultValue={item.nextAction ?? ""}
              onBlur={(e) => onSet({ nextAction: e.target.value }, "Next action recorded")}
            />
          </div>
        </div>
      )}

      {/* Not applicable: reason + reviewer ack */}
      {item.status === "not_applicable" && (
        <div className="mt-2.5 space-y-2">
          <input
            className={inputCls}
            placeholder="Exemption reason (mandatory)..."
            defaultValue={item.notApplicableReason ?? ""}
            onBlur={(e) => onSet({ notApplicableReason: e.target.value }, "N/A reason recorded")}
          />
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={!!item.acknowledgedByReviewer}
              onChange={(e) =>
                onSet({ acknowledgedByReviewer: e.target.checked }, "Reviewer acknowledged N/A")
              }
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <span>Reviewer acknowledges this is not applicable.</span>
          </label>
          {!exempt && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              Reason and acknowledgement required for a valid exemption.
            </div>
          )}
        </div>
      )}

      {/* Hidden metadata + audit under Details */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-foreground">
          Details
          {item.completedBy && (
            <span className="ml-1 text-muted-foreground/70">
              · {item.completedBy}
              {item.completedAt && ` · ${new Date(item.completedAt).toLocaleString()}`}
            </span>
          )}
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
          <div>
            <span className="block text-[11px] text-muted-foreground mb-1">Staff:</span>
            <input
              className={inputCls}
              defaultValue={item.completedBy ?? actor}
              onBlur={(e) => onSet({ completedBy: e.target.value }, "Staff updated")}
            />
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground mb-1">Timestamp:</span>
            <input
              type="datetime-local"
              className={inputCls}
              defaultValue={item.completedAt ? item.completedAt.slice(0, 16) : ""}
              onChange={(e) =>
                onSet(
                  { completedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined },
                  "Timestamp updated",
                )
              }
            />
          </div>
        </div>
        {item.audit.length > 0 && <AuditTrail entries={item.audit} />}
      </details>
    </div>
  );
}

// Auto-derived staff_check (e.g. "Required how-to guides supplied").
// Read-only: its status is computed from the call's guide records.
export function GuideDerivedRow({
  call,
  item,
  guides,
}: {
  call: Call;
  item: CallItem;
  guides: GuideLink[];
}) {
  const eff = effectiveItem(call, item, guides);
  const derived = guideDerivedStatus(call, item, guides);
  const outstanding = call.guides.filter((g) => isGuideOutstanding(g, guides));
  const exemptGuides = call.guides.filter((g) => isGuideExempt(g));
  const sentValid = call.guides.filter((g) => isGuideSentValid(g, guides));

  return (
    <div className={`rounded-xl border p-3 ${STATUS_TONE[eff.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
            Staff
          </span>
          <span className="truncate text-sm font-bold text-foreground">{item.label}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Auto
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_BADGE[eff.status]}`}>
          {itemStatusLabel(eff)}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Auto-calculated from guide records — not editable directly. Done only when every required
        guide is sent with valid delivery details or explicitly exempted.
      </p>
      {derived !== "done" && outstanding.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-300">
          <span className="font-bold">Outstanding guides:</span>{" "}
          {outstanding.map((g) => guideLabel(g, guides) + (guideHasUrl(g, guides) ? "" : " [link not added]")).join("; ")}
        </div>
      )}
      {derived === "done" && (
        <div className="mt-2 text-xs text-chart-1">
          ✓ {sentValid.length} guide(s) sent{exemptGuides.length > 0 ? `, ${exemptGuides.length} exempted` : ""}.
        </div>
      )}
    </div>
  );
}

export function CallGuidesSection({
  call,
  actor,
  guides,
  onSetGuide,
}: {
  call: Call;
  actor: string;
  guides: GuideLink[];
  onSetGuide: (guideId: string, patch: Partial<CallGuideRecord>, reason?: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold text-foreground">How-To Guides</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Opening a guide does NOT mark it sent. "Mark sent" requires a valid supplied link, date,
        channel and staff. A verbal walkthrough is recorded separately and never counts as a sent
        guide. A missing guide cannot be marked sent.
      </p>
      <div className="mt-3 space-y-3">
        {call.guides.map((g) => {
          const label = guideLabel(g, guides);
          const url = guideUrl(g, guides);
          const hasUrl = guideHasUrl(g, guides);
          const sentValid = isGuideSentValid(g, guides);
          const outstanding = isGuideOutstanding(g, guides);
          const exempt = isGuideExempt(g);

          return (
            <div
              key={g.guideId}
              className={`rounded-xl border p-3 ${sentValid ? "border-chart-1/40 bg-chart-1/5" : outstanding ? "border-amber-500/40 bg-amber-500/5" : exempt ? "border-accent/30 bg-accent/10" : "border-border bg-background"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{label}</div>
                {hasUrl ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                  >
                    Open Guide Link ↗
                  </a>
                ) : (
                  <span className="rounded bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                    Guide link not added
                  </span>
                )}
              </div>

              {/* Mark sent — disabled when no URL */}
              <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5">
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
                          suppliedUrlOrVersion: e.target.checked
                            ? (g.suppliedUrlOrVersion ?? url ?? "")
                            : undefined,
                        },
                        e.target.checked ? "Guide send recorded" : "Guide send cleared",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:opacity-40"
                  />
                  <span>Mark as Sent{hasUrl ? "" : " (disabled — no guide URL)"}</span>
                </label>
                {g.sent && !sentValid && (
                  <span className="rounded border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Invalid: missing link/date/channel/staff
                  </span>
                )}
              </div>

              {g.sent && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="block text-[11px] text-muted-foreground mb-1">Date Sent:</span>
                    <input
                      type="date"
                      className={inputCls}
                      defaultValue={g.sentAt?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        onSetGuide(
                          g.guideId,
                          { sentAt: e.target.value ? new Date(e.target.value).toISOString() : undefined },
                          actor,
                        )
                      }
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground mb-1">Channel:</span>
                    <select
                      className={inputCls}
                      defaultValue={g.channel ?? "email"}
                      onChange={(e) =>
                        onSetGuide(g.guideId, { channel: e.target.value as GuideChannel }, actor)
                      }
                    >
                      {GUIDE_CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground mb-1">Sent By:</span>
                    <input
                      className={inputCls}
                      defaultValue={g.sentBy ?? actor}
                      onBlur={(e) => onSetGuide(g.guideId, { sentBy: e.target.value }, actor)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <span className="block text-[11px] text-muted-foreground mb-1">
                      Supplied URL / Version *:
                    </span>
                    <input
                      className={inputCls}
                      placeholder={hasUrl ? url : "Enter the supplied URL or document version"}
                      defaultValue={g.suppliedUrlOrVersion ?? ""}
                      onBlur={(e) =>
                        onSetGuide(g.guideId, { suppliedUrlOrVersion: e.target.value }, actor)
                      }
                    />
                  </div>
                </div>
              )}

              {/* Verbal walkthrough — separate */}
              <div className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2.5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Verbal Walkthrough (separate — does NOT count as sent)
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
                          walkthroughAt: e.target.checked
                            ? (g.walkthroughAt ?? new Date().toISOString())
                            : undefined,
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
                      <span className="block text-[11px] text-muted-foreground mb-1">Date:</span>
                      <input
                        type="date"
                        className={inputCls}
                        defaultValue={g.walkthroughAt?.slice(0, 10) ?? ""}
                        onChange={(e) =>
                          onSetGuide(
                            g.guideId,
                            {
                              walkthroughAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : undefined,
                            },
                            actor,
                          )
                        }
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">By:</span>
                      <input
                        className={inputCls}
                        defaultValue={g.walkthroughBy ?? actor}
                        onBlur={(e) =>
                          onSetGuide(g.guideId, { walkthroughBy: e.target.value }, actor)
                        }
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <span className="block text-[11px] text-muted-foreground mb-1">Notes:</span>
                      <input
                        className={inputCls}
                        defaultValue={g.walkthroughNotes ?? ""}
                        onBlur={(e) =>
                          onSetGuide(g.guideId, { walkthroughNotes: e.target.value }, actor)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Exemption */}
              <div className="mt-2.5 rounded-lg border border-border/60 bg-card/40 p-2.5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Documented Exemption (reason + reviewer ack)
                </div>
                <input
                  className={inputCls}
                  placeholder="Exemption reason..."
                  defaultValue={g.notApplicableReason ?? ""}
                  onBlur={(e) =>
                    onSetGuide(g.guideId, { notApplicableReason: e.target.value }, actor)
                  }
                />
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!g.acknowledgedByReviewer}
                    onChange={(e) =>
                      onSetGuide(g.guideId, { acknowledgedByReviewer: e.target.checked }, actor)
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span>Reviewer acknowledges this exemption.</span>
                </label>
              </div>

              {g.audit.length > 0 && <AuditTrail entries={g.audit} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}