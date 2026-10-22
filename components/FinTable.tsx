"use client";

export interface FinLine<R> {
  label: string;
  value: (r: R) => number;
  kind?: "total" | "sub";
  format: (v: number) => string;
  signColor?: boolean;
}

// Tableau financier en lecture seule : une ligne par poste, une colonne par période.
export default function FinTable<R>({
  columns,
  headers,
  lines,
}: {
  columns: R[];
  headers: string[];
  lines: FinLine<R>[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            {headers.map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label} className={l.kind ?? ""}>
              <td>{l.label}</td>
              {columns.map((c, i) => {
                const v = l.value(c);
                return (
                  <td key={i} className={l.signColor && v < 0 ? "neg" : ""}>
                    {l.format(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
