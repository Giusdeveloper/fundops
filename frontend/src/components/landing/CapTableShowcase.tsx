"use client";

import { useEffect, useState } from "react";
import styles from "./CapTableShowcase.module.css";

type CapStepId = "capTable" | "convertibles" | "round" | "results";

interface CapStep {
  id: CapStepId;
  title: string;
  desc: string;
}

const STEPS: CapStep[] = [
  {
    id: "capTable",
    title: "Cap table iniziale",
    desc: "Definisci chi possiede capitale prima del round.",
  },
  {
    id: "convertibles",
    title: "Registro strumentisti",
    desc: "Inserisci i supporter SFP con ticket e condizioni.",
  },
  {
    id: "round",
    title: "Parametri round",
    desc: "Configura pre-money, raccolta, floor/cap e option pool.",
  },
  {
    id: "results",
    title: "Esito post conversione",
    desc: "Vedi dilution e nuova ownership dopo il round.",
  },
];

interface PanelState {
  label: string;
  main: string;
  items: { label: string; value: string }[];
  summary: string;
}

const PANELS: Record<CapStepId, PanelState> = {
  capTable: {
    label: "Step 1 · Situazione iniziale",
    main: "3 soggetti in cap table pre-round",
    items: [
      { label: "Founders", value: "80%" },
      { label: "Advisor", value: "10%" },
      { label: "Seed supporter", value: "10%" },
      { label: "Valore nominale", value: "€ 50.000" },
    ],
    summary:
      "La fotografia iniziale è la base su cui verrà calcolata la dilution: se questa è sbagliata, tutto il resto risulta distorto.",
  },
  convertibles: {
    label: "Step 2 · Registro strumentisti",
    main: "Registro SFP con 5 supporter",
    items: [
      { label: "Ticket medio SFP", value: "€ 40.000" },
      { label: "Discount medio", value: "20%" },
      { label: "Totale SFP", value: "€ 200.000" },
      { label: "Classi coinvolte", value: "A · B" },
    ],
    summary:
      "Ogni supporter ha il proprio ticket e discount: il simulatore li usa per calcolare scenari A/B/C di conversione.",
  },
  round: {
    label: "Step 3 · Parametri round",
    main: "Round da € 1M pre-money 4M",
    items: [
      { label: "Pre-money", value: "€ 4.000.000" },
      { label: "Raccolta", value: "€ 1.000.000" },
      { label: "Discount SFP", value: "20%" },
      { label: "Option pool", value: "10% pre-money" },
    ],
    summary:
      "Qui decidi lo scenario da simulare: il modo in cui imposti pre-money, raccolta e option pool cambia subito la dilution.",
  },
  results: {
    label: "Step 4 · Risultati",
    main: "Ownership post-round e dilution",
    items: [
      { label: "Founders", value: "62% (−18%)" },
      { label: "Seed supporter", value: "18% (+8%)" },
      { label: "Nuovi ingressi", value: "20%" },
      { label: "Caso dominante", value: "Scenario B" },
    ],
    summary:
      "Il simulatore racconta chi entra, chi si diluisce e quale regola economica prevale tra i casi di conversione.",
  },
};

export default function CapTableShowcase() {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex];
  const panel = PANELS[currentStep.id];

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className={styles.section} aria-label="Mini-demo del simulatore Cap Table">
      <div className={styles.header}>
        <div className={styles.eyebrow}>Simulatore Cap Table</div>
        <h2 className={styles.title}>Capisci davvero chi entra e chi si diluisce</h2>
        <p className={styles.subtitle}>
          FundOps guida la lettura in 4 step: situazione iniziale, registro SFP, parametri round e risultati post
          conversione.
        </p>
      </div>
      <div className={styles.content}>
        <div className={styles.steps}>
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`${styles.step} ${step.id === currentStep.id ? styles.stepActive : ""}`}
            >
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepBody}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>{panel.label}</p>
            <span className={styles.panelBadge}>Mini-demo</span>
          </div>
          <p className={styles.panelMain}>{panel.main}</p>
          <div className={styles.panelGrid}>
            {panel.items.map((item) => (
              <div key={item.label}>
                <div className={styles.label}>{item.label}</div>
                <div className={styles.value}>{item.value}</div>
              </div>
            ))}
          </div>
          <p className={styles.summary}>
            {panel.summary.split(" ").slice(0, 4).join(" ")}{" "}
            <span className={styles.summaryHighlight}>
              {panel.summary.split(" ").slice(4).join(" ")}
            </span>
          </p>
        </article>
      </div>
    </section>
  );
}

