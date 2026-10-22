"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCIES, convertPlan, fetchRates } from "@/lib/currency";
import { money, num } from "@/lib/format";
import type { Plan } from "@/lib/types";

// Devise d'affichage d'un plan : les montants restent saisis et calculés dans la devise du plan,
// et sont convertis à l'affichage avec le taux du jour.
interface CurrencyState {
  base: string;
  display: string;
  rate: number; // 1 base = rate display
  fmt: (v: number, compact?: boolean) => string; // montant converti
  fmtBase: (v: number, compact?: boolean) => string; // montant dans la devise du plan
}

const Ctx = createContext<CurrencyState | null>(null);

export function useMoney(): CurrencyState {
  const c = useContext(Ctx);
  if (!c) throw new Error("CurrencyProvider manquant");
  return c;
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
  const [display, setDisplayState] = useState(base);
  const [rates, setRates] = useState<{ date: string; rates: Record<string, number> } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      setDisplayState(saved || base);
    } catch {
      setDisplayState(base);
    }
  }, [storeKey, base]);

  useEffect(() => {
    if (display === base) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchRates(base)
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
  }, [base, display]);

  const setDisplay = (code: string) => {
    setDisplayState(code);
    try {
      if (code === base) localStorage.removeItem(storeKey);
      else localStorage.setItem(storeKey, code);
    } catch {}
  };

  const found = display !== base ? rates?.rates[display] : 1;
  const active = display !== base && typeof found === "number" && found > 0;
  const rate = active ? found! : 1;
  const shown = active ? display : base;
  const value: CurrencyState = {
    base,
    display: shown,
    rate,
    fmt: (v, compact) => money(v * rate, shown, compact),
    fmtBase: (v, compact) => money(v, base, compact),
  };

  const options = CURRENCIES.some((c) => c.code === base) ? CURRENCIES : [{ code: base, label: base }, ...CURRENCIES];

  function convertForGood() {
    if (!active) return;
    if (!confirm(`Convertir définitivement tous les montants du plan de ${base} en ${display} (1 ${base} = ${num(rate, 4)} ${display}) ?\n\nPrix, charges, salaires, investissements, financement et devis seront recalculés.`)) return;
    update((p) => convertPlan(p, display, rate));
    try {
      localStorage.removeItem(storeKey);
    } catch {}
  }

  return (
    <Ctx.Provider value={value}>
      <div className="card no-print" style={{ padding: "10px 16px" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <label className="row small" style={{ gap: 6, flexWrap: "nowrap" }}>
            <span className="muted">Afficher les montants en</span>
            <select style={{ width: "auto" }} value={display} onChange={(e) => setDisplay(e.target.value)}>
              {options.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                  {c.code === base ? " (devise du plan)" : ""}
                </option>
              ))}
            </select>
          </label>
          {active && (
            <button className="btn sm" onClick={convertForGood}>Convertir le plan en {display}</button>
          )}
        </div>
        {display !== base && (
          <p className="small" style={{ margin: "6px 0 0" }}>
            {loading ? (
              <span className="muted"><span className="spinner" /> Récupération du taux…</span>
            ) : active ? (
              <span className="muted">
                1 {base} = <strong>{num(rate, 4)} {display}</strong> (taux du {rates?.date}). Rapports convertis ; les saisies
                (Paramètres, Devis) restent en {base}.
              </span>
            ) : (
              <span className="neg">{error || `Taux ${base} → ${display} indisponible.`}</span>
            )}
          </p>
        )}
      </div>
      {children}
    </Ctx.Provider>
  );
}
