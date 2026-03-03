"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/components/ToastProvider";
import styles from "./dossier.module.css";

type DriveConnection = {
  drive_kind: "my_drive" | "shared_drive";
  shared_drive_id: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  status: "connected" | "error" | "disconnected";
};

export default function DossierPage() {
  const { activeCompanyId } = useCompany();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const companyId = useMemo(
    () => searchParams.get("companyId") || activeCompanyId || "",
    [activeCompanyId, searchParams]
  );

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [useSharedDrive, setUseSharedDrive] = useState(false);
  const [driveId, setDriveId] = useState("");
  const [shareStatus, setShareStatus] = useState<{ ok: boolean; message?: string } | null>(null);

  const loadConnection = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/connection?companyId=${encodeURIComponent(companyId)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Errore caricamento connessione");
      const nextConnection = (payload?.connection ?? null) as DriveConnection | null;
      setConnection(nextConnection);
      if (nextConnection?.drive_kind === "shared_drive") {
        setUseSharedDrive(true);
      }
      if (nextConnection?.shared_drive_id) {
        setDriveId(nextConnection.shared_drive_id);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore connessione Drive", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConnection();
  }, [companyId]);

  const connectGoogleDrive = () => {
    if (!companyId) {
      showToast("Seleziona una company", "warning");
      return;
    }
    const redirect = `/dossier?companyId=${companyId}`;
    window.location.href = `/api/drive/google/start?companyId=${encodeURIComponent(
      companyId
    )}&redirect=${encodeURIComponent(redirect)}`;
  };

  const initDrive = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await fetch("/api/drive/google/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          useSharedDrive,
          driveId: useSharedDrive ? driveId.trim() : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Errore creazione cartella");
      setShareStatus(payload?.shareAdmin ?? null);
      showToast("Cartella FundOps collegata", "success");
      await loadConnection();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore init", "error");
    } finally {
      setLoading(false);
    }
  };

  const rootDriveUrl = connection?.root_folder_id
    ? `https://drive.google.com/drive/folders/${connection.root_folder_id}`
    : null;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dossier</h1>
        <p className={styles.subtitle}>
          Collega Google Drive e gestisci la cartella root FundOps della company.
        </p>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Connessione Drive</h2>
        <p className={styles.muted}>
          Stato: {connection ? "Connesso" : "Non connesso"}
        </p>
        <button
          className={styles.primaryBtn}
          onClick={connectGoogleDrive}
          disabled={!companyId || loading}
        >
          Connetti Google Drive
        </button>
      </div>

      {connection && !connection.root_folder_id && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Crea cartella FundOps</h2>
          <label className={styles.labelRow}>
            <input
              type="checkbox"
              checked={useSharedDrive}
              onChange={(e) => setUseSharedDrive(e.target.checked)}
            />
            <span>Usa Shared Drive</span>
          </label>
          {useSharedDrive && (
            <label className={styles.label}>
              Drive ID (manuale)
              <input
                className={styles.input}
                type="text"
                placeholder="es. 0AExampleSharedDriveIdUk9PVA"
                value={driveId}
                onChange={(e) => setDriveId(e.target.value)}
              />
            </label>
          )}

          <button
            className={styles.primaryBtn}
            onClick={initDrive}
            disabled={loading || (useSharedDrive && !driveId.trim())}
          >
            Crea cartella FundOps
          </button>

          {shareStatus && (
            <p className={shareStatus.ok ? styles.ok : styles.warn}>
              {shareStatus.ok
                ? "Condivisa con admin@imment.it"
                : `Condivisione automatica fallita. Aggiungi manualmente admin@imment.it come Editor. ${shareStatus.message ?? ""}`}
            </p>
          )}
        </div>
      )}

      {connection?.root_folder_id && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Cartella collegata</h2>
          <p className={styles.muted}>
            Nome: {connection.root_folder_name || "FundOps"}
          </p>
          <p className={styles.muted}>
            Modalità: {connection.drive_kind === "shared_drive" ? "Shared Drive" : "My Drive"}
          </p>
          {connection.shared_drive_id && (
            <p className={styles.muted}>Drive ID: {connection.shared_drive_id}</p>
          )}
          {rootDriveUrl && (
            <a href={rootDriveUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
              Apri in Drive
            </a>
          )}
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Regole naming consigliate</h2>
        <p className={styles.muted}>YYYY-MM-DD__{`{tipo}`}__{`{descrizione}`}__v{`{n}`}.pdf</p>
        <p className={styles.muted}>Esempio: 2026-02-26__PitchDeck__Imment__v1.pdf</p>
      </div>
    </section>
  );
}

