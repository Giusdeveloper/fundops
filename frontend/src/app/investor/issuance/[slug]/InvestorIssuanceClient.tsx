"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import styles from "../investorIssuance.module.css";

type RequiredDocType = "investment_form" | "bank_transfer_proof";

type EnsureResponse = {
  investmentId: string;
  status: string;
  amount_eur: number;
  privacy_accepted: boolean;
  documents: Record<RequiredDocType, boolean>;
};

const DOC_TYPES: readonly RequiredDocType[] = ["investment_form", "bank_transfer_proof"] as const;
const DOC_LABELS: Record<RequiredDocType, string> = {
  investment_form: "Modulo firmato",
  bank_transfer_proof: "Prova bonifico",
};

export default function InvestorIssuanceClient({
  slug,
  companyId,
  companyName,
}: {
  slug: string;
  companyId: string;
  companyName: string;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [investmentId, setInvestmentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [amountEur, setAmountEur] = useState<string>("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [docs, setDocs] = useState<Record<RequiredDocType, boolean>>({
    investment_form: false,
    bank_transfer_proof: false,
  });
  const [uploadingDoc, setUploadingDoc] = useState<RequiredDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const fileInputs = useRef<Partial<Record<RequiredDocType, HTMLInputElement | null>>>({});

  const isSubmitted = status === "submitted" || status === "under_review" || status === "approved";
  const parsedAmount = Number(amountEur);
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const hasPrivacy = privacyAccepted;
  const hasModulo = docs.investment_form;
  const hasBonifico = docs.bank_transfer_proof;
  const canSubmit = !!investmentId && !isSubmitted && hasAmount && hasPrivacy && hasModulo && hasBonifico;

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (!hasAmount) list.push("Inserisci un importo maggiore di zero.");
    if (!hasPrivacy) list.push("Devi accettare la privacy.");
    if (!hasModulo) list.push("Manca il modulo firmato.");
    if (!hasBonifico) list.push("Manca la prova bonifico.");
    return list;
  }, [hasAmount, hasPrivacy, hasModulo, hasBonifico]);

  const ensureInvestment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investor/investments/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const payload = (await res.json().catch(() => null)) as EnsureResponse | { error?: string } | null;
      if (!res.ok || !payload || !("investmentId" in payload)) {
        throw new Error((payload as { error?: string } | null)?.error || "Errore inizializzazione investimento");
      }
      setInvestmentId(payload.investmentId);
      setStatus(payload.status ?? "draft");
      setAmountEur(payload.amount_eur > 0 ? String(payload.amount_eur) : "");
      setPrivacyAccepted(Boolean(payload.privacy_accepted));
      setDocs({
        investment_form: Boolean(payload.documents?.investment_form),
        bank_transfer_proof: Boolean(payload.documents?.bank_transfer_proof),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    ensureInvestment();
  }, [ensureInvestment]);

  const saveFields = useCallback(
    async (nextAmountEur: number, nextPrivacyAccepted: boolean) => {
      if (!investmentId || isSubmitted) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/investor/investments/${investmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount_eur: Math.max(0, nextAmountEur),
            privacy_accepted: nextPrivacyAccepted,
          }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Errore salvataggio");
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Errore salvataggio", "error");
      } finally {
        setSaving(false);
      }
    },
    [investmentId, isSubmitted, showToast]
  );

  const handleUpload = async (type: RequiredDocType, file: File) => {
    if (!investmentId || isSubmitted) return;
    setUploadingDoc(type);
    try {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("file", file);
      const res = await fetch(`/api/investor/investments/${investmentId}/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Errore upload");
      setDocs((prev) => ({ ...prev, [type]: true }));
      showToast("Documento caricato", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore upload", "error");
    } finally {
      setUploadingDoc(null);
      const input = fileInputs.current[type];
      if (input) input.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !investmentId) return;
    setSubmitting(true);
    setMissing([]);
    try {
      await saveFields(parsedAmount, privacyAccepted);
      const res = await fetch(`/api/investor/investments/${investmentId}/submit`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (Array.isArray(payload?.missing)) {
          setMissing(payload.missing);
        }
        throw new Error(payload?.error || "Errore invio");
      }
      setStatus(payload?.investment?.status ?? "submitted");
      showToast("Investimento inviato", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore invio", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.muted}>Caricamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{companyName}</h1>
        <p className={styles.subtitle}>Completa questi passaggi per inviare l’investimento a revisione.</p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Importo</h2>
        <input
          type="number"
          min={1}
          step={1}
          value={amountEur}
          onChange={(e) => setAmountEur(e.target.value)}
          onBlur={() => saveFields(Number(amountEur || 0), privacyAccepted)}
          disabled={isSubmitted || saving}
          className={styles.input}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Privacy</h2>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => {
              const checked = e.target.checked;
              setPrivacyAccepted(checked);
              void saveFields(Number(amountEur || 0), checked);
            }}
            disabled={isSubmitted || saving}
          />
          <span>Confermo e accetto l’informativa privacy.</span>
        </label>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Documenti</h2>
        {DOC_TYPES.map((type) => {
          const uploaded = docs[type];
          const isUploading = uploadingDoc === type;
          return (
            <div key={type} className={styles.docRow}>
              <div>
                <div>{DOC_LABELS[type]}</div>
                <div className={uploaded ? styles.ok : styles.warn}>{uploaded ? "Caricato" : "Mancante"}</div>
              </div>
              {!isSubmitted && (
                <div className={styles.docActions}>
                  <input
                    ref={(el) => {
                      fileInputs.current[type] = el;
                    }}
                    type="file"
                    className={styles.fileInput}
                    accept=".pdf,application/pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(type, file);
                    }}
                    disabled={isUploading || !!uploadingDoc}
                  />
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => fileInputs.current[type]?.click()}
                    disabled={isUploading || !!uploadingDoc}
                  >
                    {isUploading ? <Loader2 size={16} className={styles.spin} /> : <Upload size={16} />}
                    Carica
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {warnings.length > 0 && !isSubmitted && (
        <section className={styles.card}>
          <ul className={styles.warningList}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <section className={styles.card}>
          <p className={styles.error}>Documenti mancanti: {missing.join(", ")}</p>
        </section>
      )}

      <section className={styles.card}>
        <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? (
            <>
              <Loader2 size={16} className={styles.spin} />
              Invio in corso...
            </>
          ) : (
            "Invia per revisione"
          )}
        </button>
      </section>

      {isSubmitted && (
        <section className={styles.card}>
          <p className={styles.success}>Inviato, in attesa di revisione.</p>
        </section>
      )}

      <div className={styles.footnote}>Percorso: /investor/issuance/{slug}</div>
    </div>
  );
}
