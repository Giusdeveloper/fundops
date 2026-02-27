"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import styles from "../portal.module.css";

export type RequiredDocType =
  | "investment_form"
  | "bank_transfer_proof";

type DocsState = Record<RequiredDocType, boolean>;

const DOC_LABELS: Record<RequiredDocType, string> = {
  investment_form: "Modulo firmato",
  bank_transfer_proof: "Prova bonifico",
};

const DOC_TYPES: readonly RequiredDocType[] = [
  "investment_form",
  "bank_transfer_proof",
] as const;

export default function PortalInvestClient({
  slug,
  companyId,
  initialInvestmentId,
  initialDocs,
  initialAmountEur,
  initialPrivacyAccepted,
  initiallySubmitted,
}: {
  slug: string;
  companyId: string;
  initialInvestmentId: string | null;
  initialDocs: DocsState;
  initialAmountEur: number;
  initialPrivacyAccepted: boolean;
  initiallySubmitted: boolean;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [investmentId, setInvestmentId] = useState<string | null>(initialInvestmentId);
  const [docs, setDocs] = useState<DocsState>(initialDocs);
  const [amountEur, setAmountEur] = useState(
    initialAmountEur > 0 ? String(initialAmountEur) : ""
  );
  const [privacyAccepted, setPrivacyAccepted] = useState(Boolean(initialPrivacyAccepted));
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [missingDocs, setMissingDocs] = useState<RequiredDocType[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<RequiredDocType | null>(null);
  const fileInputs = useRef<Partial<Record<RequiredDocType, HTMLInputElement | null>>>({});

  const parsedAmount = Number(amountEur);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount >= 1;
  const canSubmit = !!investmentId && isAmountValid && privacyAccepted && !submitting && !submitted;

  const missingLabelList = useMemo(
    () => missingDocs.map((docType) => DOC_LABELS[docType]),
    [missingDocs]
  );

  const refreshDocsStatus = async (currentInvestmentId: string) => {
    const response = await fetch(
      `/api/portal/documents/status?slug=${encodeURIComponent(slug)}&investmentId=${encodeURIComponent(
        currentInvestmentId
      )}`,
      { cache: "no-store" }
    );
    if (!response.ok) return;
    const json = await response.json().catch(() => null);
    if (!json) return;
      setDocs({
        investment_form: Boolean(json.hasInvestmentForm),
        bank_transfer_proof: Boolean(json.hasBankTransferProof),
      });
  };

  const handleUpload = async (type: RequiredDocType, file: File) => {
    if (submitted || !investmentId) return;

    setUploadingDoc(type);
    try {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("type", type);
      formData.set("investmentId", investmentId);
      formData.set("file", file);

      const response = await fetch("/api/portal/documents/upload", {
        method: "POST",
        body: formData,
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Errore upload documento");
      }

      setDocs((prev) => ({ ...prev, [type]: true }));
      setMissingDocs((prev) => prev.filter((docType) => docType !== type));
      await refreshDocsStatus(investmentId);
      showToast("Documento caricato", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore upload", "error");
    } finally {
      setUploadingDoc(null);
      const input = fileInputs.current[type];
      if (input) input.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setMissingDocs([]);

    try {
      const response = await fetch("/api/portal/investment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          investment_id: investmentId,
          amount_eur: parsedAmount,
          privacy_accepted: privacyAccepted,
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const isMissingDocuments =
          json?.code === "missing_documents" && Array.isArray(json?.missing);
        if (isMissingDocuments) {
          const typedMissing = (json.missing as string[]).filter((type): type is RequiredDocType =>
            DOC_TYPES.includes(type as RequiredDocType)
          );
          setMissingDocs(typedMissing);
        }
        throw new Error(json?.error || "Errore invio investimento");
      }

      setSubmitted(true);
      showToast("Investimento inviato", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore invio investimento", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartInvestment = async () => {
    if (starting || submitted) return;

    setStarting(true);
    try {
      const response = await fetch("/api/portal/investment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Errore avvio investimento");
      }
      const nextInvestmentId =
        typeof json?.investment_id === "string" ? json.investment_id : null;
      if (!nextInvestmentId) {
        throw new Error("investment_id non restituito");
      }
      setInvestmentId(nextInvestmentId);
      await refreshDocsStatus(nextInvestmentId);
      showToast("Investimento avviato", "success");
      router.replace(`/portal/${slug}/invest?investmentId=${encodeURIComponent(nextInvestmentId)}`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore avvio investimento", "error");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      {!investmentId && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Avvia investimento</h2>
          <p className={styles.pledgeIntro}>
            Crea il tuo investimento per collegare i documenti di Issuance.
          </p>
          <button type="button" className={styles.uploadBtn} onClick={handleStartInvestment} disabled={starting}>
            {starting ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Avvio in corso...
              </>
            ) : (
              "Avvia investimento"
            )}
          </button>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sezione 1</h2>
        <p className={styles.pledgeIntro}>
          Completa questi passaggi per inviare l’investimento a revisione.
        </p>
        <label className={styles.pledgeLabel}>
          Importo in euro
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={styles.pledgeInput}
            value={amountEur}
            onChange={(event) => setAmountEur(event.target.value)}
            disabled={submitted || !investmentId}
            required
          />
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sezione 2</h2>
        <div className={styles.investChecklist}>
          {DOC_TYPES.map((type) => {
            const isUploaded = docs[type];
            const isUploading = uploadingDoc === type;
            return (
              <div key={type} className={styles.investChecklistRow}>
                <div className={styles.investChecklistInfo}>
                  <span>{DOC_LABELS[type]}</span>
                  <span className={isUploaded ? styles.docUploaded : styles.docMissing}>
                    {isUploaded ? "Caricato" : "Mancante"}
                  </span>
                </div>
                {!submitted && investmentId && (
                  <div className={styles.uploadForm}>
                    <input
                      ref={(element) => {
                        fileInputs.current[type] = element;
                      }}
                      type="file"
                      className={styles.fileInput}
                      accept=".pdf,application/pdf,image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleUpload(type, file);
                      }}
                      disabled={isUploading || !!uploadingDoc || !investmentId}
                      aria-label={`Carica ${DOC_LABELS[type]}`}
                      title={`Carica ${DOC_LABELS[type]}`}
                    />
                    <button
                      type="button"
                      className={styles.uploadBtn}
                      disabled={isUploading || !!uploadingDoc || !investmentId}
                      onClick={() => fileInputs.current[type]?.click()}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className={styles.spinner} />
                          Upload...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Carica
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sezione 3</h2>
        <label className={styles.pledgeCheckbox}>
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            disabled={submitted || !investmentId}
          />
          <span>Accetto l&apos;informativa privacy e confermo i dati inviati.</span>
        </label>
      </section>

      {missingLabelList.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Documenti mancanti</h2>
          <ul className={styles.missingList}>
            {missingLabelList.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <button
          type="button"
          className={styles.uploadBtn}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className={styles.spinner} />
              Invio in corso...
            </>
          ) : (
            "Invia per revisione"
          )}
        </button>
      </section>

      {submitted && (
        <section className={styles.section}>
          <div className={styles.investmentSubmittedBox}>
            Investimento inviato. In verifica.
          </div>
        </section>
      )}
    </>
  );
}
