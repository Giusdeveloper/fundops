"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import styles from "./RoundDocumentsPanel.module.css";

type RoundItem = {
  id: string;
  name?: string | null;
  status?: string | null;
  booking_open?: boolean | null;
  issuance_open?: boolean | null;
};

type RoundDocument = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type UploadResponse = {
  file_path?: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  original_name?: string;
};

const DOC_TYPES = [
  { value: "round_pitch_deck", label: "Pitch Deck" },
  { value: "round_regulation", label: "Regolamento Round" },
  { value: "round_terms", label: "Term Sheet / Terms" },
  { value: "other", label: "Altro" },
] as const;

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("it-IT");
  } catch {
    return value;
  }
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function defaultTitleFromFileName(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

export default function RoundDocumentsPanel({
  companyId,
  rounds,
  defaultRoundId,
}: {
  companyId: string;
  rounds: RoundItem[];
  defaultRoundId?: string;
}) {
  const { showToast } = useToast();
  const [selectedRoundId, setSelectedRoundId] = useState<string>(defaultRoundId ?? rounds[0]?.id ?? "");
  const [docs, setDocs] = useState<RoundDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<(typeof DOC_TYPES)[number]["value"]>("round_pitch_deck");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const selectedRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId]
  );

  const fetchDocs = useCallback(async () => {
    if (!selectedRoundId || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rounds/${selectedRoundId}/documents?companyId=${encodeURIComponent(companyId)}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Errore caricamento documenti round");
      }
      setDocs(Array.isArray(payload?.documents) ? payload.documents : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore caricamento documenti round";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedRoundId, showToast]);

  const onRoundChange = useCallback(
    (nextRoundId: string) => {
      setSelectedRoundId(nextRoundId);
      setDocs([]);
      setError(null);
    },
    []
  );

  useEffect(() => {
    if (!selectedRoundId) return;
    void fetchDocs();
  }, [fetchDocs, selectedRoundId]);

  const handleDownload = useCallback(
    async (docId: string) => {
      try {
        const res = await fetch(`/api/documents/${docId}/download`, { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.url) {
          throw new Error(payload?.error || "Errore download documento");
        }
        window.open(payload.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Errore download documento", "error");
      }
    },
    [showToast]
  );

  const handleUpload = useCallback(async () => {
    if (!file || !selectedRoundId) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", companyId);
      formData.append("company_id", companyId);
      formData.append("folder", `fundops/${companyId}/rounds/${selectedRoundId}`);
      formData.append("uploadMode", "raw");

      const uploadRes = await fetch("/api/fundops_documents/upload", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = (await uploadRes.json().catch(() => ({}))) as UploadResponse & { error?: string };
      if (!uploadRes.ok || !uploadPayload.file_path) {
        throw new Error(uploadPayload?.error || "Errore upload file");
      }

      const metadataRes = await fetch(`/api/rounds/${selectedRoundId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          type,
          title: title.trim() || defaultTitleFromFileName(uploadPayload.original_name || file.name),
          file_path: uploadPayload.file_path,
          mime_type: uploadPayload.mime_type ?? file.type ?? null,
          size_bytes: uploadPayload.size_bytes ?? file.size ?? null,
        }),
      });
      const metadataPayload = await metadataRes.json().catch(() => ({}));
      if (!metadataRes.ok) {
        throw new Error(metadataPayload?.error || "Errore creazione metadati documento");
      }

      showToast("Documento round caricato", "success");
      setFile(null);
      setTitle("");
      await fetchDocs();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore caricamento documento";
      setError(message);
      showToast(message, "error");
    } finally {
      setUploading(false);
    }
  }, [companyId, fetchDocs, file, selectedRoundId, showToast, title, type]);

  return (
    <section className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Documenti Round</h2>
      </div>

      <div className={styles.controlsRow}>
        <label className={styles.label}>
          Round
          <select
            className={styles.select}
            value={selectedRoundId}
            onChange={(e) => {
              void onRoundChange(e.target.value);
            }}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name || round.id}
              </option>
            ))}
          </select>
        </label>
        {selectedRound && (
          <div className={styles.roundMeta}>
            Stato: {selectedRound.status || "—"}
            {selectedRound.issuance_open ? " · Issuance aperta" : ""}
            {selectedRound.booking_open ? " · Booking aperta" : ""}
          </div>
        )}
      </div>

      <div className={styles.uploadRow}>
        <label className={styles.label}>
          Tipo
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value as (typeof DOC_TYPES)[number]["value"])}
          >
            {DOC_TYPES.map((docType) => (
              <option key={docType.value} value={docType.value}>
                {docType.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Titolo
          <input
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo documento"
          />
        </label>

        <label className={styles.label}>
          File
          <input
            className={styles.fileInput}
            type="file"
            onChange={(e) => {
              const nextFile = e.target.files?.[0] ?? null;
              setFile(nextFile);
              if (nextFile && !title.trim()) {
                setTitle(defaultTitleFromFileName(nextFile.name));
              }
            }}
          />
        </label>

        <button
          type="button"
          className={styles.btnPrimary}
          disabled={uploading || !file || !selectedRoundId}
          onClick={() => {
            void handleUpload();
          }}
        >
          {uploading ? "Caricamento..." : "Carica"}
        </button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.tableWrap}>
        {loading ? (
          <p className={styles.muted}>Caricamento documenti...</p>
        ) : docs.length === 0 ? (
          <p className={styles.muted}>Nessun documento per il round selezionato.</p>
        ) : (
          <table className={styles.docTable}>
            <thead>
              <tr>
                <th>Titolo</th>
                <th>Tipo</th>
                <th>Dimensione</th>
                <th>Data</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.title}</td>
                  <td>{doc.type}</td>
                  <td>{formatBytes(doc.size_bytes)}</td>
                  <td>{formatDate(doc.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        void handleDownload(doc.id);
                      }}
                    >
                      Scarica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
