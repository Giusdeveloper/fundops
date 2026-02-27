"use client";

import { useState } from "react";

export default function AttestationDownloadClient({
  documentId,
  className,
  children,
}: {
  documentId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      window.open(`/api/investor/documents/${documentId}/download`, "_blank");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? "Attendi…" : children}
    </button>
  );
}
