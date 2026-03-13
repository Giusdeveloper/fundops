"use client";

import Link from "next/link";
import styles from "./Hero.module.css";

export default function Hero() {
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroBg} aria-hidden />
      <nav className={styles.navBar}>
        <Link href="/login" className={styles.navLink}>
          Accedi
        </Link>
      </nav>
      <div className={styles.heroContent}>
        <h1 className={styles.headline}>FundOps – Il fundraising sotto controllo</h1>
        <p className={styles.subhead}>
          Gestisci supporter, LOI, documenti e dashboard. Un solo posto per booking, issuance e onboarding.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/login" className={styles.ctaPrimary}>
            Prova FundOps
          </Link>
          <button type="button" onClick={scrollToFeatures} className={styles.ctaSecondary}>
            Scopri come funziona
          </button>
        </div>
        <p className={styles.trustStrip}>Pensato insieme a team di fundraising per gestire round con decine di LOI.</p>
      </div>
    </section>
  );
}
