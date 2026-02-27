"use client";

import { useState } from "react";
import styles from "./chooseRole.module.css";

type RoleChoice = "investor" | "founder";

export default function ChooseRolePage() {
  const [loadingRole, setLoadingRole] = useState<RoleChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChooseRole(role: RoleChoice) {
    setError(null);
    setLoadingRole(role);
    try {
      const response = await fetch("/api/auth/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Errore salvataggio ruolo");
      }
      const homeRoute =
        typeof payload?.homeRoute === "string" && payload.homeRoute.startsWith("/")
          ? payload.homeRoute
          : "/dashboard";
      window.location.href = homeRoute;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
      setLoadingRole(null);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Completa il tuo profilo</h1>
        <p className={styles.subtitle}>Seleziona come vuoi usare FundOps</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => handleChooseRole("investor")}
            disabled={loadingRole !== null}
          >
            {loadingRole === "investor" ? "Salvataggio..." : "Sono un investitore"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => handleChooseRole("founder")}
            disabled={loadingRole !== null}
          >
            {loadingRole === "founder" ? "Salvataggio..." : "Sono founder"}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </section>
    </main>
  );
}

