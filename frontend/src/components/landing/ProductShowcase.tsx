"use client";

import { useEffect, useState } from "react";
import styles from "./ProductShowcase.module.css";

const STATES = [
  {
    label: "Avvio round Seed",
    round: "Round Seed",
    supporters: 8,
    expiring: 1,
    newSupporterTodos: 1,
    reminderTodos: 1,
  },
  {
    label: "Supporter attivi in crescita",
    round: "Round Seed",
    supporters: 12,
    expiring: 3,
    newSupporterTodos: 2,
    reminderTodos: 2,
  },
  {
    label: "Focus su LOI in scadenza",
    round: "Estensione Seed",
    supporters: 16,
    expiring: 4,
    newSupporterTodos: 1,
    reminderTodos: 4,
  },
];

export default function ProductShowcase() {
  const [index, setIndex] = useState(0);
  const current = STATES[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % STATES.length);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className={styles.section} aria-label="Panoramica di FundOps">
      <div className={styles.text}>
        <div className={styles.eyebrow}>Vedi FundOps in azione</div>
        <h2 className={styles.title}>Una vista unica su supporter, LOI e round</h2>
        <p className={styles.desc}>
          Dashboard, todo e stato delle LOI nello stesso posto. Capisci al volo dove sei nel fundraising e cosa fare
          dopo.
        </p>
        <ul className={styles.bullets}>
          <li>Lista LOI con scadenze e reminder evidenziati.</li>
          <li>Supporter collegati alle aziende con import da fogli Excel.</li>
          <li>Todo chiari per non perdere nessuna opportunità.</li>
        </ul>
      </div>
      <div className={styles.mock} aria-hidden>
        <div className={styles.mockTop}>
          <div className={styles.dots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
          <span>fundops.app · dashboard</span>
        </div>
        <div className={styles.mockBody}>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>LOI in corso</h3>
            <div className={styles.row}>
              <span>{current.round}</span>
              <span className={styles.pill}>{current.label}</span>
            </div>
            <div className={`${styles.row} ${styles.rowHighlight}`}>
              <span>Supporter attivi</span>
              <span>{current.supporters}</span>
            </div>
            <div className={`${styles.row} ${styles.rowAlert}`}>
              <span>LOI in scadenza 14gg</span>
              <span>{current.expiring}</span>
            </div>
          </div>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Todo oggi</h3>
            <div className={`${styles.row} ${styles.rowHighlight}`}>
              <span>Invia LOI a nuovi supporter</span>
              <span>{current.newSupporterTodos}</span>
            </div>
            <div className={`${styles.row} ${styles.rowAlert}`}>
              <span>Reminder su LOI ferme</span>
              <span>{current.reminderTodos}</span>
            </div>
            <p className={styles.kpi}>Pipeline visibile in tempo reale, senza fogli sparsi.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

