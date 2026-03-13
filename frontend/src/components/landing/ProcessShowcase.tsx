"use client";

import { useEffect, useState } from "react";
import styles from "./ProcessShowcase.module.css";

type PhaseId = "booking" | "issuing" | "onboarding";

interface PhaseMockData {
  id: PhaseId;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusKind: "idle" | "progress" | "done";
  kpis?: {
    label: string;
    value: string;
  }[];
  ctaHint: string;
}

const SEQUENCE: PhaseMockData[] = [
  {
    id: "booking",
    title: "Booking",
    subtitle: "Attivazione supporter e raccolta LOI",
    statusLabel: "Avvio raccolta",
    statusKind: "progress",
    kpis: [
      { label: "Supporter attivi", value: "8" },
      { label: "LOI create", value: "3" },
      { label: "Pipeline", value: "€ 120k" },
    ],
    ctaHint: "Importa supporter e crea le prime LOI.",
  },
  {
    id: "booking",
    title: "Booking",
    subtitle: "Attivazione supporter e raccolta LOI",
    statusLabel: "Validazione raggiunta",
    statusKind: "done",
    kpis: [
      { label: "Supporter attivi", value: "16" },
      { label: "LOI firmate", value: "6" },
      { label: "Pipeline", value: "€ 420k" },
    ],
    ctaHint: "Con 5–10 LOI firmate puoi preparare Issuance.",
  },
  {
    id: "issuing",
    title: "Issuance",
    subtitle: "Formalizzazione investimento",
    statusLabel: "Preparazione documenti",
    statusKind: "progress",
    kpis: [
      { label: "LOI in Issuance", value: "4" },
      { label: "Da verificare", value: "2" },
      { label: "Importi submitted", value: "€ 260k" },
    ],
    ctaHint: "Raccogli modulo firmato e prova bonifico dai supporter.",
  },
  {
    id: "onboarding",
    title: "Onboarding",
    subtitle: "Gestione supporter post-emissione",
    statusLabel: "Round chiuso",
    statusKind: "done",
    kpis: [
      { label: "Nuovi soci/supporter", value: "12" },
      { label: "Documenti archiviati", value: "24" },
      { label: "Prossimo round", value: "in preparazione" },
    ],
    ctaHint: "Chiudi onboarding e prepara i prossimi step.",
  },
];

export default function ProcessShowcase() {
  const [stepIndex, setStepIndex] = useState(0);
  const currentPhaseId: PhaseId = SEQUENCE[stepIndex].id;

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % SEQUENCE.length);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  const phases: PhaseMockData[] = [
    SEQUENCE.find((p) => p.id === "booking" && p.statusKind !== "idle") ?? SEQUENCE[0],
    SEQUENCE.find((p) => p.id === "issuing")!,
    SEQUENCE.find((p) => p.id === "onboarding")!,
  ];

  return (
    <section className={styles.section} aria-label="Flusso FundOps dal booking all'onboarding">
      <div className={styles.header}>
        <div className={styles.eyebrow}>Processo FundOps</div>
        <h2 className={styles.title}>Dalla raccolta LOI all&apos;onboarding dei supporter</h2>
        <p className={styles.subtitle}>
          Tre fasi, un unico flusso: Booking, Issuance e Onboarding. FundOps ti mostra sempre dove sei e qual è la
          prossima azione.
        </p>
      </div>
      <div className={styles.phases}>
        {phases.map((phase) => {
          const isCurrent = phase.id === currentPhaseId;
          return (
            <article
              key={phase.id}
              className={`${styles.card} ${isCurrent ? styles.cardCurrent : ""}`}
            >
              <div className={styles.phaseHeader}>
                <h3 className={styles.phaseTitle}>{phase.title}</h3>
                {isCurrent && <span className={styles.badge}>Now</span>}
              </div>
              <p className={styles.phaseSubtitle}>{phase.subtitle}</p>
              <div className={styles.statusRow}>
                <span
                  className={`${styles.statusDot} ${
                    phase.statusKind === "progress"
                      ? styles.dotProgress
                      : phase.statusKind === "done"
                      ? styles.dotDone
                      : styles.dotIdle
                  }`}
                />
                <span className={styles.statusLabel}>{phase.statusLabel}</span>
              </div>
              {phase.kpis && (
                <div className={styles.kpis}>
                  {phase.kpis.map((kpi) => (
                    <div key={kpi.label}>
                      <div className={styles.kpiLabel}>{kpi.label}</div>
                      <div className={styles.kpiValue}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className={styles.ctaHint}>{phase.ctaHint}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

