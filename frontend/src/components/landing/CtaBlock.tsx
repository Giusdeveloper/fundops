"use client";

import Link from "next/link";
import styles from "./CtaBlock.module.css";

export default function CtaBlock() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Pronto a semplificare il fundraising?</h2>
        <p className={styles.sub}>Unisciti ai team che usano FundOps per gestire supporter, LOI e documenti.</p>
        <Link href="/login" className={styles.cta}>
          Inizia ora
        </Link>
        <p className={styles.trustNote}>Progettato con attenzione a privacy e best practice GDPR sui dati dei supporter.</p>
      </div>
    </section>
  );
}
