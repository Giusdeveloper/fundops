"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import styles from "./FundOpsProcessMap.module.css";

interface ProcessStatus {
  booking: {
    status: "not_started" | "in_progress" | "completed";
    investors_count: number;
    lois_count: number;
    pipeline_amount: number;
  };
  issuing: {
    status: "not_started";
  };
  onboarding: {
    status: "not_started";
  };
  current_phase: "booking" | "issuing" | "onboarding";
}

export default function FundOpsProcessMap() {
  const { activeCompanyId: companyId } = useCompany();
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || companyId.trim() === "") {
      setLoading(false);
      return;
    }

    const fetchProcessStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/fundops_process_status?companyId=${companyId}`
        );

        if (!response.ok) {
          throw new Error("Errore nel caricamento dello stato del processo");
        }

        const data: ProcessStatus = await response.json();
        setProcessStatus(data);
      } catch (err) {
        console.error("Error fetching process status:", err);
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      } finally {
        setLoading(false);
      }
    };

    fetchProcessStatus();
  }, [companyId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.loadingText}>Caricamento...</p>
      </div>
    );
  }

  if (error || !processStatus) {
    return null; // Non mostrare errore, semplicemente non renderizzare
  }

  const { booking, current_phase } = processStatus;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>FundOps Process Map</h2>
        <p className={styles.subtitle}>Stato attuale del processo</p>
      </div>

      <div className={styles.phases}>
        {/* FASE 1: BOOKING */}
        <div
          className={`${styles.phaseCard} ${
            current_phase === "booking" ? styles.currentPhase : ""
          } ${
            booking.status === "not_started"
              ? styles.statusNotStarted
              : booking.status === "in_progress"
              ? styles.statusInProgress
              : styles.statusCompleted
          }`}
        >
          <div className={styles.phaseHeader}>
            <div className={styles.phaseNumber}>1</div>
            <div className={styles.phaseTitleRow}>
              <h3 className={styles.phaseTitle}>Booking</h3>
              {current_phase === "booking" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>
            Investors + LOI (soft commitment)
          </p>
          <div className={styles.statusIndicator}>
            <div
              className={`${styles.statusDot} ${
                booking.status === "not_started"
                  ? styles.dotNotStarted
                  : booking.status === "in_progress"
                  ? styles.dotInProgress
                  : styles.dotCompleted
              }`}
            />
            <span className={styles.statusText}>
              {booking.status === "not_started"
                ? "Non iniziata"
                : booking.status === "in_progress"
                ? "In corso"
                : "Completata"}
            </span>
          </div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Investitori</span>
              <span className={styles.kpiValue}>{booking.investors_count}</span>
            </div>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>LOI</span>
              <span className={styles.kpiValue}>{booking.lois_count}</span>
            </div>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Pipeline</span>
              <span className={styles.kpiValue}>
                {formatCurrency(booking.pipeline_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* ARROW */}
        <div className={styles.arrow}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* FASE 2: ISSUING */}
        <div
          className={`${styles.phaseCard} ${
            current_phase === "issuing" ? styles.currentPhase : ""
          } ${styles.statusNotStarted} ${styles.placeholder}`}
        >
          <div className={styles.phaseHeader}>
            <div className={styles.phaseNumber}>2</div>
            <div className={styles.phaseTitleRow}>
              <h3 className={styles.phaseTitle}>Issuing</h3>
              {current_phase === "issuing" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>
            Fase di Issuing non ancora attiva
          </p>
          <div className={styles.statusIndicator}>
            <div
              className={`${styles.statusDot} ${styles.dotNotStarted}`}
            />
            <span className={styles.statusText}>Non disponibile</span>
          </div>
          <div className={styles.placeholderNote}>
            <div className={styles.placeholderNoteMain}>
              L&apos;avvio della fase di Issuing è consigliato quando il round ha raggiunto una massa critica di impegni.
            </div>
            <div className={styles.placeholderNoteSecondary}>
              In genere, FundOps raccomanda di raccogliere almeno 5–10 LOI firmate prima di procedere.
            </div>
            <div className={styles.placeholderNoteTertiary}>
              La decisione finale dipende dal contesto del round e dalla strategia della società.
            </div>
          </div>
        </div>

        {/* ARROW */}
        <div className={styles.arrow}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* FASE 3: ONBOARDING */}
        <div
          className={`${styles.phaseCard} ${
            current_phase === "onboarding" ? styles.currentPhase : ""
          } ${styles["status-not_started"]} ${styles.placeholder}`}
          title="Fase di onboarding investitori"
        >
          <div className={styles.phaseHeader}>
            <div className={styles.phaseNumber}>3</div>
            <div className={styles.phaseTitleRow}>
              <h3 className={styles.phaseTitle}>Onboarding</h3>
              {current_phase === "onboarding" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>
            Investor onboarding post-issuance
          </p>
          <div className={styles.statusIndicator}>
            <div
              className={`${styles.statusDot} ${styles.dotNotStarted}`}
            />
            <span className={styles.statusText}>Non disponibile</span>
          </div>
          <div className={styles.placeholderNote}>
            Funzionalità in arrivo
          </div>
        </div>
      </div>
    </div>
  );
}
