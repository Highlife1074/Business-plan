"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useMoney } from "./CurrencyProvider";
import { useChartColors } from "./ui";
import { num } from "@/lib/format";

export interface ShareItem {
  id: string;
  label: string;
  value: number;
}

const SLOTS = 6;
const FALLBACK = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

// Teintes catégorielles (--cat-1..6), relues au changement de thème clair/sombre
function useCategorical() {
  const [colors, setColors] = useState(FALLBACK);
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      setColors(FALLBACK.map((fb, i) => s.getPropertyValue(`--cat-${i + 1}`).trim() || fb));
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return colors;
}

// Camembert (anneau) de la part de chaque poste dans un total, avec légende chiffrée.
// La couleur suit le poste (son ordre dans la liste), jamais son rang ; au-delà de
// 6 postes, les plus petits sont regroupés dans « Autres ».
export default function SharePie({ items, totalLabel }: { items: ShareItem[]; totalLabel: string }) {
  const { fmt } = useMoney();
  const c = useChartColors();
  const cat = useCategorical();
  const [active, setActive] = useState<string | null>(null);

  const positive = items.filter((x) => x.value > 0);
  const total = positive.reduce((a, x) => a + x.value, 0);
  if (positive.length === 0 || total <= 0) return null;

  let kept = positive;
  let other = 0;
  if (positive.length > SLOTS) {
    const big = new Set([...positive].sort((a, b) => b.value - a.value).slice(0, SLOTS - 1).map((x) => x.id));
    kept = positive.filter((x) => big.has(x.id));
    other = positive.filter((x) => !big.has(x.id)).reduce((a, x) => a + x.value, 0);
  }
  const data = kept.map((x, i) => ({ ...x, color: cat[i] }));
  if (other > 0) data.push({ id: "__autres", label: `Autres (${positive.length - kept.length} postes)`, value: other, color: c.muted });
  const current = data.find((d) => d.id === active);
  const share = (v: number) => `${num((v / total) * 100, 1)} %`;

  return (
    <div className="share">
      <div className="share-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              stroke={c.surface}
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(data[i]?.id ?? null)}
              onMouseLeave={() => setActive(null)}
              onClick={(_, i) => setActive(data[i]?.id ?? null)}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} fillOpacity={active && active !== d.id ? 0.45 : 1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Survol ou toucher d'une part : son détail s'affiche au centre de l'anneau */}
        <div className="share-center">
          {current ? (
            <>
              <span className="muted small share-name">{current.label}</span>
              <strong>{fmt(current.value)}</strong>
              <span className="muted small">{share(current.value)}</span>
            </>
          ) : (
            <>
              <span className="muted small">{totalLabel}</span>
              <strong>{fmt(total)}</strong>
            </>
          )}
        </div>
      </div>
      <table className="share-legend small">
        <tbody>
          {[...data]
            .sort((a, b) => b.value - a.value)
            .map((d) => (
              <tr key={d.id} className={active === d.id ? "active" : undefined} onMouseEnter={() => setActive(d.id)} onMouseLeave={() => setActive(null)} onClick={() => setActive(d.id)}>
                <td className="share-label">
                  <span className="swatch" style={{ background: d.color }} />
                  {d.label}
                </td>
                <td>{fmt(d.value)}</td>
                <td className="muted">{share(d.value)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
