"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import styles from "./FundOpsPhaseKPIs.module.css";

interface ProcessStatus {
  booking: {
    status: "not_started" | "in_progress" | "completed";
    investors_count: number;
    active_lois_count: number;
    committed_lois_count: number;
    pipeline_amount: number;
    committed_capital: number;
  };
  issuing: {
    status: "not_started";
  };
  onboarding: {
    status: "not_started";
  };
  current_phase: "booking" | "issuing" | "onboarding";
}

export default function FundOpsPhaseKPIs() {
  const { activeCompanyId: companyId } = useCompany();
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!companyId || companyId.trim() === "") {
      setLoading(false);
      return;
    }

    const fetchProcessStatus = async () => {
      try {
        setLoading(true);

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
        <div className={styles.phasesGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.phaseBlock}>
              <div className={styles.skeletonContent}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!processStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>
          Impossibile caricare KPI
        </div>
      </div>
    );
  }

  const { booking } = processStatus;

  return (
    <div className={styles.container}>
      <div className={styles.phasesGrid}>
        {/* FASE 1: BOOKING */}
        <div className={styles.phaseBlock}>
          <div className={styles.phaseHeader}>
            <div>
              <h3 className={styles.phaseName}>Booking</h3>
              <p className={styles.phaseSubtitle}>KPI di fase</p>
            </div>
            <span className={styles.phaseStatus}>Attiva</span>
          </div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiItem}>
              <div className={styles.kpiValue}>{booking.investors_count}</div>
              <div className={styles.kpiLabel}>Investitori attivi</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiValue}>{booking.active_lois_count}</div>
              <div className={styles.kpiLabel}>LOI attive</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiValue}>{booking.committed_lois_count}</div>
              <div className={styles.kpiLabel}>LOI committed</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiValue}>
                {formatCurrency(booking.pipeline_amount)}
              </div>
              <div className={styles.kpiLabel}>Pipeline capital</div>
            </div>
          </div>
          <div className={`${styles.phaseCopy} ${styles.phaseCopySpacer}`}>
            {/* Spacer invisibile per bilanciare l'altezza con le altre card */}
          </div>
        </div>

        {/* FASE 2: ISSUING */}
        <div className={`${styles.phaseBlock} ${styles.disabled}`}>
          <div className={styles.phaseHeader}>
            <div>
              <h3 className={styles.phaseName}>Issuing</h3>
              <p className={styles.phaseSubtitle}>KPI di fase</p>
            </div>
            <span className={styles.phaseStatusDisabled}>Non disponibile</span>
          </div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
          </div>
          <div className={styles.phaseCopy}>
            La fase di Issuing si attiva dopo la chiusura delle LOI.
          </div>
        </div>

        {/* FASE 3: ONBOARDING */}
        <div className={`${styles.phaseBlock} ${styles.disabled}`}>
          <div className={styles.phaseHeader}>
            <div>
              <h3 className={styles.phaseName}>Onboarding</h3>
              <p className={styles.phaseSubtitle}>KPI di fase</p>
            </div>
            <span className={styles.phaseStatusDisabled}>Non disponibile</span>
          </div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={`${styles.kpiValue} ${styles.kpiValueDisabled}`}>—</div>
              <div className={styles.kpiLabel}>—</div>
            </div>
          </div>
          <div className={styles.phaseCopy}>
            La fase di Onboarding inizia dopo l&apos;emissione.
          </div>
        </div>
      </div>
    </div>
  );
}
