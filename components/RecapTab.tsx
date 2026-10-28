"use client";

import { useMemo } from "react";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import { CashChart, PaybackChart } from "./Charts";
import type { TabProps } from "./tab";
import { applyQuotes } from "@/lib/finance";
import { buildRecap, type Tone } from "@/lib/recap";
import { num } from "@/lib/format";

const STATUS: Record<Tone, { icon: string; label: string }> = {
  good: { icon: "✓", label: "OK" },
  warn: { icon: "!", label: "À surveiller" },
  bad: { icon: "✕", label: "Critique" },
};

function Status({ tone, withLabel = false }: { tone: Tone; withLabel?: boolean }) {
  const s = STATUS[tone];
  return (
    <span className={`status ${tone}`} title={s.label}>
      <span className="status-icon" aria-hidden>{s.icon}</span>
      {withLabel ? <span>{s.label}</span> : <span className="sr-only">{s.label}</span>}
    </span>
  );
}

// Fiche récap : une page, les critères regroupés par thème avec un feu par critère.
export default function RecapTab({ plan, proj, update }: TabProps) {
  const { fmt } = useMoney();
  const params = useMemo(() => applyQuotes(plan.params, plan.quotes), [plan.params, plan.quotes]);
  const recap = useMemo(() => buildRecap(params, proj, (v) => fmt(v)), [params, proj, fmt]);

  return (
    <>
      <ScenarioBar plan={plan} update={update} />

      <div className={`card recap-head tone-${recap.tone}`}>
        <div className="recap-score">
          <span className="score">{num(recap.score, 1)}</span>
          <span className="muted small">/ 10</span>
        </div>
        <div className="grow">
          <h2 style={{ marginBottom: 4 }}>Fiche récap</h2>
          <p style={{ marginBottom: 8 }}>{recap.verdict}</p>
          <div className="recap-pills">
            {recap.groups.map((g) => (
              <a key={g.id} href={`#recap-${g.id}`} className="recap-pill">
                <Status tone={g.tone} /> {g.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="recap-grid">
        {recap.groups.map((g) => (
          <div className="card recap-group" id={`recap-${g.id}`} key={g.id}>
            <div className="recap-group-head">
              <div>
                <h3>{g.title}</h3>
                <div className="muted small">{g.question}</div>
              </div>
              <Status tone={g.tone} withLabel />
            </div>
            <dl className="recap-items">
              {g.items.map((it) => (
                <div className="recap-item" key={it.label}>
                  <dt>
                    {it.tone ? <Status tone={it.tone} /> : <span className="status none" aria-hidden>·</span>}
                    {it.label}
                  </dt>
                  <dd>
                    <strong>{it.value}</strong>
                    <span className="muted small">{it.hint}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="grid grid-charts">
        <div className="card">
          <h2>Trésorerie fin de mois</h2>
          <CashChart proj={proj} />
        </div>
        <div className="card">
          <h2>Retour sur investissement</h2>
          <PaybackChart proj={proj} />
        </div>
      </div>
      <p className="muted small">
        Repères indicatifs (usages bancaires courants). ✓ OK · ! À surveiller · ✕ Critique. Le détail de chaque critère est dans les onglets Résultats, Trésorerie et Point mort.
      </p>
    </>
  );
}
