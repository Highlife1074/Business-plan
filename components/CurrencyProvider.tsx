"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCIES, convertPlan, convertText, fetchRates, manualRate, setManualRate } from "@/lib/currency";
import { money, num } from "@/lib/format";
import { Num } from "./ui";
import type { Plan } from "@/lib/types";

// Devise d'affichage d'un plan : les montants restent enregistrés et calculés dans la devise du plan,
// et sont convertis à l'affichage (chiffres, champs de saisie et montants écrits dans les textes)
// avec le taux du jour.
interface CurrencyState {
  base: string;
  display: string; // devise effectivement affichée (taux disponible)
  requested: string; // devise choisie (en attente du taux le cas échéant)
  converted: boolean; // affichage dans une autre devise que celle du plan
  rate: number; // 1 base = rate display
  rateDate: string;
  loading: boolean;
  error: string;
  fmt: (v: number, compact?: boolean) => string; // montant converti
  fmtBase: (v: number, compact?: boolean) => string; // montant dans la devise du plan
  ct: (text: string) => string; // texte dont les montants sont convertis
  setDisplay: (code: string) => void;
  convertForGood: () => void;
  manual: number | null; // taux saisi à la main (prioritaire)
  setManual: (rate: number | null) => void;
  options: { code: string; label: string }[];
}

const Ctx = createContext<CurrencyState | null>(null);

export function useMoney(): CurrencyState {
  const c = useContext(Ctx);
  if (!c) throw new Error("CurrencyProvider manquant");
  return c;
}

// Champ de saisie d'un montant : affiché et saisi dans la devise d'affichage,
// enregistré dans la devise du plan.
export function MoneyNum({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { rate } = useMoney();
  return <Num value={Math.round(value * rate * 100) / 100} onChange={(v) => onChange(v / rate)} />;
}

// Texte libre : s'il contient des montants et qu'une autre devise est affichée, il les montre
// convertis (lecture seule, à modifier dans la devise du plan) ; sinon il reste modifiable.
export function ConvertibleText({
  value,
  onChange,
  rows = 4,
  multiline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  multiline?: boolean;
}) {
  const { converted, ct, base } = useMoney();
  const shown = converted ? ct(value) : value;
  if (shown !== value) {
    return (
      <div className="converted-text" title={`Montants convertis — repassez en ${base} pour modifier ce texte`}>
        {shown}
      </div>
    );
  }
  return multiline ? (
    <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

export default function CurrencyProvider({
  plan,
  update,
  children,
}: {
  plan: Plan;
  update: (fn: (p: Plan) => Plan) => void;
  children: React.ReactNode;
}) {
  const base = plan.meta.currency;
  const storeKey = `bp-sim:display:${plan.id}`;
  const [requested, setRequested] = useState(base);
  const [rates, setRates] = useState<{ date: string; rates: Record<string, number> } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManualState] = useState<number | null>(null);

  useEffect(() => {
    try {
      setRequested(localStorage.getItem(storeKey) || base);
    } catch {
      setRequested(base);
    }
  }, [storeKey, base]);

  useEffect(() => {
    setManualState(requested === base ? null : manualRate(base, requested));
  }, [base, requested]);

  useEffect(() => {
    if (requested === base) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchRates(base, requested)
      .then((r) => {
        if (!cancelled) setRates(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, requested]);

  const setDisplay = (code: string) => {
    setRequested(code);
    try {
      if (code === base) localStorage.removeItem(storeKey);
      else localStorage.setItem(storeKey, code);
    } catch {}
  };

  const found = requested !== base ? (manual ?? rates?.rates[requested]) : 1;
  const converted = requested !== base && typeof found === "number" && found > 0;
  const rate = converted ? found! : 1;
  const display = converted ? requested : base;
  const fmt = (v: number, compact?: boolean) => money(v * rate, display, compact);

  function convertForGood() {
    if (!converted) return;
    if (!confirm(`Convertir définitivement tous les montants du plan de ${base} en ${display} (1 ${base} = ${num(rate, 4)} ${display}) ?\n\nPrix, charges, salaires, investissements, financement et devis seront recalculés.`)) return;
    update((p) => convertPlan(p, display, rate));
    try {
      localStorage.removeItem(storeKey);
    } catch {}
  }

  const value: CurrencyState = {
    base,
    display,
    requested,
    converted,
    rate,
    rateDate: manual ? "saisi manuellement" : rates?.date ? `du ${rates.date}` : "",
    loading,
    error,
    fmt,
    fmtBase: (v, compact) => money(v, base, compact),
    ct: (text) => (converted ? convertText(text, base, display, rate, (v, compact) => money(v, display, compact)) : text),
    setDisplay,
    convertForGood,
    manual,
    setManual: (r) => {
      setManualRate(base, requested, r);
      setManualState(r && r > 0 ? r : null);
    },
    options: CURRENCIES.some((c) => c.code === base) ? CURRENCIES : [{ code: base, label: base }, ...CURRENCIES],
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Barre de choix de la devise, affichée en haut de chaque plan
export function CurrencyBar() {
  const c = useMoney();
  return (
    <div className="card no-print" style={{ padding: "10px 16px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <label className="row small currency-pick" style={{ gap: 6 }}>
          <span className="muted">Afficher les montants en</span>
          <select value={c.requested} onChange={(e) => c.setDisplay(e.target.value)}>
            {c.options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} — {o.label}
                {o.code === c.base ? " (devise du plan)" : ""}
              </option>
            ))}
          </select>
        </label>
        {c.converted && (
          <button className="btn sm" onClick={c.convertForGood}>Convertir le plan en {c.display}</button>
        )}
      </div>
      <RateStatus />
    </div>
  );
}

// État du taux de change : taux utilisé, erreur éventuelle, saisie manuelle possible
export function RateStatus() {
  const c = useMoney();
  const [editing, setEditing] = useState(false);
  if (c.requested === c.base) return null;
  const failed = !c.loading && !c.converted;
  return (
    <div className="small" style={{ marginTop: 6 }}>
      {c.loading && !c.converted ? (
        <span className="muted"><span className="spinner" /> Récupération du taux…</span>
      ) : c.converted ? (
        <span className="muted">
          1 {c.base} = <strong>{num(c.rate, 4)} {c.display}</strong> (taux {c.rateDate}). Tous les montants (chiffres, saisies et
          textes) sont affichés en {c.display}.{" "}
          <button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? "Fermer" : "Ajuster le taux"}</button>
        </span>
      ) : (
        <span className="neg">
          {c.error || `Taux ${c.base} → ${c.requested} indisponible.`} Les montants restent en {c.base} tant qu&apos;aucun taux n&apos;est disponible.
        </span>
      )}
      {(failed || editing) && (
        <label className="row" style={{ gap: 6, marginTop: 6, flexWrap: "nowrap" }}>
          <span>Taux manuel : 1 {c.base} =</span>
          <span style={{ width: 110 }}>
            <Num value={c.manual ?? 0} onChange={(v) => c.setManual(v > 0 ? v : null)} />
          </span>
          <span>{c.requested}</span>
          {c.manual && <button className="btn sm" onClick={() => c.setManual(null)}>Taux du jour</button>}
        </label>
      )}
    </div>
  );
}

// Devise affichée, pour les libellés (« montants HT en EUR »)
export function DisplayCurrency() {
  return <>{useMoney().display}</>;
}
