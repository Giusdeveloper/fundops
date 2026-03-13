"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import TutorialModal from "@/components/onboarding/TutorialModal";
import { useTutorial } from "@/components/onboarding/useTutorial";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
import { loiTutorialContent, loiTutorialDefinition, loiTutorialSteps, type LoiTutorialStep } from "@/lib/tutorials/loi";
import type { TutorialStepState } from "@/lib/tutorials/types";
import { useToast } from "@/components/ToastProvider";
import styles from "./loi.module.css";

interface LOI {
  id: string;
  company_id: string;
  title?: string;
  round_name?: string;
  status?: string;
  is_master?: boolean;
  updated_at?: string;
  signed_count?: number;
  signers_count?: number;
}

interface Company {
  id: string;
  name?: string;
  public_slug?: string | null;
}

export default function LoisListClient() {
  const { activeCompanyId: companyId } = useCompany();
  const { showToast } = useToast();
  const sectionRefs = useRef<Record<LoiTutorialStep, HTMLElement | null>>({
    overview: null,
    filters: null,
    list: null,
  });
  const [lois, setLois] = useState<LOI[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [includeDraft, setIncludeDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteTargetLoi, setInviteTargetLoi] = useState<LOI | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!companyId?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [loisRes, companiesRes] = await Promise.all([
        fetch(`/api/fundops_lois?companyId=${companyId}&includeDraft=${includeDraft}`),
        fetch("/api/fundops_companies"),
      ]);
      if (!loisRes.ok) throw new Error((await loisRes.json()).error || "Errore LOI");
      if (!companiesRes.ok) throw new Error("Errore companies");
      const loisData = await loisRes.json();
      const companiesData = await companiesRes.json();
      const companies = Array.isArray(companiesData) ? companiesData : companiesData.data ?? [];
      const found = companies.find((c: Company) => c.id === companyId);
      setCompany(found ?? null);
      const list = loisData.data ?? [];
      setLois(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }, [companyId, includeDraft]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedLois = [...lois].sort((a, b) => {
    const aMaster = a.is_master ? 1 : 0;
    const bMaster = b.is_master ? 1 : 0;
    if (bMaster !== aMaster) return bMaster - aMaster;
    const aSent = a.status === "sent" ? 1 : 0;
    const bSent = b.status === "sent" ? 1 : 0;
    if (bSent !== aSent) return bSent - aSent;
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return tb - ta;
  });

  const portalUrl = company?.public_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${company.public_slug}`
    : null;
  const tutorialStates = useMemo<Record<LoiTutorialStep, TutorialStepState>>(() => {
    const hasContext = Boolean(companyId);
    const hasOperationalList = sortedLois.length > 0;
    const filterTouched = includeDraft;

    return {
      overview: hasContext
        ? {
            status: "complete",
            statusLabel: "Pronto",
            smartMessage: `Stai leggendo le LOI di ${company?.name || "questa company"}. Il contesto operativo è corretto.`,
            ctaLabel: "Rivedi il contesto LOI",
            ctaIntent: "focus",
          }
        : {
            status: "pending",
            statusLabel: "In attesa",
            smartMessage: "Seleziona una company attiva prima di leggere o usare la lista LOI.",
            ctaLabel: "Vai al contesto LOI",
            ctaIntent: "focus",
          },
      filters: hasContext
        ? {
            status: filterTouched ? "attention" : "complete",
            statusLabel: filterTouched ? "Personalizzato" : "Pronto",
            smartMessage: filterTouched
              ? "Hai scelto di mostrare anche i draft. Assicurati di distinguere bene bozze e documenti operativi."
              : "Stai vedendo solo le LOI operative. È la vista migliore per lavorare senza rumore.",
            ctaLabel: "Controlla i filtri",
            ctaIntent: "focus",
          }
        : {
            status: "pending",
            statusLabel: "In attesa",
            smartMessage: "I filtri diventano utili dopo aver selezionato una company con LOI disponibili.",
            ctaLabel: "Vai ai filtri",
            ctaIntent: "focus",
          },
      list: hasOperationalList
        ? {
            status: "complete",
            statusLabel: "Pronta",
            smartMessage: `Hai ${sortedLois.length} LOI in lista. Da qui puoi aprire il dettaglio, testare il portal o inviare un invito.`,
            ctaLabel: "Apri la lista LOI",
            ctaIntent: "focus",
          }
        : {
            status: hasContext ? "attention" : "pending",
            statusLabel: hasContext ? "Vuota" : "In attesa",
            smartMessage: hasContext
              ? "La lista è vuota. Potresti essere in una company senza LOI o aver bisogno di mostrare anche i draft."
              : "La lista si popolerà dopo aver selezionato una company e caricato le LOI.",
            ctaLabel: "Vai alla lista LOI",
            ctaIntent: "focus",
          },
    };
  }, [company?.name, companyId, includeDraft, sortedLois.length]);
  const tutorial = useTutorial<LoiTutorialStep>({
    storageKey: loiTutorialDefinition.storageKey,
    steps: loiTutorialSteps.map((step) => step.id),
    initialStepId: "overview",
  });
  const tutorialStep = tutorial.currentStepId;
  const currentTutorial = loiTutorialContent[tutorialStep];
  const currentTutorialState = tutorialStates[tutorialStep];

  const canInviteByEmail = (status?: string): boolean => {
    const normalized = (status ?? "").toLowerCase();
    return normalized === "sent" || normalized === "active";
  };

  const openInviteModal = (loi: LOI) => {
    setInviteTargetLoi(loi);
    setInviteEmail("");
    setInviteName("");
    setInviteModalOpen(true);
  };

  const closeInviteModal = () => {
    if (inviteSending) return;
    setInviteModalOpen(false);
    setInviteTargetLoi(null);
    setInviteEmail("");
    setInviteName("");
  };

  const handleSendInvite = async () => {
    if (!companyId || !company?.public_slug || !inviteTargetLoi?.id) {
      showToast("Dati LOI/company mancanti", "error");
      return;
    }

    const email = inviteEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showToast("Inserisci un'email valida", "warning");
      return;
    }

    setInviteSending(true);
    try {
      const response = await fetch("/api/lois/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companySlug: company.public_slug,
          toEmail: email,
          investorName: inviteName.trim() || undefined,
          loiId: inviteTargetLoi.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Errore invio email");
      }

      showToast("Email inviata", "success");
      closeInviteModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore invio email", "error");
    } finally {
      setInviteSending(false);
    }
  };

  function focusSection(step: LoiTutorialStep) {
    const node = sectionRefs.current[step];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleTutorialStepSelect(step: LoiTutorialStep) {
    tutorial.goToStep(step);
    setTimeout(() => focusSection(step), 60);
  }

  function handleTutorialAction() {
    tutorial.close(false);
    setTimeout(() => focusSection(tutorialStep), 120);
  }

  return (
    <RequireCompany>
      {tutorial.clientReady ? (
        <TutorialModal
          isOpen={tutorial.isOpen}
          ariaLabel={loiTutorialDefinition.ariaLabel}
          eyebrow={loiTutorialDefinition.eyebrow}
          steps={loiTutorialSteps}
          currentStepId={tutorialStep}
          currentIndex={tutorial.currentIndex}
          content={currentTutorial}
          states={tutorialStates}
          smartState={currentTutorialState}
          onClose={() => tutorial.close(false)}
          onSkip={() => tutorial.close(true)}
          onStepSelect={handleTutorialStepSelect}
          onPrevious={() => {
            const previous = loiTutorialSteps[tutorial.currentIndex - 1]?.id;
            tutorial.goToPreviousStep();
            if (previous) setTimeout(() => focusSection(previous), 60);
          }}
          onNext={() => {
            const next = loiTutorialSteps[tutorial.currentIndex + 1]?.id;
            tutorial.goToNextStep();
            if (next) setTimeout(() => focusSection(next), 60);
          }}
          onAction={handleTutorialAction}
        />
      ) : null}
      <header
        ref={(node) => {
          sectionRefs.current.overview = node;
        }}
        className={`${styles["page-header"]} ${tutorial.isOpen && tutorialStep === "overview" ? styles["tutorial-section-active"] : ""}`}
      >
        <h1 className={styles["page-title"]}>Letters of Intent (LOI)</h1>
        <p className={styles["page-subtitle"]}>
          Lista LOI per company. Apri il portal per testare la firma.
        </p>
        <div className={styles["page-meta-row"]}>
          <button type="button" className={styles["tutorial-launcher"]} onClick={() => tutorial.reopen()}>
            Apri tutorial LOI
          </button>
        </div>
        {companyId && (
          <div className={styles["page-meta-row"]}>
            <span className={styles["page-pill"]}>
              {company?.name || `Company: ${companyId.slice(0, 8)}...`}
            </span>
          </div>
        )}
      </header>

      {!companyId && (
        <div className={`${styles["empty-text"]} ${styles["empty-text-padded"]}`}>
          Seleziona una company per visualizzare le LOI.
        </div>
      )}

      {companyId && (
        <>
          <div
            ref={(node) => {
              sectionRefs.current.filters = node;
            }}
            className={`${styles["filters-bar"]} ${tutorial.isOpen && tutorialStep === "filters" ? styles["tutorial-section-active"] : ""}`}
          >
            <label className={styles["filter-toggle"]}>
              <input
                type="checkbox"
                checked={includeDraft}
                onChange={(e) => setIncludeDraft(e.target.checked)}
              />
              <span>Mostra anche draft</span>
            </label>
          </div>

          {error && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <p className={styles["empty-text"]}>Caricamento...</p>
          ) : sortedLois.length === 0 ? (
            <p className={styles["empty-text"]}>
              Nessuna LOI trovata. {!includeDraft && "Attiva 'Mostra anche draft' per vedere le bozze."}
            </p>
          ) : (
            <div
              ref={(node) => {
                sectionRefs.current.list = node;
              }}
              className={`${styles["loi-list"]} ${tutorial.isOpen && tutorialStep === "list" ? styles["tutorial-section-active"] : ""}`}
            >
              {sortedLois.map((loi) => (
                <div key={loi.id} className={styles["loi-list-card"]}>
                  <div className={styles["loi-list-card-main"]}>
                    <div className={styles["loi-list-card-header"]}>
                      <span className={styles["loi-list-title"]}>
                        {loi.round_name || loi.title || "LOI"}
                      </span>
                      {loi.is_master && (
                        <span className={styles["loi-badge-master"]}>MASTER</span>
                      )}
                      <LoiStatusBadge status={loi.status || "draft"} size="small" />
                    </div>
                    <div className={styles["loi-list-meta"]}>
                      {loi.signers_count != null && (
                        <span>Signers: {loi.signed_count ?? 0}/{loi.signers_count}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles["loi-list-actions"]}>
                    {loi.id ? (
                      <Link
                        href={`/lois/${loi.id}`}
                        className={styles["loi-cta-primary"]}
                      >
                        Apri
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`${styles["loi-cta-primary"]} ${styles["loi-cta-disabled"]}`}
                        onClick={() => {
                          console.warn("[LOI] id mancante");
                          showToast("LOI senza ID - impossibile aprire", "warning");
                        }}
                      >
                        Apri
                      </button>
                    )}
                    {portalUrl && (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["loi-cta-secondary"]}
                      >
                        Apri Portal
                      </a>
                    )}
                    {canInviteByEmail(loi.status) && (
                      <button
                        type="button"
                        className={styles["loi-cta-secondary"]}
                        onClick={() => openInviteModal(loi)}
                      >
                        Invia invito
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {inviteModalOpen && inviteTargetLoi && (
        <div className={styles.inviteModalOverlay} role="dialog" aria-modal="true">
          <div className={styles.inviteModalCard}>
            <h3 className={styles.inviteModalTitle}>Invia invito alla firma</h3>
            <p className={styles.inviteModalText}>
              L&apos;investitore riceverà un link per accedere al portale e firmare.
            </p>
            <div className={styles.inviteModalField}>
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="nome@email.com"
                disabled={inviteSending}
              />
            </div>
            <div className={styles.inviteModalField}>
              <label htmlFor="invite-name">Nome (opzionale)</label>
              <input
                id="invite-name"
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome investitore"
                disabled={inviteSending}
              />
            </div>
            <div className={styles.inviteModalActions}>
              <button
                type="button"
                className={styles["loi-cta-secondary"]}
                onClick={closeInviteModal}
                disabled={inviteSending}
              >
                Annulla
              </button>
              <button
                type="button"
                className={styles["loi-cta-primary"]}
                onClick={handleSendInvite}
                disabled={inviteSending || !inviteEmail.trim()}
              >
                {inviteSending ? "Invio..." : "Invia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireCompany>
  );
}
