"use client";

import type { Scenario } from "@/lib/types";
import type { TabProps } from "./tab";

const PRESETS: { label: string; s: Scenario }[] = [
  { label: "Pessimiste", s: { volumePct: 80, pricePct: 95, costPct: 110 } },
  { label: "Réaliste", s: { volumePct: 100, pricePct: 100, costPct: 100 } },
  { label: "Optimiste", s: { volumePct: 115, pricePct: 100, costPct: 97 } },
];

// Curseurs de sensibilité : s'appliquent à toute la projection sans toucher aux hypothèses de base.
export default function ScenarioBar({ plan, update }: Pick<TabProps, "plan" | "update">) {
  const sc = plan.params.scenario;
  const setSc = (s: Scenario) => update((p) => ({ ...p, params: { ...p.params, scenario: s } }));
  const active = PRESETS.find(
    (p) => p.s.volumePct === sc.volumePct && p.s.pricePct === sc.pricePct && p.s.costPct === sc.costPct,
  );
  const slider = (key: keyof Scenario, label: string, min: number, max: number) => (
    <label className="field" style={{ minWidth: 150, flex: 1 }}>
      {label} : <strong style={{ color: "var(--text)" }}>{sc[key]} %</strong>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={sc[key]}
        onChange={(e) => setSc({ ...sc, [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <div className="card no-print">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Scénario {active ? `: ${active.label.toLowerCase()}` : "personnalisé"}</strong>
        <div className="row">
          {PRESETS.map((p) => (
            <button key={p.label} className={`btn sm ${active === p ? "primary" : ""}`} onClick={() => setSc(p.s)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <details className="scenario-sliders" open={!active || undefined}>
        <summary className="small muted">
          Ajuster finement (volumes {sc.volumePct} % · prix {sc.pricePct} % · coûts {sc.costPct} %)
        </summary>
        <div className="row" style={{ gap: 16, marginTop: 8 }}>
          {slider("volumePct", "Volumes", 50, 150)}
          {slider("pricePct", "Prix", 70, 130)}
          {slider("costPct", "Coûts", 70, 130)}
        </div>
      </details>
    </div>
  );
}
