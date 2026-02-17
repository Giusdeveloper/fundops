"use client";

import { useState, useEffect } from "react";
import styles from "./portal.module.css";

export default function PortalDebug({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !data && !loading) {
      setLoading(true);
      fetch(`/api/portal/debug?slug=${encodeURIComponent(slug)}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then(setData)
        .catch((e) => setData({ error: String(e) }))
        .finally(() => setLoading(false));
    }
  }, [open, slug, data, loading]);

  return (
    <div className={styles.debugWrapper}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={styles.debugToggle}
      >
        {open ? "Nascondi debug" : "Mostra debug portal"}
      </button>
      {open && (
        <pre className={styles.debugPre}>
          {loading ? "Caricamento..." : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
