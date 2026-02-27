"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

interface PhaseCardData {
  title: string;
  subtitle: string;
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  statusLabel: string;
  ctaDisabled?: boolean;
}

interface PhaseCardsData {
  booking: PhaseCardData;
  issuing: PhaseCardData;
  onboarding: PhaseCardData;
}

const DEFAULT_PHASE_CARDS: PhaseCardsData = {
  booking: {
    title: "Booking",
    subtitle: "Attivazione investitori e raccolta LOI",
    message: "Avvia attivazione investitori e raccolta LOI.",
    ctaLabel: "Vai agli investitori",
    ctaHref: "/investors",
    statusLabel: "Da avviare",
  },
  issuing: {
    title: "Issuing",
    subtitle: "Formalizzazione investimento",
    message: "Issuing non attiva. Aprila quando sei pronto a formalizzare.",
    ctaLabel: "Configura Issuing",
    ctaHref: "/admin",
    statusLabel: "Non attiva",
  },
  onboarding: {
    title: "Onboarding",
    subtitle: "Gestione investitori post-emissione",
    message: "Onboarding disponibile dopo la chiusura del round.",
    ctaLabel: null,
    ctaHref: null,
    statusLabel: "In attesa",
    ctaDisabled: true,
  },
};

function getStatusDotClass(statusLabel: string): string {
  const label = statusLabel.toLowerCase();
  if (label === "pronto" || label === "attiva" || label === "disponibile") {
    return styles.dotCompleted;
  }
  if (label === "in corso") {
    return styles.dotInProgress;
  }
  return styles.dotNotStarted;
}

export default function FundOpsProcessMap({
  phaseCards = DEFAULT_PHASE_CARDS,
}: {
  phaseCards?: PhaseCardsData;
}) {
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
              <h3 className={styles.phaseTitle}>{phaseCards.booking.title}</h3>
              {current_phase === "booking" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>
            {phaseCards.booking.subtitle}
          </p>
          <p className={styles.phaseDescription}>
            {phaseCards.booking.message}
          </p>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${getStatusDotClass(phaseCards.booking.statusLabel)}`} />
            <span className={styles.statusText}>{phaseCards.booking.statusLabel}</span>
          </div>
          {phaseCards.booking.ctaLabel && phaseCards.booking.ctaHref && (
            <div className={styles.phaseActionRow}>
              <Link href={phaseCards.booking.ctaHref} className={styles.phaseCta}>
                {phaseCards.booking.ctaLabel}
              </Link>
            </div>
          )}
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
              <h3 className={styles.phaseTitle}>{phaseCards.issuing.title}</h3>
              {current_phase === "issuing" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>{phaseCards.issuing.subtitle}</p>
          <p className={styles.phaseDescription}>
            {phaseCards.issuing.message}
          </p>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${getStatusDotClass(phaseCards.issuing.statusLabel)}`} />
            <span className={styles.statusText}>{phaseCards.issuing.statusLabel}</span>
          </div>
          {phaseCards.issuing.ctaLabel && phaseCards.issuing.ctaHref && (
            <div className={styles.phaseActionRow}>
              <Link href={phaseCards.issuing.ctaHref} className={styles.phaseCta}>
                {phaseCards.issuing.ctaLabel}
              </Link>
            </div>
          )}
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
              <h3 className={styles.phaseTitle}>{phaseCards.onboarding.title}</h3>
              {current_phase === "onboarding" && (
                <span className={styles.currentBadge}>Sei qui</span>
              )}
            </div>
          </div>
          <p className={styles.phaseSubtitle}>{phaseCards.onboarding.subtitle}</p>
          <p className={styles.phaseDescription}>
            {phaseCards.onboarding.message}
          </p>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${getStatusDotClass(phaseCards.onboarding.statusLabel)}`} />
            <span className={styles.statusText}>{phaseCards.onboarding.statusLabel}</span>
          </div>
          {phaseCards.onboarding.ctaLabel && phaseCards.onboarding.ctaHref && (
            <div className={styles.phaseActionRow}>
              <Link
                href={phaseCards.onboarding.ctaHref}
                className={`${styles.phaseCta} ${
                  phaseCards.onboarding.ctaDisabled ? styles.phaseCtaDisabled : ""
                }`}
                aria-disabled={phaseCards.onboarding.ctaDisabled}
                onClick={(event) => {
                  if (phaseCards.onboarding.ctaDisabled) {
                    event.preventDefault();
                  }
                }}
              >
                {phaseCards.onboarding.ctaLabel}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
