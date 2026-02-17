"use client";

import { FileText } from "lucide-react";
import styles from "./CsvPreviewTable.module.css";

interface CsvPreviewTableProps {
  headers: string[];
  rows: Array<Record<string, string>>;
  maxRows?: number;
}

export default function CsvPreviewTable({
  headers,
  rows,
  maxRows = 20,
}: CsvPreviewTableProps) {
  const previewRows = rows.slice(0, maxRows);
  const hasMoreRows = rows.length > maxRows;

  if (headers.length === 0 || rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileText size={48} className={styles.emptyIcon} />
        <p className={styles.emptyText}>Nessun dato da visualizzare</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>
          Preview CSV ({previewRows.length} di {rows.length} righe)
        </h3>
        {hasMoreRows && (
          <span className={styles.moreRowsHint}>
            Mostrate solo le prime {maxRows} righe
          </span>
        )}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className={styles.th}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={styles.tr}>
                {headers.map((header, colIdx) => {
                  const value = row[header] || "";
                  const isEmpty = value.trim() === "";
                  return (
                    <td
                      key={colIdx}
                      className={`${styles.td} ${isEmpty ? styles.emptyCell : ""}`}
                      title={value || "(vuoto)"}
                    >
                      {isEmpty ? <span className={styles.emptyPlaceholder}>—</span> : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
