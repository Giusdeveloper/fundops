"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
import LoiActions from "@/components/loi/LoiActions";
import LoiTimeline from "@/components/loi/LoiTimeline";
import LoiMiniKPI from "@/components/loi/LoiMiniKPI";
import LoiDocuments from "@/components/loi/LoiDocuments";
import { normalizeStatus } from "@/lib/loiStatus";
import { getExpiryInfo } from "@/lib/loiExpiry";
import styles from "../loi.module.css";

interface Signer {
  id: string;
  status: string;
  soft_commitment_at?: string | null;
  hard_signed_at?: string | null;
  investor?: { full_name?: string; email?: string } | null;
}

interface LoiDetail {
  id: string;
  status: string;
  loi_number?: string | null;
  round_name?: string | null;
  title?: string | null;
  ticket_amount: number;
  currency?: string | null;
  sfp_class?: string | null;
  expiry_date?: string | null;
  created_at?: string | null;
  discount_percentage?: number | null;
}

interface LoiInvestor {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  type?: string | null;
}

interface LoiCompany {
  name?: string | null;
  legal_name?: string | null;
  public_slug?: string | null;
}

interface LoiDetailClientProps {
  loi: LoiDetail;
  investor: LoiInvestor | null;
  company: LoiCompany | null;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("it-IT");
  } catch {
    return dateString.slice(0, 10);
  }
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
};

const formatCurrency = (amount: number, currency?: string | null) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency ?? "EUR",
  }).format(amount);
};

export default function LoiDetailClient({
  loi: initialLoi,
  investor,
  company,
}: LoiDetailClientProps) {
  const router = useRouter();
  const { activeCompanyId: companyId } = useCompany();
  const [loi, setLoi] = useState(initialLoi);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [kpiBooking, setKpiBooking] = useState<{ registered_count: number; loi_signed_count: number; conversion_rate: number } | null>(null);
  const [loadingSigners, setLoadingSigners] = useState(false);

  const normalizedStatus = normalizeStatus(loi.status);

  const fetchSignersAndKpi = useCallback(async () => {
    if (!loi?.id || !companyId) return;
    setLoadingSigners(true);
    try {
      const [signersRes, kpiRes] = await Promise.all([
        fetch(`/api/lois/${loi.id}/signers`),
        fetch(`/api/lois/${loi.id}/booking-kpi?companyId=${companyId}`),
      ]);
      if (signersRes.ok) {
        const d = await signersRes.json();
        const list = (d.signers || []).map((s: Signer & { fundops_investors?: Signer["investor"] }) => ({
          ...s,
          investor: s.investor || s.fundops_investors,
        }));
        setSigners(list.sort((a: Signer, b: Signer) => {
          const aSigned = a.status === "signed" ? 1 : 0;
          const bSigned = b.status === "signed" ? 1 : 0;
          return bSigned - aSigned;
        }));
      }
      if (kpiRes.ok) {
        const k = await kpiRes.json();
        setKpiBooking(k);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSigners(false);
    }
  }, [loi?.id, companyId]);

  useEffect(() => {
    fetchSignersAndKpi();
  }, [fetchSignersAndKpi]);

  const handleStatusUpdate = (newStatus: string) => {
    setLoi((prev: LoiDetail) => ({ ...prev, status: newStatus }));
    setTimeout(() => router.refresh(), 100);
  };

  const portalUrl = company?.public_slug
    ? (typeof window !== "undefined" ? window.location.origin : "") + "/portal/" + company.public_slug
    : null;

  const copyPortalLink = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
    }
  };

  return (
    <RequireCompany>
      <>
        {company?.public_slug && (
          <section className={styles["portal-link-section"]}>
            <h2 className={styles["portal-link-title"]}>Portal Link</h2>
            <div className={styles["portal-link-url"]}>{portalUrl}</div>
            <div className={styles["portal-link-actions"]}>
              <a
                href={portalUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className={styles["loi-cta-primary"]}
              >
                Apri portal
              </a>
              <button
                type="button"
                onClick={copyPortalLink}
                className={styles["loi-cta-secondary"]}
              >
                Copia link
              </button>
            </div>
          </section>
        )}

        {normalizedStatus === "signed" && (
          <div className={styles["loi-hero-copy"]}>
            <h2 className={styles["loi-hero-title"]}>Soft commitment attivo nel sistema FundOps</h2>
            <p className={styles["loi-hero-description"]}>
              Con la firma di questa LOI, l&apos;investitore ha espresso un impegno condizionato che contribuisce alla pianificazione della raccolta e all&apos;avvio delle fasi successive.
            </p>
          </div>
        )}

        <header className={styles["loi-header"]}>
        <div className={styles["loi-header-top"]}>
          <h1 className={styles["page-title"]}>
            LOI {loi.loi_number || loi.id}
          </h1>
          <LoiActions
            status={normalizedStatus}
            loiId={loi.id}
            companyId={companyId ?? undefined}
            onStatusUpdate={handleStatusUpdate}
            className={styles["loi-header-actions"]}
          />
        </div>
        <p className={styles["page-subtitle"]}>
          {loi.round_name || loi.title || "LOI"} {investor && `· Investitore: ${investor.full_name}`}
        </p>
        <div className={styles["page-meta-row"]}>
          <LoiStatusBadge status={normalizedStatus} size="medium" showSoftCommitment={true} />
        </div>
      </header>

      <div className={styles["detail-grid-cards"]}>
        <section className={styles["detail-card"]}>
          <h2 className={styles["detail-card-title"]}>Dati chiave</h2>
          <div className={styles["detail-card-content"]}>
            <div className={styles["detail-row"]}>
              <div className={styles["detail-label"]}>Ticket</div>
              <div className={styles["detail-value"]}>
                {formatCurrency(loi.ticket_amount, loi.currency)}
              </div>
            </div>
            <div className={styles["detail-row"]}>
              <div className={styles["detail-label"]}>Classe SFP</div>
              <div className={styles["detail-value"]}>{loi.sfp_class || "—"}</div>
            </div>
            <div className={styles["detail-row"]}>
              <div className={styles["detail-label"]}>Discount</div>
              <div className={styles["detail-value"]}>
                {loi.discount_percentage != null
                  ? `${loi.discount_percentage}%`
                  : "—"}
              </div>
            </div>
            <div className={styles["detail-row"]}>
              <div className={styles["detail-label"]}>Scadenza</div>
              <div className={styles["detail-value"]}>
                {loi.expiry_date ? (
                  <>
                    {formatDate(loi.expiry_date)}
                    {(() => {
                      const expiryInfo = getExpiryInfo(loi.expiry_date, loi.status);
                      return expiryInfo.daysToExpiry !== null ? (
                        <span className={`${styles["expiry-info-inline"]} ${styles[`expiry-info-${expiryInfo.classification}`]}`}>
                          {" "}({expiryInfo.label})
                        </span>
                      ) : null;
                    })()}
                  </>
                ) : "—"}
              </div>
            </div>
            {loi.expiry_date && (() => {
              const expiryInfo = getExpiryInfo(loi.expiry_date, loi.status);
              if (expiryInfo.classification === "danger" || expiryInfo.classification === "warning") {
                return (
                  <div className={`${styles["expiry-alert"]} ${styles[`expiry-alert-${expiryInfo.classification}`]}`}>
                    <strong>LOI in scadenza:</strong> {expiryInfo.label}
                  </div>
                );
              }
              return null;
            })()}
            <LoiMiniKPI loiId={loi.id} />
          </div>
        </section>

        <section className={styles["detail-card"]}>
          <h2 className={styles["detail-card-title"]}>Investitore</h2>
          <div className={styles["detail-card-content"]}>
            {investor ? (
              <>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Nome</div>
                  <div className={styles["detail-value"]}>{investor.full_name}</div>
                </div>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Email</div>
                  <div className={styles["detail-value"]}>{investor.email || "—"}</div>
                </div>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Telefono</div>
                  <div className={styles["detail-value"]}>{investor.phone || "—"}</div>
                </div>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Categoria</div>
                  <div className={styles["detail-value"]}>{investor.category || "—"}</div>
                </div>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Tipo</div>
                  <div className={styles["detail-value"]}>{investor.type || "—"}</div>
                </div>
                <div className={styles["detail-row"]}>
                  <Link
                    href={`/investors/${investor.id}`}
                    className={styles["small-button-link"]}
                  >
                    Vai all&apos;investitore
                  </Link>
                </div>
              </>
            ) : (
              <div className={styles["detail-value"]}>Investitore non trovato</div>
            )}
          </div>
        </section>

        <section className={styles["detail-card"]}>
          <h2 className={styles["detail-card-title"]}>Azienda</h2>
          <div className={styles["detail-card-content"]}>
            {company ? (
              <>
                <div className={styles["detail-row"]}>
                  <div className={styles["detail-label"]}>Nome</div>
                  <div className={styles["detail-value"]}>
                    {company.name || company.legal_name || "—"}
                  </div>
                </div>
                <div className={styles["detail-row"]}>
                  <Link
                    href="/companies"
                    className={styles["small-button-link"]}
                  >
                    Vai all&apos;azienda
                  </Link>
                </div>
              </>
            ) : (
              <div className={styles["detail-value"]}>Azienda non trovata</div>
            )}
          </div>
        </section>

        <section className={styles["detail-card"]}>
          <h2 className={styles["detail-card-title"]}>Prossima azione</h2>
          <div className={styles["detail-card-content"]}>
            <div className={styles["detail-value"]}>
              {normalizedStatus === "draft"
                ? "Inviare LOI all'investitore"
                : normalizedStatus === "sent"
                ? "Attendere firma / conferma"
                : normalizedStatus === "signed"
                ? "Procedere con onboarding e documenti"
                : normalizedStatus === "expired"
                ? "Riaprire o duplicare la LOI"
                : normalizedStatus === "cancelled"
                ? "Duplicare la LOI per crearne una nuova"
                : "—"}
            </div>
          </div>
        </section>
      </div>

      <section className={`${styles["portal-link-section"]} ${styles["portal-link-section-spaced"]}`}>
        <h2 className={styles["portal-link-title"]}>Signers</h2>
        {loadingSigners ? (
          <p className={styles["empty-text"]}>Caricamento...</p>
        ) : signers.length === 0 ? (
          <p className={styles["empty-text"]}>Nessun signer</p>
        ) : (
          <table className={styles["signers-table-readonly"]}>
            <thead>
              <tr>
                <th>Investitore</th>
                <th>Email</th>
                <th>Status</th>
                <th>soft_commitment_at</th>
                <th>hard_signed_at</th>
              </tr>
            </thead>
            <tbody>
              {signers.map((s) => (
                <tr key={s.id}>
                  <td>{s.investor?.full_name || "—"}</td>
                  <td>{s.investor?.email || "—"}</td>
                  <td><LoiStatusBadge status={s.status} size="small" /></td>
                  <td>{formatDateTime(s.soft_commitment_at)}</td>
                  <td>{formatDateTime(s.hard_signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {companyId && (
        <section className={`${styles["portal-link-section"]} ${styles["portal-link-section-spaced"]}`}>
          <h2 className={styles["portal-link-title"]}>KPI Booking</h2>
          <div className={styles["kpi-booking-grid"]}>
            <div className={styles["kpi-booking-card"]}>
              <div className={styles["kpi-booking-value"]}>{kpiBooking?.registered_count ?? "—"}</div>
              <div className={styles["kpi-booking-label"]}>Registered</div>
            </div>
            <div className={styles["kpi-booking-card"]}>
              <div className={styles["kpi-booking-value"]}>{kpiBooking?.loi_signed_count ?? "—"}</div>
              <div className={styles["kpi-booking-label"]}>LOI firmate</div>
            </div>
            <div className={styles["kpi-booking-card"]}>
              <div className={styles["kpi-booking-value"]}>{kpiBooking != null ? `${kpiBooking.conversion_rate}%` : "—"}</div>
              <div className={styles["kpi-booking-label"]}>Conversion rate</div>
            </div>
          </div>
        </section>
      )}

      <div className={styles["istruzioni-box"]}>
        <h3 className={styles["istruzioni-title"]}>Istruzioni test</h3>
        <ol className={styles["istruzioni-list"]}>
          <li>Apri il portal (pulsante sopra)</li>
          <li>Login come investitore</li>
          <li>Firma la LOI nel portal</li>
          <li>Torna qui e clicca Refresh per vedere lo status aggiornato</li>
        </ol>
        <button
          type="button"
          onClick={fetchSignersAndKpi}
          disabled={loadingSigners}
          className={`${styles["loi-cta-primary"]} ${styles["istruzioni-refresh-btn"]}`}
        >
          {loadingSigners ? "Caricamento..." : "Refresh"}
        </button>
      </div>

      <LoiTimeline loiId={loi.id} loiCreatedAt={loi.created_at ?? undefined} />
      <LoiDocuments loiId={loi.id} />
      </>
    </RequireCompany>
  );
}
