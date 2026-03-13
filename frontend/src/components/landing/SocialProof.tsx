"use client";

import styles from "./SocialProof.module.css";

export default function SocialProof() {
  return (
    <section className={styles.section} aria-label="Chi usa FundOps">
      <div className={styles.label}>Pensato per i team di fundraising</div>
      <div className={styles.strip}>
        <span className={styles.item}>Team startup in round seed e Serie A</span>
        <span className={styles.item}>VC operativi su più partecipate</span>
        <span className={styles.item}>Advisor legali e finanziari</span>
      </div>
    </section>
  );
}

