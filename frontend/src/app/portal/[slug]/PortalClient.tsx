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
}: {
  slug: string;
  context: PortalContext;
}) {
  const { showToast } = useToast();
  const [context, setContext] = useState<PortalContext>(initialContext);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [pledgeFullName, setPledgeFullName] = useState(initialContext.profile_full_name ?? "");
  const [signing, setSigning] = useState(false);
  const [pledgeError, setPledgeError] = useState<string | null>(null);
  const fileInputNotary = useRef<HTMLInputElement>(null);
  const fileInputForm = useRef<HTMLInputElement>(null);
  const fileInputWire = useRef<HTMLInputElement>(null);

  const refreshContext = useCallback(async () => {
    const next = await getPortalContext(slug);
    setContext(next);
  }, [slug]);

  const handleUpload = async (
    type: "notary_deed" | "investment_form" | "wire_proof",
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
      if (type === "investment_form") fileInputForm.current?.form?.reset();
      if (type === "wire_proof") fileInputWire.current?.form?.reset();
    }
  };

  const companyName = context.company?.name ?? "";
  const phase = context.phase;
  const isIssuance = phase === "issuing";
  const isOnboarding = phase === "onboarding";
  const isBooking = phase === "booking";
  const hasLoiMaster = !!context.loi;
  const isLoiSigned = context.already_signed;
  const loiSignedAt = context.loi_signed_at;
  const loiSignedName = context.loi_signed_name;

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
        body: JSON.stringify({ slug, signed_name: name }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore durante la firma");
      }
      showToast("LOI firmata con successo", "success");
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

      {(isIssuance || isOnboarding) && isLoiSigned && (
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

      {isBooking && hasLoiMaster && !isLoiSigned && context.can_sign && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Firma lettera d&apos;intenti</h2>
          <p className={styles.pledgeIntro}>
            Conferma la tua intenzione di investire compilando i campi e firmando la LOI.
          </p>
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

      {isBooking && hasLoiMaster && isLoiSigned && (
        <section className={styles.section}>
          <div className={styles.loiSigned}>
            <Check size={32} className={styles.checkIcon} />
            <h2 className={styles.loiSignedTitle}>LOI firmata</h2>
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

      {isBooking && (
        <p className={styles.phaseNote}>
          Consigliato avere 5–10 LOI firmate per passare alla fase successiva.
        </p>
      )}
    </div>
  );
}
