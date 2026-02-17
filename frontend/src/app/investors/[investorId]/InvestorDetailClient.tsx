"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
import { normalizeStatus } from "@/lib/loiStatus";
import { formatRelativeTime, LoiEvent } from "@/lib/loiEvents";
import { Linkedin } from "lucide-react";
import styles from "../investors.module.css";

interface InvestorDetail {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  category?: string | null;
  type?: string | null;
  investor_type?: string | null;
  investor_company_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface InvestorLoi {
  id: string;
  status?: string | null;
  loi_number?: string | null;
  title?: string | null;
  ticket_amount: number;
  currency?: string | null;
  expiry_date?: string | null;
  created_at?: string | null;
}

interface InvestorDetailClientProps {
  investor: InvestorDetail;
  lois: InvestorLoi[];
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return dateString.slice(0, 10);
  } catch {
    return dateString;
  }
};

const formatCurrency = (amount: number, currency?: string | null) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency ?? "EUR",
  }).format(amount);
};

export default function InvestorDetailClient({
  investor,
  lois: initialLois,
}: InvestorDetailClientProps) {
  const { activeCompanyId: companyId } = useCompany();
  const [lois] = useState(initialLois);
  const [latestEvents, setLatestEvents] = useState<Record<string, LoiEvent>>({});
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Carica ultimi eventi per tutte le LOI (con limite ragionevole per performance)
  useEffect(() => {
    if (lois.length === 0) {
      return;
    }

    // Limite a 20 LOI per evitare query troppo pesanti
    const loisToFetch = lois.slice(0, 20);
    
    const fetchLatestEvents = async () => {
      setLoadingEvents(true);
      try {
        const loiIds = loisToFetch.map((loi) => loi.id).join(",");
        const response = await fetch(
          `/api/fundops_loi_events/latest?loiIds=${loiIds}`
        );

        if (response.ok) {
          const result = await response.json();
          setLatestEvents(result.data || {});
        }
      } catch (error) {
        console.error("Errore nel caricamento degli ultimi eventi:", error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchLatestEvents();
  }, [companyId, lois]);

  return (
    <RequireCompany>
      <>
        <header className={styles["page-header"]}>
        <h1 className={styles["page-title"]}>
          Ciao, {investor.full_name}
        </h1>
        <p className={styles["page-subtitle"]}>Scheda investitore e LOI associate.</p>
        <div className={styles["page-meta-row"]}>
          <span className={styles["page-pill"]}>{investor.email}</span>
          {investor.category && (
            <span className={styles["page-pill"]}>Categoria: {investor.category}</span>
          )}
          {investor.type && (
            <span className={styles["page-pill"]}>Tipo: {investor.type}</span>
          )}
        </div>
      </header>

      <section className={styles["form-card"]}>
        <h2 className={styles["form-title"]}>Dettagli investitore</h2>
        <p className={styles["form-subtitle"]}>Informazioni principali e note.</p>

        <div className={styles["detail-grid"]}>
          <div className={styles["detail-group"]}>
            <div className={styles["detail-label"]}>Email</div>
            <div className={styles["detail-value"]}>{investor.email ?? "—"}</div>
          </div>
          <div className={styles["detail-group"]}>
            <div className={styles["detail-label"]}>Telefono</div>
            <div className={styles["detail-value"]}>{investor.phone ?? "—"}</div>
          </div>
          {investor.linkedin && (
            <div className={styles["detail-group"]}>
              <div className={styles["detail-label"]}>LinkedIn</div>
              <div className={styles["detail-value"]}>
                <a 
                  href={investor.linkedin.startsWith('http') ? investor.linkedin : `https://${investor.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles["linkedin-link"]}
                  title={investor.linkedin}
                >
                  <Linkedin size={20} />
                </a>
              </div>
            </div>
          )}
          <div className={styles["detail-group"]}>
            <div className={styles["detail-label"]}>Tipo Investitore</div>
            <div className={styles["detail-value"]}>{investor.investor_type ?? "—"}</div>
          </div>
          {investor.investor_company_name && (
            <div className={styles["detail-group"]}>
              <div className={styles["detail-label"]}>Ragione Sociale</div>
              <div className={styles["detail-value"]}>{investor.investor_company_name}</div>
            </div>
          )}
          {investor.created_at && (
            <div className={styles["detail-group"]}>
              <div className={styles["detail-label"]}>Data creazione</div>
              <div className={styles["detail-value"]}>{formatDate(investor.created_at)}</div>
            </div>
          )}
          {investor.updated_at && (
            <div className={styles["detail-group"]}>
              <div className={styles["detail-label"]}>Ultimo aggiornamento</div>
              <div className={styles["detail-value"]}>{formatDate(investor.updated_at)}</div>
            </div>
          )}
        </div>

        <div className={styles["detail-notes"]}>
          <div className={styles["detail-label"]}>Note</div>
          <div className={styles["detail-value"]} style={{ whiteSpace: 'pre-wrap' }}>
            {investor.notes ?? "—"}
          </div>
        </div>
      </section>

      <section className={styles["form-card"]}>
        <h2 className={styles["form-title"]}>LOI associate</h2>
        {!lois || lois.length === 0 ? (
          <p className={styles["empty-text"]}>Nessuna LOI associata a questo investitore.</p>
        ) : (
          <div className={styles["loi-list-mini"]}>
            {lois.map((loi) => {
              const expiryRaw = loi.expiry_date;
              const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
              const today = new Date();
              let daysToExpiry = null;

              if (expiryDate) {
                const diff = expiryDate.getTime() - today.getTime();
                daysToExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
              }

              // Determina se mostrare badge di scadenza
              const loiNormalizedStatus = normalizeStatus(loi.status || "draft");
              let expiryBadge = null;
              if (loiNormalizedStatus === "expired" || (daysToExpiry !== null && daysToExpiry <= 0)) {
                expiryBadge = <span className={`${styles["badge"]} ${styles["badge-danger"]}`}>Scaduta</span>;
              } else if (daysToExpiry !== null && daysToExpiry <= 7 && daysToExpiry > 0) {
                expiryBadge = <span className={`${styles["badge"]} ${styles["badge-warning"]}`}>In scadenza ({daysToExpiry}gg)</span>;
              }

              // Ottieni ultimo evento se disponibile
              const latestEvent = latestEvents[loi.id];
              
              // Determina label e timestamp per ultima attività
              // Se c'è un evento reale, usalo; altrimenti usa fallback "LOI creata"
              let activityLabel = "LOI creata";
              let activityTimestamp = loi.created_at;
              
              if (latestEvent && !loadingEvents) {
                activityLabel = latestEvent.label;
                activityTimestamp = latestEvent.created_at;
              }

              return (
                <div key={loi.id} className={styles["loi-mini-card"]}>
                  <div className={styles["loi-mini-header"]}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <LoiStatusBadge status={normalizeStatus(loi.status || "draft")} size="small" />
                      {expiryBadge}
                    </div>
                    <span className={styles["mini-muted"]}>{loi.loi_number}</span>
                  </div>
                  <div className={styles["mini-title"]}>{loi.title}</div>
                  <div className={styles["mini-muted"]}>
                    Ticket: {formatCurrency(loi.ticket_amount, loi.currency)}
                    {loi.expiry_date && ` · Scadenza: ${formatDate(loi.expiry_date)}`}
                  </div>
                  
                  {/* Ultima attività - sempre mostrata */}
                  {activityTimestamp && (
                    <div className={styles["loi-latest-activity"]}>
                      Ultima attività: {activityLabel} · {formatRelativeTime(activityTimestamp)}
                    </div>
                  )}
                  
                  <Link
                    href={`/lois/${loi.id}`}
                    className={styles["small-button-link"]}
                  >
                    Apri LOI
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </>
    </RequireCompany>
  );
}
