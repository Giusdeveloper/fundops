"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
import { normalizeStatus } from "@/lib/loiStatus";
import { formatRelativeTime } from "@/lib/loiEvents";
import { useToast } from "@/components/ToastProvider";
import FundOpsObjectsGrid from "@/components/FundOpsObjectsGrid";
import ViewModeToggle from "@/components/ViewModeToggle";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

interface DashboardRoundContext {
  id: string;
  status: string | null;
  booking_open: boolean | null;
  issuance_open: boolean | null;
  booking_deadline: string | null;
  issuance_deadline: string | null;
  target_amount?: number | null;
}

interface PhaseCardData {
  title: string;
  subtitle: string;
  description: string;
  actions: string[];
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  statusLabel: string;
  ctaDisabled?: boolean;
}

interface PhaseCardsData {
  booking: PhaseCardData;
  issuance: PhaseCardData;
  onboarding: PhaseCardData;
}
type PhaseKey = "booking" | "issuance" | "onboarding";

interface DashboardData {
  dashboardContext: {
    round: DashboardRoundContext | null;
    signedLoiCount: number;
    softCommitmentSum: number;
    investorsCount: number;
    bookingProgressPct: number | null;
    bookingProgressLabel: string | null;
  };
  kpis: {
    pipelineTotal: number;
    committedTotal: number;
    expiringCount: number;
    remindersLast30Days: number;
  };
  todo: Array<{
    loiId: string;
    loiTitle: string;
    investorName: string | null;
    status: "draft" | "sent" | "signed" | "expired" | "cancelled";
    daysToExpiry: number | null;
    suggestedAction: "send" | "reminder";
    lastReminderAt: string | null;
    daysSinceLastReminder: number | null;
    reminderCooldownDaysLeft: number | null;
  }>;
  recentEvents: Array<{
    eventId: string;
    label: string;
    createdAt: string;
    loiId: string;
    loiTitle: string | null;
    investorName: string | null;
  }>;
}

interface Company {
  id: string;
  name: string;
  legal_name: string;
  phase?: "booking" | "issuance" | "onboarding" | null;
}

interface ApiResponse<T> {
  data?: T[];
}

interface NextActionMetrics {
  loiSignedCount: number;
  investorsActiveCount: number;
  committedAmount: number;
  bookingProgressPct: number | null;
}

interface SubmissionAmountRow {
  amount_eur: number | string | null;
}

function computePhaseCards(
  round: DashboardRoundContext | null,
  signedLoiCount: number,
  companyPhase: "booking" | "issuance" | "onboarding" | null
): PhaseCardsData {
  let bookingStatusLabel = "Da avviare";
  let bookingMessage = "Avvia raccolta LOI e attivazione investitori.";

  if (signedLoiCount >= 1 && signedLoiCount <= 4) {
    bookingStatusLabel = "In corso";
    bookingMessage = "Raccolta LOI in corso.";
  } else if (signedLoiCount >= 5) {
    bookingStatusLabel = "Pronto";
    bookingMessage = "Validazione raggiunta. Preparati a Issuance.";
  }
  if (companyPhase === "issuance") {
    bookingStatusLabel = "In corso";
  }

  const issuingIsActive = Boolean(round?.issuance_open);
  const onboardingIsAvailable = round?.status === "closed";

  return {
    booking: {
      title: "Booking",
      subtitle: "Attivazione investitori e raccolta LOI",
      description:
        "Raccogli soft-commitment tramite LOI e validi l’interesse reale sul round.",
      actions: [
        "Inviti e onboarding investitori",
        "Firma LOI e attestazioni",
      ],
      message: bookingMessage,
      ctaLabel: signedLoiCount >= 5 ? "Vai a LOI" : "Vai agli investitori",
      ctaHref: signedLoiCount >= 5 ? "/lois" : "/investors",
      statusLabel: bookingStatusLabel,
    },
    issuance: {
      title: "Issuance",
      subtitle: "Formalizzazione investimento",
      description:
        "Trasformi il booking in operatività: documenti, importi e verifiche fino alla conferma.",
      actions: [
        "Raccolta modulo firmato e prova bonifico",
        "Revisione e approvazione investimenti",
      ],
      message: issuingIsActive
        ? "Issuance attiva."
        : "Issuance non attiva.",
      ctaLabel: issuingIsActive ? "Gestisci documenti" : "Configura Issuance",
      ctaHref: issuingIsActive ? "/lois" : "/admin",
      statusLabel: issuingIsActive ? "Attiva" : "Non attiva",
    },
    onboarding: {
      title: "Onboarding",
      subtitle: "Gestione investitori post-emissione",
      description:
        "Completi l’ingresso investitore, chiudi il ciclo operativo e prepari i prossimi round.",
      actions: [
        "Archivio documenti e ricevute",
        "Comunicazioni e aggiornamenti",
      ],
      message: onboardingIsAvailable
        ? "Onboarding disponibile."
        : "In attesa chiusura round.",
      ctaLabel: onboardingIsAvailable ? "Vai a Supporter Area" : null,
      ctaHref: onboardingIsAvailable ? "/investor/dashboard" : null,
      statusLabel: onboardingIsAvailable ? "Disponibile" : "In attesa",
      ctaDisabled: !onboardingIsAvailable,
    },
  };
}

function getNextActionState(
  round: DashboardRoundContext | null,
  metrics: NextActionMetrics
) {
  if (!round) {
    return {
      tone: "danger" as const,
      title: "Next Action",
      message: "Seleziona e configura una company prima di avviare il round.",
      ctaLabel: "Vai a companies",
      ctaHref: "/companies",
    };
  }
  if (round.booking_open && metrics.loiSignedCount === 0) {
    return {
      tone: "warning" as const,
      title: "Next Action",
      message:
        "Booking attivo, ma nessuna LOI firmata. Inizia da una lista target e guida alla firma.",
      ctaLabel: "Invita investitori",
      ctaHref: "/investors",
    };
  }
  if (round.booking_open && metrics.loiSignedCount > 0) {
    return {
      tone: "success" as const,
      title: "Next Action",
      message:
        "Booking in corso con LOI firmate. Spingi i pending e prepara Issuance.",
      ctaLabel: "Vai a LOI",
      ctaHref: "/lois",
    };
  }
  if ((!round.booking_open || round.status === "closed") && metrics.loiSignedCount > 0) {
    return {
      tone: "success" as const,
      title: "Next Action",
      message:
        "Booking chiuso con LOI firmate. Procedi in Issuance senza alterare lo storico.",
      ctaLabel: "Vai a Issuance",
      ctaHref: "/issuance",
    };
  }
  return {
    tone: "danger" as const,
    title: "Next Action",
    message:
      "Booking chiuso senza LOI firmate. Rivedi target/inviti o apri un nuovo round.",
    ctaLabel: "Crea nuovo round",
    ctaHref: "/companies",
  };
}

export default function DashboardPage() {
  const { activeCompanyId: companyId } = useCompany();
  const { showToast } = useToast();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyPhase, setCompanyPhase] = useState<"booking" | "issuance" | "onboarding" | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showIssuanceModal, setShowIssuanceModal] = useState(false);
  const [activatingIssuance, setActivatingIssuance] = useState(false);
  const [submittedCommittedTotal, setSubmittedCommittedTotal] = useState<number>(0);
  const [issuanceToVerifyCount, setIssuanceToVerifyCount] = useState<number>(0);

  const fetchDashboardData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const [response, submittedResult, issuanceSubmittedCountResult] = await Promise.all([
        fetch(`/api/fundops_dashboard?companyId=${companyId}`, { cache: "no-store" }),
        supabase
          .from("fundops_investment_submissions")
          .select("amount_eur")
          .eq("company_id", companyId)
          .eq("status", "submitted"),
        supabase
          .from("fundops_investments")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "submitted"),
      ]);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel caricamento della dashboard");
      }
      const data: DashboardData = await response.json();
      setDashboardData(data);

      if (submittedResult.error) {
        console.warn("[dashboard] committed submissions query failed", submittedResult.error);
        setSubmittedCommittedTotal(0);
      } else {
        const submittedRows = (submittedResult.data ?? []) as SubmissionAmountRow[];
        const total = submittedRows.reduce((sum: number, row: SubmissionAmountRow) => {
          return sum + Number(row.amount_eur ?? 0);
        }, 0);
        setSubmittedCommittedTotal(total);
      }

      if (issuanceSubmittedCountResult.error) {
        console.warn(
          "[dashboard] issuance submitted count query failed",
          issuanceSubmittedCountResult.error
        );
        setIssuanceToVerifyCount(0);
      } else {
        setIssuanceToVerifyCount(Number(issuanceSubmittedCountResult.count ?? 0));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingCompany(true);
      const response = await fetch("/api/fundops_companies", { cache: "no-store" });
      if (!response.ok) return;
      const json: ApiResponse<Company> | Company[] = await response.json();
      const data = Array.isArray(json) ? json : json.data ?? [];
      const found = data.find((c: Company) => c.id === companyId);
      if (found) {
        setCompanyName(found.name || found.legal_name || null);
        setCompanyPhase(found.phase ?? null);
      } else {
        setCompanyName(null);
        setCompanyPhase(null);
      }
    } finally {
      setLoadingCompany(false);
    }
  }, [companyId]);

  const handleActivateIssuance = useCallback(async () => {
    if (!companyId || activatingIssuance) return;

    try {
      setActivatingIssuance(true);

      const response = await fetch(`/api/companies/${companyId}/phase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phase: "issuance" }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Errore attivazione Issuance");
      }

      setShowIssuanceModal(false);
      setCompanyPhase("issuance");
      showToast("Fase Issuance attivata con successo", "success");
      router.refresh();
      await fetchCompany();
      await fetchDashboardData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore sconosciuto", "error");
    } finally {
      setActivatingIssuance(false);
    }
  }, [activatingIssuance, companyId, fetchCompany, fetchDashboardData, router, showToast]);

  useEffect(() => {
    if (companyId) {
      fetchCompany();
      fetchDashboardData();
    }
  }, [companyId, fetchCompany, fetchDashboardData]);

  useEffect(() => {
    let isMounted = true;
    const fetchCurrentUser = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!isMounted || !data.user) return;
        const metadata = data.user.user_metadata as { full_name?: string; name?: string } | undefined;
        setUserName(metadata?.full_name || metadata?.name || data.user.email?.split("@")[0] || null);
      } catch {}
    };
    fetchCurrentUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTodoAction = useCallback(
    async (loiId: string, suggestedAction: "send" | "reminder") => {
      if (!companyId || actionLoading === loiId) return;
      setActionLoading(loiId);
      try {
        if (suggestedAction === "send") {
          const response = await fetch(`/api/fundops_lois/${loiId}/send?companyId=${companyId}`, { method: "POST" });
          if (!response.ok) throw new Error("Errore nell'invio della LOI");
          showToast("LOI inviata con successo", "success");
        } else {
          const response = await fetch(`/api/fundops_lois/${loiId}/reminder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId }),
          });
          if (!response.ok) throw new Error("Errore nell'invio del reminder");
          showToast("Reminder inviato con successo", "success");
        }
        await fetchDashboardData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Errore sconosciuto", "error");
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, companyId, fetchDashboardData, showToast]
  );

  const dashboardContext = dashboardData?.dashboardContext ?? null;
  const bookingProgress = Math.max(0, Math.min(100, dashboardContext?.bookingProgressPct ?? 0));
  const phaseCards = computePhaseCards(
    dashboardContext?.round ?? null,
    dashboardContext?.signedLoiCount ?? 0,
    companyPhase
  );
  const currentPhase: PhaseKey =
    companyPhase === "onboarding"
      ? "onboarding"
      : companyPhase === "issuance"
      ? "issuance"
      : companyPhase === "booking"
      ? "booking"
      : dashboardContext?.round?.status === "closed"
      ? "onboarding"
      : dashboardContext?.round?.issuance_open
      ? "issuance"
      : "booking";
  const nextAction = getNextActionState(dashboardContext?.round ?? null, {
    loiSignedCount: dashboardContext?.signedLoiCount ?? 0,
    investorsActiveCount: dashboardContext?.investorsCount ?? 0,
    committedAmount: dashboardContext?.softCommitmentSum ?? 0,
    bookingProgressPct: dashboardContext?.bookingProgressPct ?? null,
  });
  const phaseLabel =
    companyPhase === "issuance"
      ? "Issuance"
      : companyPhase === "onboarding"
      ? "Onboarding"
      : "Booking";
  const committedValue = submittedCommittedTotal;

  return (
    <RequireCompany>
      <section className={styles["dashboard-content"]}>
        {error && <div className={`${styles["status-message"]} ${styles["status-error"]}`}>Errore: {error}</div>}
        {loading || loadingCompany ? (
          <div className={`${styles["status-message"]} ${styles["status-loading"]}`}>Caricamento dashboard...</div>
        ) : (
          <>
            <div className={styles.kpiRow}>
              <div className={styles.kpiCard}><p className={styles.kpiCardLabel}>Investitori attivi</p><p className={styles.kpiCardValue}>{dashboardContext?.investorsCount ?? 0}</p><p className={styles.kpiCardHint}>Investitori in pipeline attiva. Mantieni engagement con follow-up puntuali.</p></div>
              <div className={styles.kpiCard}><p className={styles.kpiCardLabel}>LOI firmate</p><p className={styles.kpiCardValue}>{dashboardContext?.signedLoiCount ?? 0}</p><p className={styles.kpiCardHint}>LOI completate nel round. Riduci pending con reminder mirati.</p></div>
              <div className={styles.kpiCard}><p className={styles.kpiCardLabel}>Capitale prenotato</p><p className={styles.kpiCardValue}>{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(dashboardContext?.softCommitmentSum ?? 0))}</p><p className={styles.kpiCardHint}>Soft-commitment raccolto. Migliora conversione sui profili in target.</p></div>
              <div className={`${styles.kpiCard} ${styles.kpiCardBooking}`}>
                <p className={styles.kpiCardLabel}>Avanzamento booking</p>
                <p className={styles.kpiCardValue}>{dashboardContext?.bookingProgressPct == null ? "—" : `${Math.round(bookingProgress)}%`}</p>
                <div className={styles.bookingProgressTrack}><div className={styles.bookingProgressFill} style={{ width: `${bookingProgress}%` }} /></div>
                <p className={styles.kpiCardSub}>{dashboardContext?.bookingProgressLabel ?? "Target non impostato"}</p>
                <p className={styles.kpiCardHint}>Quota verso il target round. Agisci su inviti e follow-up.</p>
              </div>
            </div>

            <section className={`${styles.nextActionBox} ${nextAction.tone === "success" ? styles.nextActionSuccess : nextAction.tone === "warning" ? styles.nextActionWarning : styles.nextActionDanger}`}>
              <div>
                <p className={styles.nextActionTitle}>{nextAction.title}</p>
                <p className={styles.nextActionMessage}>{nextAction.message}</p>
              </div>
              {companyPhase === "booking" &&
              Boolean(dashboardContext?.round?.booking_open) &&
              (dashboardContext?.signedLoiCount ?? 0) > 0 ? (
                <button
                  type="button"
                  className={styles.ctaButton}
                  onClick={() => setShowIssuanceModal(true)}
                >
                  Attiva Issuance
                </button>
              ) : (
                <Link href={nextAction.ctaHref} className={styles.ctaButton}>{nextAction.ctaLabel}</Link>
              )}
            </section>

            <section className={styles.issuanceCard}>
              <div>
                <p className={styles.issuanceCardLabel}>Issuance</p>
                <p className={styles.issuanceCardValue}>
                  {issuanceToVerifyCount} investimenti da verificare
                </p>
              </div>
              <Link href="/issuance" className={styles.ctaButton}>
                Apri Issuance
              </Link>
            </section>

            <section className={styles.heroPanel}>
              <div className={styles["hero-section"]}>
                <h2 className={styles["hero-title"]}>Benvenuto in FundOps</h2>
                <p className={styles["hero-welcome-line"]}>
                  Qui gestisci l’intero flusso investitori: Booking, Issuance e Onboarding.
                </p>
                <p className={styles["hero-subtitle"]}>
                  Monitora KPI, documenti e stati dei round in un’unica dashboard.
                </p>
                {userName && <p className={styles["hero-user"]}>Utente: {userName}</p>}
                <div className={styles["hero-company-row"]}>
                  <span className={styles["hero-company-label"]}>Company</span>
                  <span className={styles["hero-company-pill"]}>{companyName || `ID: ${companyId}`}</span>
                  <span className={styles["hero-company-pill"]}>Fase: {phaseLabel}</span>
                  <ViewModeToggle
                    onChanged={(m) => {
                      // refresh hard (così server components + session + redirect ricalcolano tutto)
                      window.location.href = m === "investor" ? "/investor/dashboard" : "/dashboard";
                    }}
                  />
                </div>
              </div>
              <section className={styles.processMapContainer}>
                <div className={styles.processMapHeader}>
                  <h2 className={styles.processMapTitle}>FundOps Process Map</h2>
                  <p className={styles.processMapSubtitle}>Stato attuale del processo</p>
                </div>

                <div className={styles.processMapGrid}>
                  <article
                    className={`${styles.processCard} ${
                      currentPhase === "booking" ? styles.processCardCurrent : ""
                    }`}
                  >
                    <div className={styles.processCardTop}>
                      <div>
                        <div className={styles.processCardTitleRow}>
                          <h3 className={styles.processCardTitle}>Booking</h3>
                          {currentPhase === "booking" && (
                            <span className={styles.processCurrentBadge}>
                              <span className={styles.processCurrentBadgeIcon} aria-hidden="true">📍</span>
                              Sei qui
                            </span>
                          )}
                        </div>
                        <p className={styles.processCardSubtitle}>{phaseCards.booking.subtitle}</p>
                      </div>
                      <span className={styles.processCardStatus}>{phaseCards.booking.statusLabel}</span>
                    </div>
                    <p className={styles.processCardDescription}>{phaseCards.booking.description}</p>
                    <p className={styles.processCardListTitle}>Cosa fai qui</p>
                    <ul className={styles.processCardList}>
                      {phaseCards.booking.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    {currentPhase === "booking" && (
                      <p className={styles.processCardMessage}>{phaseCards.booking.message}</p>
                    )}
                    <div className={styles.kpiMiniGrid}>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>{dashboardContext?.investorsCount ?? 0}</span>
                        <span className={styles.kpiMiniLabel}>Investitori attivi</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>LOI attive</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>{dashboardContext?.signedLoiCount ?? 0}</span>
                        <span className={styles.kpiMiniLabel}>LOI firmate</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>
                          {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                            Number(dashboardData?.kpis?.pipelineTotal ?? 0)
                          )}
                        </span>
                        <span className={styles.kpiMiniLabel}>Pipeline</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>
                          {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                            Number(committedValue)
                          )}
                        </span>
                        <span className={styles.kpiMiniLabel}>Committed</span>
                      </div>
                    </div>
                    {phaseCards.booking.ctaLabel && phaseCards.booking.ctaHref && (
                      <Link href={phaseCards.booking.ctaHref} className={styles.processCardCta}>
                        {phaseCards.booking.ctaLabel}
                      </Link>
                    )}
                  </article>

                  <article
                    className={`${styles.processCard} ${
                      currentPhase === "issuance" ? styles.processCardCurrent : ""
                    }`}
                  >
                    <div className={styles.processCardTop}>
                      <div>
                        <div className={styles.processCardTitleRow}>
                          <h3 className={styles.processCardTitle}>Issuance</h3>
                          {currentPhase === "issuance" && (
                            <span className={styles.processCurrentBadge}>
                              <span className={styles.processCurrentBadgeIcon} aria-hidden="true">📍</span>
                              Sei qui
                            </span>
                          )}
                        </div>
                        <p className={styles.processCardSubtitle}>{phaseCards.issuance.subtitle}</p>
                      </div>
                      <span className={styles.processCardStatus}>{phaseCards.issuance.statusLabel}</span>
                    </div>
                    <p className={styles.processCardDescription}>{phaseCards.issuance.description}</p>
                    <p className={styles.processCardListTitle}>Cosa fai qui</p>
                    <ul className={styles.processCardList}>
                      {phaseCards.issuance.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    {currentPhase === "issuance" && (
                      <p className={styles.processCardMessage}>{phaseCards.issuance.message}</p>
                    )}
                    <div className={styles.kpiMiniGrid}>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                    </div>
                    {phaseCards.issuance.ctaLabel && phaseCards.issuance.ctaHref && (
                      <Link href={phaseCards.issuance.ctaHref} className={styles.processCardCta}>
                        {phaseCards.issuance.ctaLabel}
                      </Link>
                    )}
                  </article>

                  <article
                    className={`${styles.processCard} ${
                      currentPhase === "onboarding" ? styles.processCardCurrent : ""
                    }`}
                  >
                    <div className={styles.processCardTop}>
                      <div>
                        <div className={styles.processCardTitleRow}>
                          <h3 className={styles.processCardTitle}>Onboarding</h3>
                          {currentPhase === "onboarding" && (
                            <span className={styles.processCurrentBadge}>
                              <span className={styles.processCurrentBadgeIcon} aria-hidden="true">📍</span>
                              Sei qui
                            </span>
                          )}
                        </div>
                        <p className={styles.processCardSubtitle}>{phaseCards.onboarding.subtitle}</p>
                      </div>
                      <span className={styles.processCardStatus}>{phaseCards.onboarding.statusLabel}</span>
                    </div>
                    <p className={styles.processCardDescription}>{phaseCards.onboarding.description}</p>
                    <p className={styles.processCardListTitle}>Cosa fai qui</p>
                    <ul className={styles.processCardList}>
                      {phaseCards.onboarding.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    {currentPhase === "onboarding" && (
                      <p className={styles.processCardMessage}>{phaseCards.onboarding.message}</p>
                    )}
                    <div className={styles.kpiMiniGrid}>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                      <div className={styles.kpiMiniItem}>
                        <span className={styles.kpiMiniValue}>—</span>
                        <span className={styles.kpiMiniLabel}>—</span>
                      </div>
                    </div>
                    {phaseCards.onboarding.ctaLabel && phaseCards.onboarding.ctaHref && (
                      <Link href={phaseCards.onboarding.ctaHref} className={styles.processCardCta}>
                        {phaseCards.onboarding.ctaLabel}
                      </Link>
                    )}
                  </article>
                </div>
              </section>
            </section>

            <div className={styles["system-view-section"]}>
              <FundOpsObjectsGrid />
              <section className={styles["feed-container-support"]}>
                <h2 className={styles["section-title-support"]}>Attività recenti</h2>
                {!dashboardData || dashboardData.recentEvents.length === 0 ? (
                  <p className={styles["empty-text"]}>Nessuna attività recente.</p>
                ) : (
                  <>
                    <div className={styles["feed-items"]}>
                      {dashboardData.recentEvents.slice(0, 10).map((event) => (
                        <Link key={event.eventId} href={`/lois/${event.loiId}`} className={styles["event-item-compact"]}>
                          <div className={styles["event-compact-content"]}>
                            <div className={styles["event-compact-label"]}>{event.label}</div>
                            <div className={styles["event-compact-subject"]}>{event.investorName || "—"}{event.loiTitle ? <><span className={styles["event-separator"]}> · </span>{event.loiTitle}</> : null}</div>
                            <div className={styles["event-compact-time"]}>{formatRelativeTime(event.createdAt)}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className={styles["feed-see-all"]}><Link href="/lois" className={styles["feed-see-all-button"]}>Vedi tutte le attività</Link></div>
                  </>
                )}
              </section>
            </div>

            <div className={styles["operational-content-section"]}>
              {dashboardData && dashboardData.todo.length > 0 && (
                <section className={styles["todo-section"]}>
                  <h2 className={styles["section-title"]}>Da fare ora</h2>
                  <div className={styles["todo-list"]}>
                    {dashboardData.todo.map((item) => (
                      <div key={item.loiId} className={styles["todo-item"]}>
                        <div className={styles["todo-content"]}>
                          <div className={styles["todo-header"]}>
                            <Link href={`/lois/${item.loiId}`} className={styles["todo-title-link"]}><span className={styles["todo-title"]}>{item.loiTitle}</span></Link>
                            <LoiStatusBadge status={normalizeStatus(item.status)} size="small" />
                          </div>
                          <div className={styles["todo-investor"]}>{item.investorName || "—"}</div>
                        </div>
                        <div className={styles["todo-action"]}>
                          <button onClick={() => handleTodoAction(item.loiId, item.suggestedAction)} disabled={actionLoading === item.loiId} className={`${styles["todo-action-button"]} ${item.suggestedAction === "send" ? styles["todo-action-primary"] : styles["todo-action-secondary"]}`}>
                            {actionLoading === item.loiId ? "..." : item.suggestedAction === "send" ? "Invia LOI" : "Invia reminder"}
                          </button>
                          <Link href={`/lois/${item.loiId}`} className={styles["todo-open-link"]}>Apri</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {showIssuanceModal && (
              <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="issuance-modal-title">
                <div className={styles.modalCard}>
                  <h3 id="issuance-modal-title" className={styles.modalTitle}>
                    Attivare la fase Issuance?
                  </h3>
                  <p className={styles.modalText}>
                    Puoi avviare Issuance anche se Booking resta aperto. Gli investitori con LOI firmata potranno caricare la documentazione.
                  </p>
                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.modalCancelButton}
                      onClick={() => setShowIssuanceModal(false)}
                      disabled={activatingIssuance}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className={styles.ctaButton}
                      onClick={handleActivateIssuance}
                      disabled={activatingIssuance}
                    >
                      {activatingIssuance ? "Attivazione..." : "Attiva Issuance"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </section>
    </RequireCompany>
  );
}
