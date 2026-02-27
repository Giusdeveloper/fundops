"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
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

  return (
    <RequireCompany>
      <header className={styles["page-header"]}>
        <h1 className={styles["page-title"]}>Letters of Intent (LOI)</h1>
        <p className={styles["page-subtitle"]}>
          Lista LOI per company. Apri il portal per testare la firma.
        </p>
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
          <div className={styles["filters-bar"]}>
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
            <div className={styles["loi-list"]}>
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
