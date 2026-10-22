"use client";

import { useEffect, useState } from "react";

// Champ numérique : garde la saisie en texte pour permettre "12," ou "-" pendant la frappe.
export function Num({
  value,
  onChange,
  step,
  width,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  width?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      value={text}
      style={width ? { width } : undefined}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "warn";
}) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="list-edit">
      {items.map((it, i) => (
        <div className="item" key={i}>
          <input
            value={it}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button className="btn sm" title="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div>
        <button className="btn sm" onClick={() => onChange([...items, ""])}>+ Ajouter</button>
      </div>
    </div>
  );
}

const FALLBACK = {
  c1: "#c8643b",
  c2: "#2f6fb0",
  c3: "#1f8a5b",
  c4: "#8a5cc2",
  neg: "#c2413b",
  muted: "#5f6b7a",
  border: "#dde1e7",
  surface: "#ffffff",
  text: "#1b2330",
};

// Couleurs des graphiques lues depuis les variables CSS (suivent le thème clair/sombre).
export function useChartColors() {
  const [colors, setColors] = useState(FALLBACK);
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
      setColors({
        c1: v("--chart-1", FALLBACK.c1),
        c2: v("--chart-2", FALLBACK.c2),
        c3: v("--chart-3", FALLBACK.c3),
        c4: v("--chart-4", FALLBACK.c4),
        neg: v("--neg", FALLBACK.neg),
        muted: v("--muted", FALLBACK.muted),
        border: v("--border", FALLBACK.border),
        surface: v("--surface", FALLBACK.surface),
        text: v("--text", FALLBACK.text),
      });
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return colors;
}
