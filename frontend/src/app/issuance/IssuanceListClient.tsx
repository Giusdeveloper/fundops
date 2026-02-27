"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RequireCompany from "@/components/RequireCompany";
import { useCompany } from "@/context/CompanyContext";
import styles from "./issuance.module.css";

interface IssuanceListItem {
  id: string;
  investor_name: string | null;
  investor_email: string | null;
  amount_eur: number;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "verified";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  docs: {
    has_investment_form: boolean;
    has_bank_transfer_proof: boolean;
  };
}

interface IssuanceResponse {
  kpis: {
    pending_review_count: number;
    approved_count: number;
    approved_total_amount: number;
    submitted?: number;
    draft?: number;
    submitted_amount_total?: number;
  };
  investments: IssuanceListItem[];
}

export default function IssuanceListClient() {
  const { activeCompanyId: companyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IssuanceResponse | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/issuance?companyId=${companyId}`, {
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        if (response.status === 401) {
          setError("Sessione scaduta. Effettua nuovamente il login.");
        } else if (response.status === 403) {
          setError("Non hai i permessi per visualizzare Issuance per questa company.");
        } else {
          setError("Impossibile caricare Issuance (errore server). Riprova.");
        }
        if (process.env.NODE_ENV !== "production") {
          console.info("[issuance] non-ok response", {
            status: response.status,
            payload,
          });
        }
        setData(null);
        return;
      }
      setData(
        (
          payload ?? {
            kpis: { pending_review_count: 0, approved_count: 0, approved_total_amount: 0 },
            investments: [],
          }
        ) as IssuanceResponse
      );
    } catch (e: unknown) {
      console.warn("[issuance] fetch failed", e);
      setError("Impossibile caricare Issuance (errore server). Riprova.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => data?.investments ?? [], [data]);

  return (
    <RequireCompany>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Issuance</h1>
          <p className={styles.subtitle}>Investimenti inviati e in bozza per la company attiva.</p>
        </header>

        {!companyId && <p className={styles.empty}>Seleziona una company per continuare.</p>}
        {error && <p className={styles.error}>{error}</p>}

        {companyId && (
          <>
            <div className={styles.kpiRow}>
              <article className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Da verificare</p>
                <p className={styles.kpiValue}>{data?.kpis.pending_review_count ?? 0}</p>
              </article>
              <article className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Approvati</p>
                <p className={styles.kpiValue}>{data?.kpis.approved_count ?? 0}</p>
              </article>
              <article className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Totale approvato</p>
                <p className={styles.kpiValue}>
                  {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                    Number(data?.kpis.approved_total_amount ?? 0)
                  )}
                </p>
              </article>
            </div>

            {loading ? (
              <p className={styles.empty}>Caricamento...</p>
            ) : rows.length === 0 ? (
              <p className={styles.empty}>Nessun investimento disponibile.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Supporter</th>
                      <th>Importo €</th>
                      <th>Stato</th>
                      <th>Documenti</th>
                      <th>Data invio</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.investorCell}>
                            <span>{row.investor_name || "—"}</span>
                            <small>{row.investor_email || "—"}</small>
                          </div>
                        </td>
                        <td>
                          {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                            Number(row.amount_eur ?? 0)
                          )}
                        </td>
                        <td>
                          <span className={styles.statusBadge}>{row.status}</span>
                        </td>
                        <td>
                          <div className={styles.docBadges}>
                            <span className={row.docs.has_investment_form ? styles.badgeOk : styles.badgeMissing}>
                              Modulo
                            </span>
                            <span className={row.docs.has_bank_transfer_proof ? styles.badgeOk : styles.badgeMissing}>
                              Bonifico
                            </span>
                          </div>
                        </td>
                        <td>
                          {row.submitted_at
                            ? new Date(row.submitted_at).toLocaleString("it-IT")
                            : "—"}
                        </td>
                        <td>
                          <Link href={`/issuance/${row.id}`} className={styles.openLink}>
                            Apri
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </RequireCompany>
  );
}
