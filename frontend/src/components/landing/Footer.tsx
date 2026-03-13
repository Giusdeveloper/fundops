"use client";

import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link href="/login" className={styles.link}>
          Accedi
        </Link>
        <Link href="/dashboard" className={styles.link}>
          Vai all&apos;app
        </Link>
        <span className={styles.brand}>FundOps · Il fundraising sotto controllo · Prodotto di Imment</span>
        <span className={styles.brand}>Imment S.r.l. · P.IVA 12804470016 · Corso Duca degli Abruzzi 79, 10129 Torino (TO)</span>
      </div>
    </footer>
  );
}
