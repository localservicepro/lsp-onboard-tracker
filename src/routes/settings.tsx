import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../lib/store";
import type { GuideChannel } from "../lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LSP Onboarding Checklist" },
      { name: "description", content: "Configure how-to guide links, team members and checklist templates." },
      { property: "og:title", content: "Settings — LSP Onboarding Checklist" },
      { property: "og:description", content: "Configure how-to guide links, team members and checklist templates." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, addGuide, updateGuide, removeGuide, addTeamMember, removeTeamMember, addTemplate, removeTemplate, reset } = useStore();
  const [guideLabel, setGuideLabel] = useState("");
  const [guideUrl, setGuideUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [tplName, setTplName] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Guide links, team members and reusable checklist templates.</p>
      </div>

      {/* Guides */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">How-to guide links</h2>
        <p className="mt-1 text-xs text-muted-foreground">If a link is unavailable, the client detail shows "Guide link not added". Do not invent a URL.</p>
        <div className="mt-3 space-y-2">
          {state.settings.guides.map((g) => (
            <div key={g.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input className={inputCls} defaultValue={g.label} onBlur={(e) => updateGuide(g.id, { label: e.target.value })} />
                <button onClick={() => removeGuide(g.id)} className="text-xs text-destructive underline">Remove</button>
              </div>
              <input className={inputCls + " mt-2"} placeholder="Guide URL (leave empty if not added)" defaultValue={g.url ?? ""} onBlur={(e) => updateGuide(g.id, { url: e.target.value || undefined })} />
              {!g.url && <div className="mt-1 text-xs text-muted-foreground">Guide link not added</div>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="New guide label" value={guideLabel} onChange={(e) => setGuideLabel(e.target.value)} />
          <input className={inputCls} placeholder="URL (optional)" value={guideUrl} onChange={(e) => setGuideUrl(e.target.value)} />
          <button
            disabled={!guideLabel.trim()}
            onClick={() => { addGuide(guideLabel, guideUrl || undefined); setGuideLabel(""); setGuideUrl(""); }}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >+ Add guide</button>
        </div>
      </section>

      {/* Team */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Team members</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.settings.team.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm">
              {t.name}
              <button onClick={() => removeTeamMember(t.id)} className="text-xs text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="Team member name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <button disabled={!teamName.trim()} onClick={() => { addTeamMember(teamName); setTeamName(""); }} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Add</button>
        </div>
      </section>

      {/* Templates */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Checklist templates</h2>
        <p className="mt-1 text-xs text-muted-foreground">Reusable connection + task sets. New clients start from the default template.</p>
        <div className="mt-3 space-y-2">
          {state.settings.templates.map((t) => (
            <div key={t.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{t.name}</div>
                <button onClick={() => removeTemplate(t.id)} className="text-xs text-destructive underline">Remove</button>
              </div>
              {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
              <div className="mt-1 text-xs text-muted-foreground">{t.connectionLabels.length} connections · {t.taskLabels.length} tasks</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="New template name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
          <button disabled={!tplName.trim()} onClick={() => { addTemplate(tplName); setTplName(""); }} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Add template</button>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold">Reset demo data</h2>
        <p className="mt-1 text-xs text-muted-foreground">Restores the synthetic seed data. Real records are not persisted — this is a prototype.</p>
        <button onClick={reset} className="mt-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">Reset to synthetic demo data</button>
      </section>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

// keep type import referenced
export type { GuideChannel };