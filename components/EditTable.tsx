"use client";

import { Num } from "./ui";
import { uid } from "@/lib/uid";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  type: "text" | "number" | "select";
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
      <table className="edit">
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
                <td key={c.key} style={c.width ? { minWidth: c.width } : undefined}>
                  {c.type === "number" ? (
                    <Num value={r[c.key] as number} onChange={(v) => set(r.id, c.key, v)} />
                  ) : c.type === "select" ? (
                    <select value={String(r[c.key] ?? "")} onChange={(e) => set(r.id, c.key, e.target.value || null)}>
                      {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={String(r[c.key] ?? "")} onChange={(e) => set(r.id, c.key, e.target.value)} />
                  )}
                </td>
              ))}
              <td>
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
