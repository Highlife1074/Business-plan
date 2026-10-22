"use client";

import EditTable from "./EditTable";
import { StringList } from "./ui";
import type { TabProps } from "./tab";
import type { Risk, Texts } from "@/lib/types";

const LEVELS = [
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "élevé", label: "Élevé" },
];

export default function SwotTab({ plan, update, askClaude }: TabProps) {
  const t = plan.texts;
  const setT = (patch: Partial<Texts>) => update((p) => ({ ...p, texts: { ...p.texts, ...patch } }));
  const blocks: { key: "strengths" | "weaknesses" | "opportunities" | "threats"; title: string; cls: string }[] = [
    { key: "strengths", title: "Points forts", cls: "pos" },
    { key: "weaknesses", title: "Points faibles", cls: "neg" },
    { key: "opportunities", title: "Opportunités", cls: "pos" },
    { key: "threats", title: "Menaces", cls: "warn" },
  ];
  const score = (l: string) => (l === "élevé" ? 3 : l === "moyen" ? 2 : 1);

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Analyse SWOT</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Challenge mon analyse SWOT : qu'est-ce qui manque ou est sous-estimé, notamment au regard des chiffres du plan et du marché local ?")}>
            Challenger avec Claude
          </button>
        </div>
      </div>
      <div className="swot" style={{ marginBottom: 16 }}>
        {blocks.map((b) => (
          <div className="card" key={b.key}>
            <h3 className={b.cls}>{b.title}</h3>
            <StringList items={t[b.key]} onChange={(items) => setT({ [b.key]: items })} />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Risques et plan de mitigation</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Quels sont les risques majeurs non identifiés dans mon plan ? Pour chacun, propose une probabilité, un impact chiffré si possible et une mesure de mitigation.")}>
            Identifier d&apos;autres risques
          </button>
        </div>
        <EditTable<Risk>
          rows={t.risks}
          onChange={(risks) => setT({ risks })}
          blank={{ risk: "Nouveau risque", probability: "moyen", impact: "moyen", mitigation: "" }}
          columns={[
            { key: "risk", label: "Risque", type: "text" },
            { key: "probability", label: "Probabilité", type: "select", options: LEVELS },
            { key: "impact", label: "Impact", type: "select", options: LEVELS },
            { key: "mitigation", label: "Mitigation", type: "text", width: 260 },
          ]}
          rowExtra={(r) => {
            const s = score(r.probability) * score(r.impact);
            return <span className={`badge ${s >= 6 ? "refusé" : s >= 3 ? "reçu" : "retenu"}`} title="Criticité = probabilité × impact">{s}</span>;
          }}
        />
      </div>

      <div className="card">
        <h2>Marché et concurrence</h2>
        <textarea rows={6} value={t.market} onChange={(e) => setT({ market: e.target.value })} />
      </div>

      <div className="card">
        <h2>Hypothèses clés</h2>
        <StringList items={t.keyAssumptions} onChange={(keyAssumptions) => setT({ keyAssumptions })} />
      </div>
    </>
  );
}
