"use client";

import { useEffect, useState } from "react";
import styles from "./ViewModeToggle.module.css";

type ViewMode = "startup" | "investor";

export default function ViewModeToggle({
  onChanged,
}: {
  onChanged?: (mode: ViewMode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [canSwitch, setCanSwitch] = useState(false);
  const [mode, setMode] = useState<ViewMode>("startup");
  const [role, setRole] = useState<string>("");

  async function fetchCurrent() {
    setLoading(true);
    try {
      const r = await fetch("/api/profile/view-mode", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMode(j.view_mode as ViewMode);
        setCanSwitch(Boolean(j.can_switch));
        setRole(j.role_global ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function setViewMode(next: ViewMode) {
    setLoading(true);
    try {
      const r = await fetch("/api/profile/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view_mode: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMode(j.view_mode as ViewMode);
        onChanged?.(j.view_mode as ViewMode);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCurrent();
  }, []);

  if (loading) {
    return (
      <div className={styles.statusText}>
        Modalità: caricamento…
      </div>
    );
  }

  // Se non può switchare, mostro solo stato
  if (!canSwitch) {
    return (
      <div className={styles.statusText}>
        Modalità: <strong>{mode === "investor" ? "Investor" : "Startup"}</strong>{" "}
        {role ? <span>(role: {role})</span> : null}
      </div>
    );
  }

  return (
    <div className={styles.toggleRoot}>
      <div className={styles.toggleLabel}>
        View mode:
      </div>

      <button
        type="button"
        onClick={() => setViewMode("startup")}
        disabled={loading || mode === "startup"}
        className={`${styles.toggleButton} ${mode === "startup" ? styles.toggleButtonActive : ""}`}
      >
        Startup
      </button>

      <button
        type="button"
        onClick={() => setViewMode("investor")}
        disabled={loading || mode === "investor"}
        className={`${styles.toggleButton} ${mode === "investor" ? styles.toggleButtonActive : ""}`}
      >
        Investor
      </button>
    </div>
  );
}
