"use client";

import { useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ToastProvider";
import { Check, Upload, Loader2, FileDown } from "lucide-react";
import styles from "./portal.module.css";
import type { PortalContext } from "@/lib/getPortalContext";
import { getPortalContext } from "@/lib/getPortalContext";

export default function PortalClient({
  slug,
  context: initialContext,
  signFlowState = "open",
}: {
  slug: string;
  context: PortalContext;
  signFlowState?: "signed" | "closed" | "open";
}) {
  const { showToast } = useToast();
  const [context, setContext] = useState<PortalContext>(initialContext);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [pledgeFullName, setPledgeFullName] = useState(initialContext.profile_full_name ?? "");
  const [signing, setSigning] = useState(false);
  const [startingInvestment, setStartingInvestment] = useState(false);
  const [pledgeError, setPledgeError] = useState<string | null>(null);
  const fileInputNotary = useRef<HTMLInputElement>(null);
  const fileInputForm = useRef<HTMLInputElement>(null);
  const fileInputWire = useRef<HTMLInputElement>(null);

  const refreshContext = useCallback(async () => {
    const next = await getPortalContext(slug);
    setContext(next);
  }, [slug]);

  const handleUpload = async (
    type:
      | "notary_deed"
      | "investment_form"
      | "wire_proof"
      | "investment_form_signed"
      | "bank_transfer_proof",
    file: File
  ) => {
    setUploading(type);
    try {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("type", type);
      formData.set("file", file);

      const res = await fetch("/api/portal/documents/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore upload");
      }

      showToast("Documento caricato con successo", "success");
      await refreshContext();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore upload", "error");
    } finally {
      setUploading(null);
      if (type === "notary_deed") fileInputNotary.current?.form?.reset();
      if (type === "investment_form" || type === "investment_form_signed") fileInputForm.current?.form?.reset();
      if (type === "wire_proof" || type === "bank_transfer_proof") fileInputWire.current?.form?.reset();
    }
  };

  const companyName = context.company?.name ?? "";
  const phaseRaw = context.company?.phase ?? context.phase;
  const phase = phaseRaw === "issuing" ? "issuance" : phaseRaw;
  const isIssuance = phase === "issuance";
  const isOnboarding = phase === "onboarding";
  const isBooking = phase === "booking";
  const lifecycleStage = context.investor_account?.lifecycle_stage ?? context.lifecycle_stage;
  const showIssuanceStartCard = isIssuance && lifecycleStage === "loi_signed";
  const showIssuanceChecklist = isIssuance && lifecycleStage === "investing";
  const issuanceChecklistCompleted =
    context.has_investment_form_signed && context.has_bank_transfer_proof;
  const hasLoiMaster = !!context.loi;
  const isLoiSigned = context.already_signed;
  const loiSignedAt = context.loi_signed_at;
  const loiSignedName = context.loi_signed_name;
  const showSignedCard =
    isBooking &&
    hasLoiMaster &&
    signFlowState === "signed";
  const showRoundClosedCard =
    isBooking &&
    hasLoiMaster &&
    signFlowState === "closed";
  const showSignForm =
    isBooking &&
    hasLoiMaster &&
    signFlowState === "open" &&
    !isLoiSigned &&
    context.can_sign;

  const handleSignLoi = async () => {
    setPledgeError(null);
    if (!pledgeChecked) {
      setPledgeError("Seleziona la casella per confermare.");
      return;
    }
    const name = pledgeFullName.trim();
    if (name.length < 2) {
      setPledgeError("Inserisci il tuo nome completo.");
      return;
    }
    setSigning(true);
    try {
      const res = await fetch("/api/portal/loi-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: context.company?.id,
          fullName: name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore durante la firma");
      }
      showToast("LOI firmata con successo", "success");
      const redirectTo = json.redirectTo;
      if (redirectTo && typeof redirectTo === "string" && redirectTo.startsWith("/")) {
        window.location.href = redirectTo;
        return;
      }
      await refreshContext();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore";
      setPledgeError(msg);
      showToast(msg, "error");
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadReceipt = async () => {
    const docId = context.receipt_document_id;
    const loiId = context.loi?.id;
    if (docId) {
      try {
        const res = await fetch(`/api/documents/${docId}/download`, {
          credentials: "include",
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || "Errore download");
        }
        const { url } = await res.json();
        window.open(url, "_blank");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Errore download", "error");
      }
    } else if (loiId) {
      window.open(`/api/portal/loi-receipt?loi_id=${encodeURIComponent(loiId)}`, "_blank");
    } else {
      window.open(`/api/portal/loi-receipt?slug=${encodeURIComponent(slug)}`, "_blank");
    }
  };

  const handleStartInvestment = async () => {
    if (!context.company?.id || startingInvestment) return;

    setStartingInvestment(true);
    try {
      const res = await fetch("/api/portal/investment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: context.company.id }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore avvio investimento");
      }

      showToast("Investimento avviato", "success");
      const investmentId =
        typeof json?.investment_id === "string" ? json.investment_id : null;
      if (investmentId) {
        window.location.href = `/portal/${slug}/invest?investmentId=${encodeURIComponent(investmentId)}`;
        return;
      }
      window.location.href = `/portal/${slug}/invest`;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setStartingInvestment(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{companyName}</h1>
        <p className={styles.subtitle}>
          {isIssuance && "Finalizza investimento"}
          {isOnboarding && "Onboarding"}
          {phase === "booking" && "Portal investimenti"}
        </p>
        <p className={styles.phaseBadge}>Fase: {phase}</p>
      </header>

      <div className={styles.welcomeBanner}>
        Sei stato invitato da {companyName}
      </div>

      {(isIssuance || isOnboarding) && !isLoiSigned && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Issuance / Finalizza investimento</h2>
          <p className={styles.pledgeIntro}>
            Per procedere devi firmare la LOI.
          </p>
        </section>
      )}

      {showIssuanceStartCard && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Issuance</h2>
          <p className={styles.pledgeIntro}>
            Hai firmato la LOI. Avvia il tuo investimento per caricare la documentazione richiesta.
          </p>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={handleStartInvestment}
            disabled={startingInvestment}
          >
            {startingInvestment ? (
              <>
                <Loader2 size={18} className={styles.spinner} />
                Attendi…
              </>
            ) : (
              "Avvia investimento"
            )}
          </button>
        </section>
      )}

      {showIssuanceChecklist && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Issuance</h2>

          <div className={styles.checkItem}>
            <div className={styles.checkLeft}>
              {context.has_investment_form_signed ? (
                <Check size={20} className={styles.checkIcon} />
              ) : (
                <span className={styles.checkEmpty} />
              )}
              <span>Modulo firmato</span>
            </div>
            {!context.has_investment_form_signed && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = fileInputForm.current;
                  if (input?.files?.[0]) handleUpload("investment_form_signed", input.files[0]);
                }}
                className={styles.uploadForm}
              >
                <input
                  ref={fileInputForm}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("investment_form_signed", f);
                  }}
                  disabled={!!uploading}
                  className={styles.fileInput}
                  aria-label="Carica modulo firmato"
                  title="Carica modulo firmato"
                />
                <button
                  type="button"
                  onClick={() => fileInputForm.current?.click()}
                  disabled={!!uploading}
                  className={styles.uploadBtn}
                >
                  {uploading === "investment_form_signed" ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Carica
                </button>
              </form>
            )}
          </div>

          <div className={styles.checkItem}>
            <div className={styles.checkLeft}>
              {context.has_bank_transfer_proof ? (
                <Check size={20} className={styles.checkIcon} />
              ) : (
                <span className={styles.checkEmpty} />
              )}
              <span>Prova bonifico</span>
            </div>
            {!context.has_bank_transfer_proof && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = fileInputWire.current;
                  if (input?.files?.[0]) handleUpload("bank_transfer_proof", input.files[0]);
                }}
                className={styles.uploadForm}
              >
                <input
                  ref={fileInputWire}
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("bank_transfer_proof", f);
                  }}
                  disabled={!!uploading}
                  className={styles.fileInput}
                  aria-label="Carica prova bonifico"
                  title="Carica prova bonifico"
                />
                <button
                  type="button"
                  onClick={() => fileInputWire.current?.click()}
                  disabled={!!uploading}
                  className={styles.uploadBtn}
                >
                  {uploading === "bank_transfer_proof" ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Carica
                </button>
              </form>
            )}
          </div>

          {issuanceChecklistCompleted ? (
            <button type="button" className={styles.uploadBtn} disabled>
              Completato
            </button>
          ) : (
            <p className={styles.phaseNote}>Carica entrambi i documenti per completare Issuance.</p>
          )}
        </section>
      )}

      {isOnboarding && isLoiSigned && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Checklist documenti</h2>

          {/* Notary deed - company level */}
          <div className={styles.checkItem}>
            <div className={styles.checkLeft}>
              {context.has_notary_deed ? (
                <Check size={20} className={styles.checkIcon} />
              ) : (
                <span className={styles.checkEmpty} />
              )}
              <span>Atto notarile (company)</span>
            </div>
            {!context.has_notary_deed && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = fileInputNotary.current;
                  if (input?.files?.[0]) handleUpload("notary_deed", input.files[0]);
                }}
                className={styles.uploadForm}
              >
                <input
                  ref={fileInputNotary}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("notary_deed", f);
                  }}
                  disabled={!!uploading}
                  className={styles.fileInput}
                  aria-label="Carica atto notarile"
                  title="Carica atto notarile"
                />
                <button
                  type="button"
                  onClick={() => fileInputNotary.current?.click()}
                  disabled={!!uploading}
                  className={styles.uploadBtn}
                >
                  {uploading === "notary_deed" ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Carica
                </button>
              </form>
            )}
          </div>

          {/* Investment form - investor level */}
          <div className={styles.checkItem}>
            <div className={styles.checkLeft}>
              {context.has_investment_form ? (
                <Check size={20} className={styles.checkIcon} />
              ) : (
                <span className={styles.checkEmpty} />
              )}
              <span>Modulo investimento</span>
            </div>
            {!context.has_investment_form && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = fileInputForm.current;
                  if (input?.files?.[0]) handleUpload("investment_form", input.files[0]);
                }}
                className={styles.uploadForm}
              >
                <input
                  ref={fileInputForm}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("investment_form", f);
                  }}
                  disabled={!!uploading}
                  className={styles.fileInput}
                  aria-label="Carica modulo investimento"
                  title="Carica modulo investimento"
                />
                <button
                  type="button"
                  onClick={() => fileInputForm.current?.click()}
                  disabled={!!uploading}
                  className={styles.uploadBtn}
                >
                  {uploading === "investment_form" ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Carica
                </button>
              </form>
            )}
          </div>

          {/* Wire proof - investor level */}
          <div className={styles.checkItem}>
            <div className={styles.checkLeft}>
              {context.has_wire_proof ? (
                <Check size={20} className={styles.checkIcon} />
              ) : (
                <span className={styles.checkEmpty} />
              )}
              <span>Bonifico / prova pagamento</span>
            </div>
            {!context.has_wire_proof && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = fileInputWire.current;
                  if (input?.files?.[0]) handleUpload("wire_proof", input.files[0]);
                }}
                className={styles.uploadForm}
              >
                <input
                  ref={fileInputWire}
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("wire_proof", f);
                  }}
                  disabled={!!uploading}
                  className={styles.fileInput}
                  aria-label="Carica prova pagamento o bonifico"
                  title="Carica prova pagamento o bonifico"
                />
                <button
                  type="button"
                  onClick={() => fileInputWire.current?.click()}
                  disabled={!!uploading}
                  className={styles.uploadBtn}
                >
                  {uploading === "wire_proof" ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Carica
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {isBooking && context.campaign_not_ready && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Campagna non pronta</h2>
          <p className={styles.pledgeIntro}>
            Campagna non pronta (nessuna LOI pubblicata). Contatta l&apos;azienda per procedere.
          </p>
        </section>
      )}

      {showRoundClosedCard && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Round chiuso</h2>
          <p className={styles.pledgeIntro}>
            Il round è stato chiuso e non è più possibile firmare la LOI. Se hai bisogno di supporto, contatta la società.
          </p>
        </section>
      )}

      {showSignForm && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Firma LOI</h2>
          <p className={styles.pledgeIntro}>
            Conferma la tua intenzione di investire compilando i campi e firmando la LOI.
          </p>
          <div className={styles.loiContentBox}>
            <h3 className={styles.loiContentTitle}>{context.loi?.round_name || context.loi?.loi_number || "Lettera d'intenti"}</h3>
            {context.loi?.premessa_text && (
              <p className={styles.loiContentText}>{context.loi.premessa_text}</p>
            )}
            {context.loi?.modalita_text && (
              <p className={styles.loiContentText}>{context.loi.modalita_text}</p>
            )}
            {context.loi?.condizioni_text && (
              <p className={styles.loiContentText}>{context.loi.condizioni_text}</p>
            )}
            {context.loi?.regolamento_ref && (
              <p className={styles.loiContentMeta}>
                Riferimento regolamento: <strong>{context.loi.regolamento_ref}</strong>
              </p>
            )}
          </div>
          <div className={styles.pledgeForm}>
            <label className={styles.pledgeCheckbox}>
              <input
                type="checkbox"
                checked={pledgeChecked}
                onChange={(e) => {
                  setPledgeChecked(e.target.checked);
                  setPledgeError(null);
                }}
              />
              <span>
                Confermo l&apos;impegno non vincolante.
              </span>
            </label>
            <label className={styles.pledgeLabel}>
              Nome completo (come da documento)
              <input
                type="text"
                className={styles.pledgeInput}
                placeholder="Nome e cognome"
                value={pledgeFullName}
                onChange={(e) => {
                  setPledgeFullName(e.target.value);
                  setPledgeError(null);
                }}
                disabled={signing}
              />
            </label>
            {pledgeError && <p className={styles.pledgeError}>{pledgeError}</p>}
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={handleSignLoi}
              disabled={signing}
            >
              {signing ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  Attendi…
                </>
              ) : (
                "Firma LOI"
              )}
            </button>
          </div>
        </section>
      )}

      {showSignedCard && (
        <section className={styles.section}>
          <div className={styles.loiSigned}>
            <Check size={32} className={styles.checkIcon} />
            <h2 className={styles.loiSignedTitle}>Grazie, hai firmato</h2>
            {loiSignedName && (
              <p className={styles.loiSignedText}>
                Firmato da: <strong>{loiSignedName}</strong>
              </p>
            )}
            {loiSignedAt && (
              <p className={styles.loiSignedText}>
                In data: {new Date(loiSignedAt).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
              </p>
            )}
            <p className={styles.loiSignedText}>
              La tua lettera d&apos;intenti è stata firmata correttamente. Riceverai aggiornamenti
              quando la fase di issuance sarà attiva.
            </p>
            <button
              type="button"
              className={styles.receiptBtn}
              onClick={handleDownloadReceipt}
            >
              <FileDown size={18} />
              Scarica attestazione
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
