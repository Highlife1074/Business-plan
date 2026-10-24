"use client";

import { MoneyNum, useMoney } from "./CurrencyProvider";
import { Num } from "./ui";
import type { Params, VariableCost } from "@/lib/types";
import { num } from "@/lib/format";
import { uid } from "@/lib/uid";

// Charges variables : proportionnelles au CA (%) ou au nombre d'unités vendues (montant par unité),
// pour toutes les lignes de CA ou une ligne en particulier.
export default function VariableCostsCard({
  params,
  setP,
  askClaude,
}: {
  params: Params;
  setP: (patch: Partial<Params>) => void;
  askClaude: (q: string) => void;
}) {
  const { fmt, display } = useMoney();
  const rows = params.variableCosts ?? [];
  const streams = params.revenueStreams;
  const setRows = (variableCosts: VariableCost[]) => setP({ variableCosts });
  const set = (id: string, patch: Partial<VariableCost>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Ordre de grandeur mensuel en régime de croisière (hors saisonnalité et montée en charge)
  const monthly = (vc: VariableCost) =>
    streams
      .filter((s) => !vc.streamId || vc.streamId === s.id)
      .reduce((a, s) => {
        const units = s.unitsPerDay * s.openDaysPerMonth;
        return a + (vc.mode === "unit" ? units * vc.value : units * s.unitPrice * (vc.value / 100));
      }, 0);
  const revenue = streams.reduce((a, s) => a + s.unitPrice * s.unitsPerDay * s.openDaysPerMonth, 0);
  const total = rows.reduce((a, r) => a + monthly(r), 0);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Charges variables</h2>
        <button
          className="btn sm no-print"
          onClick={() => askClaude("Vérifie mes charges variables (matières, consommables, commissions, énergie…) : en manque-t-il pour cette activité et ce pays, et les taux ou coûts par unité sont-ils réalistes ? Corrige-les directement si besoin.")}
        >
          Vérifier avec Claude
        </button>
      </div>
      <p className="muted small">
        Coûts qui suivent l&apos;activité : en % du chiffre d&apos;affaires (commissions, frais de paiement…) ou en montant par unité
        vendue (matières premières, emballages, consommables…), pour toutes les lignes de CA ou une seule.
      </p>
      <div className="table-wrap">
        <table className="edit cards">
          <thead>
            <tr>
              <th>Charge</th>
              <th>Calcul</th>
              <th>Valeur</th>
              <th>S&apos;applique à</th>
              <th>≈ / mois</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Charge"><input value={r.label} onChange={(e) => set(r.id, { label: e.target.value })} /></td>
                <td data-label="Calcul">
                  <select value={r.mode} onChange={(e) => set(r.id, { mode: e.target.value as VariableCost["mode"] })}>
                    <option value="pct">% du CA</option>
                    <option value="unit">par unité vendue</option>
                  </select>
                </td>
                <td data-label="Valeur" style={{ minWidth: 120 }}>
                  {r.mode === "pct" ? (
                    <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                      <Num value={r.value} onChange={(v) => set(r.id, { value: v })} /> <span className="muted">%</span>
                    </div>
                  ) : (
                    <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                      <MoneyNum value={r.value} onChange={(v) => set(r.id, { value: v })} /> <span className="muted small">{display}</span>
                    </div>
                  )}
                </td>
                <td data-label="S'applique à">
                  <select value={r.streamId ?? ""} onChange={(e) => set(r.id, { streamId: e.target.value || null })}>
                    <option value="">Toutes les lignes</option>
                    {streams.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td data-label="≈ / mois">{fmt(monthly(r))}</td>
                <td data-label="Note" style={{ minWidth: 180 }}><input value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} /></td>
                <td className="actions">
                  <button className="btn sm" title="Supprimer" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>✕</button>
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>
                Total mensuel en régime de croisière {revenue > 0 && <span className="muted">({num((total / revenue) * 100, 1)} % du CA)</span>}
              </td>
              <td>{fmt(total)}</td>
              <td colSpan={2}>{fmt(total * 12)} / an</td>
            </tr>
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted small">Aucune charge variable : la marge brute est égale au chiffre d&apos;affaires.</p>}
      <button
        className="btn sm"
        style={{ marginTop: 8 }}
        onClick={() => setRows([...rows, { id: uid(), label: "Nouvelle charge variable", mode: "pct", value: 0, streamId: null, note: "" }])}
      >
        + Ajouter une charge variable
      </button>
    </div>
  );
}
