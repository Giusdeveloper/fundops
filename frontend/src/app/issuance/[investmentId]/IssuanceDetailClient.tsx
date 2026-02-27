"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RequireCompany from "@/components/RequireCompany";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/components/ToastProvider";
import styles from "../issuance.module.css";

interface DetailResponse {
  investment: {
    id: string;
    status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "verified";
    amount_eur: number;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
  };
  investor: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  documents: {
    investment_form: {
      id: string;
      type: string;
      title: string | null;
      created_at: string;
    } | null;
    bank_transfer_proof: {
      id: string;
      type: string;
      title: string | null;
      created_at: string;
    } | null;
  };
  events?: Array<{
    id: string;
    investment_id: string;
    event_type: string;
    event_data: {
      from_status?: string | null;
      to_status?: string | null;
      note?: string | null;
    } | null;
    created_by: string | null;
    created_at: string;
  }>;
  permissions?: {
    canManageIssuance?: boolean;
  };
  debug?: {
    userRole?: string | null;
    canManageIssuance?: boolean | null;
    companyPhase?: string | null;
    issuanceOpen?: boolean | null;
  };
}

export default function IssuanceDetailClient({
  investmentId,
}: {
  investmentId: string;
}) {
  const { activeCompanyId: companyId } = useCompany();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/issuance/${investmentId}?companyId=${companyId}`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Errore caricamento investimento");
      }
      setData(json as DetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [companyId, investmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (docId: string | null) => {
    if (!docId) return;
    try {
      const response = await fetch(`/api/documents/${docId}/download`, {
        credentials: "include",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "Errore download documento");
      }
      window.open(json.url, "_blank");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore download", "error");
    }
  };

  const handleStatusAction = async (nextStatus: "under_review" | "approved" | "rejected") => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/issuance/${investmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Errore aggiornamento stato");
      }
      showToast("Stato investimento aggiornato", "success");
      await fetchData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore aggiornamento stato", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const currentStatus = data?.investment.status ?? "draft";
  const isSubmitted = currentStatus === "submitted";
  const isUnderReview = currentStatus === "under_review";
  const isSubmittedOrUnderReview = isSubmitted || isUnderReview;
  const isFinal = currentStatus === "approved" || currentStatus === "rejected" || currentStatus === "verified";
  const actionsEnabled = data?.permissions?.canManageIssuance === true;
  const isSaving = actionLoading;
  const hasAmount = (data?.investment?.amount_eur ?? 0) > 0;
  const hasModulo = Boolean(data?.documents?.investment_form);
  const hasBonifico = Boolean(data?.documents?.bank_transfer_proof);
  const canSubmitForReview = actionsEnabled && hasAmount && hasModulo && hasBonifico;
  const showReviewHint = !canSubmitForReview && currentStatus === "draft";

  return (
    <RequireCompany>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Issuance</h1>
          <p className={styles.subtitle}>Dettaglio investimento</p>
        </header>

        <div className={styles.actionsRow}>
          <Link href="/issuance" className={styles.openLink}>
            Torna alla lista
          </Link>
        </div>

        {!companyId && <p className={styles.empty}>Seleziona una company per continuare.</p>}
        {error && <p className={styles.error}>Errore: {error}</p>}
        {loading && <p className={styles.empty}>Caricamento...</p>}

        {companyId && data && !loading && (
          <>
            <article className={styles.summaryCard}>
              <p>
                <strong>Investor:</strong>{" "}
                {data.investor?.full_name || data.investor?.email || "—"}
              </p>
              <p>
                <strong>Importo:</strong>{" "}
                {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                  Number(data.investment.amount_eur ?? 0)
                )}
              </p>
              <p>
                <strong>Stato:</strong> {data.investment.status}
              </p>
              <p>
                <strong>Data invio:</strong>{" "}
                {data.investment.submitted_at
                  ? new Date(data.investment.submitted_at).toLocaleString("it-IT")
                  : "—"}
              </p>
            </article>

            <article className={styles.summaryCard}>
              <h2 className={styles.sectionTitle}>Azioni</h2>
              <div className={styles.actionButtonsRow}>
                <button
                  type="button"
                  className={styles.openLink}
                  disabled={!canSubmitForReview || isSaving}
                  onClick={() => handleStatusAction("under_review")}
                >
                  Metti in revisione
                </button>
                <button
                  type="button"
                  className={styles.openLink}
                  disabled={!actionsEnabled || !isSubmittedOrUnderReview || isSaving}
                  onClick={() => handleStatusAction("rejected")}
                >
                  Rifiuta
                </button>
                <button
                  type="button"
                  className={styles.openLink}
                  disabled={!actionsEnabled || !isSubmittedOrUnderReview || isSaving}
                  onClick={() => handleStatusAction("approved")}
                >
                  Approva
                </button>
              </div>
              {showReviewHint && (
                <div className={styles.actionHintBox}>
                  <p className={styles.actionHintTitle}>Prerequisiti per “Metti in revisione”</p>
                  <ul className={styles.actionChecklist}>
                    <li className={hasAmount ? styles.checkOk : styles.checkMissing}>
                      {hasAmount ? "✓" : "•"} {hasAmount ? "Importo inserito" : "Manca importo"}
                    </li>
                    <li className={hasModulo ? styles.checkOk : styles.checkMissing}>
                      {hasModulo ? "✓" : "•"} {hasModulo ? "Modulo firmato caricato" : "Manca modulo firmato"}
                    </li>
                    <li className={hasBonifico ? styles.checkOk : styles.checkMissing}>
                      {hasBonifico ? "✓" : "•"} {hasBonifico ? "Prova bonifico caricata" : "Manca prova bonifico"}
                    </li>
                  </ul>
                </div>
              )}
              {!actionsEnabled && (
                <p className={styles.empty}>Permessi insufficienti per gestire questa pratica.</p>
              )}
              {isFinal && (
                <p className={styles.empty}>Decisione registrata.</p>
              )}
            </article>

            <article className={styles.summaryCard}>
              <h2 className={styles.sectionTitle}>Documenti</h2>
              <div className={styles.documentRow}>
                <span>Modulo firmato</span>
                <button
                  type="button"
                  className={styles.openLink}
                  onClick={() => handleDownload(data.documents.investment_form?.id ?? null)}
                  disabled={!data.documents.investment_form}
                >
                  Scarica
                </button>
              </div>
              <div className={styles.documentRow}>
                <span>Prova bonifico</span>
                <button
                  type="button"
                  className={styles.openLink}
                  onClick={() => handleDownload(data.documents.bank_transfer_proof?.id ?? null)}
                  disabled={!data.documents.bank_transfer_proof}
                >
                  Scarica
                </button>
              </div>
            </article>

            <article className={styles.summaryCard}>
              <h2 className={styles.sectionTitle}>Timeline eventi</h2>
              {(data.events ?? []).length === 0 ? (
                <p className={styles.empty}>Nessun evento registrato.</p>
              ) : (
                <div className={styles.timelineList}>
                  {(data.events ?? []).map((event) => (
                    <div key={event.id} className={styles.timelineItem}>
                      <div className={styles.timelineHeader}>
                        <strong>{new Date(event.created_at).toLocaleString("it-IT")}</strong>
                      </div>
                      <p className={styles.timelineText}>
                        Status: {event.event_data?.from_status ?? "—"} {"->"} {event.event_data?.to_status ?? "—"}
                      </p>
                      {event.event_data?.note && (
                        <p className={styles.timelineText}>{event.event_data.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </RequireCompany>
  );
}
