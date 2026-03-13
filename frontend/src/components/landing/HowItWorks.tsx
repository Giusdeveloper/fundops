"use client";

import styles from "./HowItWorks.module.css";

const steps = [
  {
    num: 1,
    title: "Importa aziende e supporter",
    description: "Carica i dati da CSV o inseriscili a mano. Collega subito ogni supporter alla propria azienda.",
  },
  {
    num: 2,
    title: "Gestisci LOI e reminder",
    description: "Crea le lettere d'intento, inviale e tieni sotto controllo scadenze e promemoria.",
  },
  {
    num: 3,
    title: "Monitora dashboard e documenti",
    description: "Segui KPI, pipeline e documenti. Dossier e cap table sempre aggiornati.",
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Come funziona</h2>
      <div className={styles.steps}>
        {steps.map((step) => (
          <div key={step.num} className={styles.step}>
            <div className={styles.num}>{step.num}</div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDesc}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
