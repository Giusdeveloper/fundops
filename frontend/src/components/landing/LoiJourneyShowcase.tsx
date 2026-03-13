"use client";

import { useEffect, useState } from "react";
import styles from "./LoiJourneyShowcase.module.css";

type JourneyStepId = "draft" | "sent" | "reminder" | "signed";

interface JourneyStep {
  id: JourneyStepId;
  statusLabel: string;
  badgeClass: string;
  helper: string;
}

const STEPS: JourneyStep[] = [
  {
    id: "draft",
    statusLabel: "Bozza",
    badgeClass: styles.statusDraft,
    helper: "La LOI è pronta ma non è stata ancora inviata al supporter.",
  },
  {
    id: "sent",
    statusLabel: "Inviata",
    badgeClass: styles.statusSent,
    helper: "Il supporter ha ricevuto la LOI e può rivedere termini e condizioni.",
  },
  {
    id: "reminder",
    statusLabel: "Reminder",
    badgeClass: styles.statusReminder,
    helper: "FundOps ti aiuta a ricordare le LOI ferme, con promemoria mirati.",
  },
  {
    id: "signed",
    statusLabel: "Firmata",
    badgeClass: styles.statusSigned,
    helper: "Il soft commitment è attivo e conteggiato nei KPI del round.",
  },
];

export default function LoiJourneyShowcase() {
  const [stepIndex, setStepIndex] = useState(0);
  const current = STEPS[stepIndex];

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const events: Array<{ id: JourneyStepId; label: string; meta: string }> = [
    { id: "draft", label: "Bozza creata", meta: "Supporter selezionato e ticket impostato." },
    { id: "sent", label: "LOI inviata", meta: "Invio email e link portal al supporter." },
    { id: "reminder", label: "Reminder inviato", meta: "Promemoria automatico sulle LOI ferme." },
    { id: "signed", label: "LOI firmata", meta: "Soft commitment registrato in FundOps." },
  ];

  return (
    <section className={styles.section} aria-label="Mini-demo del percorso LOI">
      <div className={styles.header}>
        <div className={styles.eyebrow}>Percorso LOI</div>
        <h2 className={styles.title}>Da bozza a soft commitment in pochi passi</h2>
        <p className={styles.subtitle}>
          FundOps segue ogni LOI lungo il suo ciclo di vita: bozza, invio, reminder e firma del supporter.
        </p>
      </div>
      <div className={styles.content}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>LOI Round Seed</p>
            <span className={`${styles.statusBadge} ${current.badgeClass}`}>{current.statusLabel}</span>
          </div>
          <p className={styles.cardMain}>Supporter: Rossi Holding</p>
          <div className={styles.metaRow}>
            <span className={styles.tag}>Ticket: € 50.000</span>
            <span className={styles.tag}>Classe SFP: B</span>
            <span className={styles.tag}>Scadenza: 30 giorni</span>
          </div>
          <div className={styles.timeline}>
            <p className={styles.timelineTitle}>Timeline LOI</p>
            <div className={styles.timelineList}>
              {events.map((event) => {
                const isActive = event.id === current.id;
                return (
                  <div
                    key={event.id}
                    className={`${styles.event} ${isActive ? styles.eventActive : ""}`}
                  >
                    <span
                      className={`${styles.eventDot} ${
                        isActive ? styles.eventDotActive : ""
                      }`}
                    />
                    <div>
                      <div className={styles.eventLabel}>{event.label}</div>
                      <div className={styles.eventMeta}>{event.meta}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
        <div className={styles.copyColumn}>
          <p>
            Ogni LOI in FundOps segue sempre lo stesso schema, così il team sa{" "}
            <span className={styles.copyHighlight}>a che punto è il commitment di ogni supporter</span> senza
            inseguire fogli e email.
          </p>
          <ul className={styles.copyList}>
            <li>Parti da una bozza leggibile per round e ticket.</li>
            <li>Invii la LOI e tracci quando il supporter la riceve.</li>
            <li>Usi i reminder per sbloccare le LOI ferme.</li>
            <li>Quando la LOI è firmata, il soft commitment entra nei KPI del round.</li>
          </ul>
          <p>
            Questa mini-demo si aggiorna automaticamente per mostrarti il percorso completo, dalla bozza fino alla
            firma.
          </p>
        </div>
      </div>
    </section>
  );
}

