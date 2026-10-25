"use client";

import { AutoText, Num } from "./ui";
import { MoneyNum, useMoney } from "./CurrencyProvider";
import { uid } from "@/lib/uid";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  type: "text" | "number" | "money" | "select";
  options?: { value: string; label: string }[];
  width?: number;
}

// Tableau éditable générique (lignes avec id) : ajout, modification, suppression.
export default function EditTable<T extends { id: string }>({
  rows,
  columns,
  onChange,
  blank,
  footer,
  rowExtra,
}: {
  rows: T[];
  columns: Column<T>[];
  onChange: (rows: T[]) => void;
  blank: Omit<T, "id">;
  footer?: React.ReactNode;
  rowExtra?: (row: T) => React.ReactNode;
}) {
  const set = (id: string, key: keyof T, value: unknown) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  return (
    <div className="table-wrap">
      <table className="edit cards">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.label}
                  // largeur < 150 px : colonne courte de largeur fixe (ex. unité) ; sinon largeur minimale
                  className={`col-${c.type}${c.width && c.width < 150 ? " col-short" : ""}`}
                  style={c.width ? (c.width < 150 ? { width: c.width, minWidth: c.width } : { minWidth: c.width }) : undefined}
                >
                  {c.type === "money" ? (
                    <MoneyNum value={r[c.key] as number} onChange={(v) => set(r.id, c.key, v)} />
                  ) : c.type === "number" ? (
                    <Num value={r[c.key] as number} onChange={(v) => set(r.id, c.key, v)} />
                  ) : c.type === "select" ? (
                    <select value={String(r[c.key] ?? "")} onChange={(e) => set(r.id, c.key, e.target.value || null)}>
                      {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <TextCell value={String(r[c.key] ?? "")} onChange={(v) => set(r.id, c.key, v)} />
                  )}
                </td>
              ))}
              <td className="actions">
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  {rowExtra?.(r)}
                  <button className="btn sm" title="Supprimer" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>✕</button>
                </div>
              </td>
            </tr>
          ))}
          {footer}
        </tbody>
      </table>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => onChange([...rows, { ...blank, id: uid() } as T])}>
        + Ajouter une ligne
      </button>
    </div>
  );
}

// Cellule texte : si elle contient des montants et qu'une autre devise est affichée,
// elle les montre convertis (lecture seule) ; sinon elle reste modifiable.
function TextCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { converted, ct, base } = useMoney();
  const shown = converted ? ct(value) : value;
  if (shown !== value) {
    return <div className="converted-text small" title={`Montants convertis — repassez en ${base} pour modifier`}>{shown}</div>;
  }
  return <AutoText singleLine value={value} onChange={onChange} />;
}
