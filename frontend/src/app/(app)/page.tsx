"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Reindirizza alla pagina companies per selezionare un'azienda
    router.replace("/companies");
  }, [router]);

  // Mostra un messaggio di caricamento durante il redirect
  return (
    <div className={styles.redirectContainer}>
      <p>Reindirizzamento...</p>
    </div>
  );
} 