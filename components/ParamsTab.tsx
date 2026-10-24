"use client";

import EditTable from "./EditTable";
import ScenarioBar from "./ScenarioBar";
import VariableCostsCard from "./VariableCostsCard";
import { MoneyNum, RateStatus, useMoney } from "./CurrencyProvider";
import { Num } from "./ui";
import type { TabProps } from "./tab";
import type { FixedCost, Investment, Loan, Params, RevenueStream, StaffLine } from "@/lib/types";
import { applyQuotes } from "@/lib/finance";
import { num } from "@/lib/format";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export default function ParamsTab({ plan, proj, update, askClaude }: TabProps) {
  const p = plan.params;
  const cur = plan.meta.currency;
  const money_ = useMoney();
  const dc = money_.display; // devise d'affichage et de saisie
  const m = (v: number) => money_.fmt(v);
  // Totaux : montant dans la devise du plan, suivi de l'équivalent dans la devise d'affichage
  const mt = m;
  const setP = (patch: Partial<Params>) => update((pl) => ({ ...pl, params: { ...pl.params, ...patch } }));
  const effective = applyQuotes(p, plan.quotes);
  const overridden = (id: string, base: number, eff: number) =>
    base !== eff ? <span className="badge retenu" title="Montant remplacé par un devis retenu">devis : {m(eff)}</span> : null;

  const general: { key: keyof Params; label: string; step?: number }[] = [
    { key: "horizonYears", label: "Horizon (années)", step: 1 },
    { key: "vatRatePct", label: "TVA (%)" },
    { key: "corporateTaxPct", label: "Impôt sur les sociétés (%)" },
    { key: "employerChargesPct", label: "Charges patronales (% du brut)" },
    { key: "inflationPct", label: "Inflation / indexation (%/an)" },
    { key: "discountRatePct", label: "Taux d'actualisation VAN (%)" },
    { key: "rampUpMonths", label: "Montée en charge (mois)", step: 1 },
    { key: "rampUpStartPct", label: "Activité au 1er mois (%)" },
  ];

  const totalInv = proj.indicators.totalInvestment;
  const seasonAvg = p.seasonality.reduce((a, b) => a + b, 0) / 12;

  return (
    <>
      <div className="card">
        <p className="muted small" style={{ margin: 0 }}>
          Toutes les hypothèses du plan sont ici. Chaque modification met à jour immédiatement le sommaire, les résultats,
          la trésorerie et le point mort. Montants hors taxes, en {dc}.
        </p>
      </div>

      <ScenarioBar plan={plan} update={update} />

      <div className="card">
        <h2>Paramètres généraux</h2>
        <div className="grid grid-kpi">
          <label className="field">
            Nom du projet
            <input value={plan.meta.name} onChange={(e) => update((pl) => ({ ...pl, meta: { ...pl.meta, name: e.target.value } }))} />
          </label>
          <label className="field">
            Devise des montants
            <select value={money_.requested} onChange={(e) => money_.setDisplay(e.target.value)}>
              {money_.options.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                  {c.code === cur ? " (devise du plan)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Début d&apos;activité
            <input type="month" value={p.startDate} onChange={(e) => e.target.value && setP({ startDate: e.target.value })} />
          </label>
          {general.map((g) => (
            <label className="field" key={g.key}>
              {g.label}
              <Num value={p[g.key] as number} step={g.step} onChange={(v) => setP({ [g.key]: v } as Partial<Params>)} />
            </label>
          ))}
        </div>
        <RateStatus />
      </div>

      <div className="card">
        <h2>Saisonnalité</h2>
        <p className="muted small">Coefficient par mois (1 = mois moyen). Moyenne actuelle : {num(seasonAvg, 2)}.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))" }}>
          {MONTHS.map((label, i) => (
            <label className="field" key={label}>
              {label}
              <Num value={p.seasonality[i] ?? 1} onChange={(v) => setP({ seasonality: p.seasonality.map((x, j) => (j === i ? v : x)) })} />
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Chiffre d&apos;affaires</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Analyse mes hypothèses de chiffre d'affaires (prix, volumes, jours d'ouverture, coûts variables) : sont-elles réalistes pour ce pays et cette activité ? Propose des valeurs corrigées si besoin.")}>
            Vérifier avec Claude
          </button>
        </div>
        <EditTable<RevenueStream>
          rows={p.revenueStreams}
          onChange={(rows) => setP({ revenueStreams: rows })}
          blank={{ label: "Nouvelle ligne", unitLabel: "unité", unitPrice: 0, unitsPerDay: 0, openDaysPerMonth: 26, variableCostPct: 0, growthPct: 3, note: "" }}
          columns={[
            { key: "label", label: "Ligne de revenu", type: "text" },
            { key: "unitLabel", label: "Unité", type: "text", width: 90 },
            { key: "unitPrice", label: `Prix HT (${dc})`, type: "money" },
            { key: "unitsPerDay", label: "Unités / jour", type: "number" },
            { key: "openDaysPerMonth", label: "Jours / mois", type: "number" },
            { key: "growthPct", label: "Croissance %/an", type: "number" },
            { key: "note", label: "Note", type: "text", width: 200 },
          ]}
          footer={
            <tr className="total">
              <td colSpan={7}>
                CA mensuel en régime de croisière (hors saisonnalité) :{" "}
                {mt(p.revenueStreams.reduce((a, s) => a + s.unitPrice * s.unitsPerDay * s.openDaysPerMonth, 0))}
              </td>
              <td></td>
            </tr>
          }
        />
      </div>

      <VariableCostsCard params={p} setP={setP} askClaude={askClaude} />

      <div className="card">
        <h2>Charges fixes mensuelles</h2>
        <EditTable<FixedCost>
          rows={p.fixedCosts}
          onChange={(rows) => setP({ fixedCosts: rows })}
          blank={{ label: "Nouvelle charge", monthly: 0, note: "" }}
          columns={[
            { key: "label", label: "Charge", type: "text" },
            { key: "monthly", label: `Montant / mois (${dc})`, type: "money" },
            { key: "note", label: "Note", type: "text", width: 200 },
          ]}
          rowExtra={(r) => overridden(r.id, r.monthly, effective.fixedCosts.find((x) => x.id === r.id)?.monthly ?? r.monthly)}
          footer={
            <tr className="total">
              <td>Total mensuel</td>
              <td>{mt(effective.fixedCosts.reduce((a, c) => a + c.monthly, 0))}</td>
              <td>{m(effective.fixedCosts.reduce((a, c) => a + c.monthly, 0) * 12)} / an</td>
              <td></td>
            </tr>
          }
        />
      </div>

      <div className="card">
        <h2>Personnel</h2>
        <EditTable<StaffLine>
          rows={p.staff}
          onChange={(rows) => setP({ staff: rows })}
          blank={{ role: "Nouveau poste", count: 1, grossMonthly: 0, startMonth: 1 }}
          columns={[
            { key: "role", label: "Poste", type: "text" },
            { key: "count", label: "Effectif", type: "number" },
            { key: "grossMonthly", label: `Brut mensuel (${dc})`, type: "money" },
            { key: "startMonth", label: "Embauche (mois n°)", type: "number" },
          ]}
          footer={
            <tr className="total">
              <td>Coût employeur mensuel (charges {num(p.employerChargesPct, 1)} %)</td>
              <td colSpan={3}>{m(p.staff.reduce((a, s) => a + s.count * s.grossMonthly, 0) * (1 + p.employerChargesPct / 100))}</td>
              <td></td>
            </tr>
          }
        />
      </div>

      <div className="card">
        <h2>Investissements</h2>
        <EditTable<Investment>
          rows={p.investments}
          onChange={(rows) => setP({ investments: rows })}
          blank={{ label: "Nouvel investissement", amount: 0, depreciationYears: 5, note: "" }}
          columns={[
            { key: "label", label: "Poste", type: "text" },
            { key: "amount", label: `Montant HT (${dc})`, type: "money" },
            { key: "depreciationYears", label: "Amort. (ans)", type: "number" },
            { key: "note", label: "Note", type: "text", width: 200 },
          ]}
          rowExtra={(r) => overridden(r.id, r.amount, effective.investments.find((x) => x.id === r.id)?.amount ?? r.amount)}
          footer={
            <tr className="total">
              <td>Total (devis retenus inclus)</td>
              <td>{mt(totalInv)}</td>
              <td colSpan={2}></td>
              <td></td>
            </tr>
          }
        />
      </div>

      <div className="card">
        <h2>Financement</h2>
        <div className="grid grid-kpi" style={{ marginBottom: 12 }}>
          <label className="field">
            Apport en capital
            <MoneyNum value={p.financing.equity} onChange={(v) => setP({ financing: { ...p.financing, equity: v } })} />
          </label>
          <label className="field">
            Subventions
            <MoneyNum value={p.financing.subsidies} onChange={(v) => setP({ financing: { ...p.financing, subsidies: v } })} />
          </label>
        </div>
        <EditTable<Loan>
          rows={p.financing.loans}
          onChange={(rows) => setP({ financing: { ...p.financing, loans: rows } })}
          blank={{ label: "Prêt bancaire", amount: 0, ratePct: 5, years: 7, deferralMonths: 0 }}
          columns={[
            { key: "label", label: "Emprunt", type: "text" },
            { key: "amount", label: `Montant (${dc})`, type: "money" },
            { key: "ratePct", label: "Taux %", type: "number" },
            { key: "years", label: "Durée (ans)", type: "number" },
            { key: "deferralMonths", label: "Différé (mois)", type: "number" },
          ]}
        />
        <p className={proj.indicators.financingGap < 0 ? "neg" : "muted"} style={{ marginTop: 12 }}>
          Ressources : {mt(proj.indicators.totalFinancing)} · Besoins : {mt(totalInv)} ·{" "}
          {proj.indicators.financingGap >= 0 ? `Excédent ${m(proj.indicators.financingGap)}` : `Manque ${m(-proj.indicators.financingGap)}`}
        </p>
      </div>
    </>
  );
}
