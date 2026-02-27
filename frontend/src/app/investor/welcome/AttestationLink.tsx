"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import styles from "./AttestationLink.module.css";

export default function AttestationLink({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/download`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore download");
      if (json.url) window.open(json.url, "_blank");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={styles.attestationBtn}
    >
      <FileDown size={18} />
      {loading ? "Attendi…" : "Scarica attestazione"}
    </button>
  );
}
