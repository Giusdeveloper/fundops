"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import LoiStatusBadge from "@/components/loi/LoiStatusBadge";
import { normalizeStatus } from "@/lib/loiStatus";
import { formatRelativeTime } from "@/lib/loiEvents";
import { useToast } from "@/components/ToastProvider";
import FundOpsProcessMap from "@/components/FundOpsProcessMap";
import FundOpsObjectsGrid from "@/components/FundOpsObjectsGrid";
import FundOpsPhaseKPIs from "@/components/FundOpsPhaseKPIs";
import styles from "./dashboard.module.css";

interface DashboardData {
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
  vat_number: string;
  address?: string;
}

interface ApiResponse<T> {
  data?: T[];
  error?: string;
}

export default function DashboardPage() {
  const { activeCompanyId: companyId } = useCompany();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const refreshing = false;
  const [actionLoading, setActionLoading] = useState<string | null>(null); // loiId in loading

  const fetchCompany = useCallback(async () => {
    if (!companyId || companyId.trim() === '') return;

    try {
      setLoadingCompany(true);
      const response = await fetch("/api/fundops_companies");

      if (!response.ok) {
        return;
      }

      const json: ApiResponse<Company> | Company[] = await response.json();
      const data = Array.isArray(json) ? json : json.data ?? [];
      const found = data.find((c: Company) => c.id === companyId);

      if (found) {
        setCompanyName(found.name || found.legal_name || null);
      }
    } catch {
      // Silent fail for company name
    } finally {
      setLoadingCompany(false);
    }
  }, [companyId]);

  const fetchDashboardData = useCallback(async () => {
    if (!companyId || companyId.trim() === '') return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/fundops_dashboard?companyId=${companyId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel caricamento della dashboard");
      }

      const data: DashboardData = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Handler per azioni TODO (send/reminder)
  const handleTodoAction = useCallback(async (loiId: string, suggestedAction: "send" | "reminder") => {
    if (!companyId) {
      showToast("Company ID mancante", "error");
      return;
    }

    // Evita double click
    if (actionLoading === loiId) {
      return;
    }

    setActionLoading(loiId);
    try {
      if (suggestedAction === "send") {
        // Invia LOI usando endpoint dedicato
        const response = await fetch(`/api/fundops_lois/${loiId}/send?companyId=${companyId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Errore nell'invio della LOI");
        }

        await response.json();
        showToast("LOI inviata con successo", "success");
      } else if (suggestedAction === "reminder") {
        // Invia reminder usando endpoint dedicato
        const response = await fetch(`/api/fundops_lois/${loiId}/reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ companyId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Errore nell'invio del reminder");
        }

        await response.json();
        showToast("Reminder inviato con successo", "success");
      }

      // Refetch dashboard dopo azione per aggiornare KPI/ToDo/RecentEvents
      await fetchDashboardData();
    } catch (error) {
      console.error("Errore nell'azione TODO:", error);
      showToast(error instanceof Error ? error.message : "Errore sconosciuto", "error");
    } finally {
      setActionLoading(null);
    }
  }, [companyId, fetchDashboardData, actionLoading, showToast]);

  useEffect(() => {
    if (companyId) {
      fetchCompany();
      fetchDashboardData();
    }
  }, [companyId, fetchCompany, fetchDashboardData]);

  // Listener per aggiornamento automatico dashboard dopo azioni LOI
  useEffect(() => {
    const handleLoiStatusUpdate = () => {
      // Refetch dashboard quando lo status di una LOI cambia
      if (companyId) {
        fetchDashboardData();
      }
    };

    const handleLoiEventCreated = () => {
      // Refetch dashboard quando viene creato un evento
      if (companyId) {
        fetchDashboardData();
      }
    };

    window.addEventListener('loi-status-updated', handleLoiStatusUpdate);
    window.addEventListener('loi-event-created', handleLoiEventCreated);

    return () => {
      window.removeEventListener('loi-status-updated', handleLoiStatusUpdate);
      window.removeEventListener('loi-event-created', handleLoiEventCreated);
    };
  }, [companyId, fetchDashboardData]);

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  };

  // Helper per formattare valori monetari in modo sicuro
  const safeCurrency = (value: number | null | undefined) => {
    const numValue = Number(value) || 0;
    return formatCurrency(numValue);
  };

  // KPI da dashboardData con fallback sicuro
  const kpis = dashboardData?.kpis || {
    pipelineTotal: 0,
    committedTotal: 0,
    expiringCount: 0,
    remindersLast30Days: 0,
  };

  const formattedPipelineTotal = safeCurrency(kpis.pipelineTotal);
  const formattedCommittedTotal = safeCurrency(kpis.committedTotal);

  // Costanti derivate per UI
  const userName = "Giuseppe";

  return (
    <RequireCompany>
      <>
      <section className={styles["dashboard-content"]}>
            {/* Error Message */}
            {error && (
              <p>Errore: {error}</p>
            )}

            {/* HERO */}
            {loading || loadingCompany ? (
              <p>Caricamento dashboard…</p>
            ) : (
              <>
                <div className={styles["hero-section"]}>
                  <h2 className={styles["hero-title"]}>
                    Ciao {userName}, ecco la situazione
                  </h2>
                  <p className={styles["hero-subtitle"]}>
                    Tieni tutto sotto controllo da un&apos;unica dashboard.
                  </p>
                  <div className={styles["hero-company-row"]}>
                    <span className={styles["hero-company-label"]}>Company</span>
                    <span className={styles["hero-company-pill"]}>{companyName || `ID: ${companyId}`}</span>
                  </div>
                </div>

                {/* SYSTEM VIEW: Process Map + Phase KPIs + Recent Activities */}
                <div className={styles["system-view-section"]}>
                  {/* FUNDOPS PROCESS MAP */}
                  <FundOpsProcessMap />

                  {/* FUNDOPS PHASE KPIs */}
                  <FundOpsPhaseKPIs />

                  {/* ATTIVITÀ RECENTI (Support section) */}
                  <section className={styles["feed-container-support"]}>
                    <h2 className={styles["section-title-support"]}>Attività recenti</h2>
                    {!dashboardData || dashboardData.recentEvents.length === 0 ? (
                      <p className={styles["empty-text"]}>Nessuna attività recente.</p>
                    ) : (
                      <>
                        <div className={styles["feed-items"]}>
                          {dashboardData.recentEvents.slice(0, 10).map((event) => (
                            <Link
                              key={event.eventId}
                              href={`/lois/${event.loiId}`}
                              className={styles["event-item-compact"]}
                            >
                              <div className={styles["event-compact-content"]}>
                                <div className={styles["event-compact-label"]}>{event.label}</div>
                                <div className={styles["event-compact-subject"]}>
                                  {event.investorName || "—"}
                                  {event.loiTitle && (
                                    <>
                                      <span className={styles["event-separator"]}> · </span>
                                      {event.loiTitle}
                                    </>
                                  )}
                                </div>
                                <div className={styles["event-compact-time"]}>
                                  {formatRelativeTime(event.createdAt)}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className={styles["feed-see-all"]}>
                          <Link href="/lois" className={styles["feed-see-all-button"]}>
                            Vedi tutte le attività
                          </Link>
                        </div>
                      </>
                    )}
                  </section>
                </div>

                {/* OPERATIONAL CONTENT */}
                <div className={styles["operational-content-section"]}>
                  {/* FUNDOPS OBJECTS GRID */}
                  <FundOpsObjectsGrid />

                  {/* OPERATIONAL WIDGETS SECTION */}
                  <div className={styles["operational-section"]}>
                    <h2 className={styles["section-divider-title"]}>Operatività</h2>
                    <div className={styles["widgets-grid"]}>
                    {/* Pipeline totale */}
                    <div className={styles["widget-card"]}>
                      <div className={`${styles["widget-icon-container"]} ${styles["widget-icon-fondi"]}`}>
                        ↗
                      </div>
                      <div>
                        <p className={styles["widget-value"]}>{formattedPipelineTotal}</p>
                        <p className={styles["widget-title"]}>Pipeline totale</p>
                        <p className={styles["widget-sub"]}>LOI draft/sent</p>
                      </div>
                    </div>

                    {/* Committed */}
                    <div className={styles["widget-card"]}>
                      <div className={`${styles["widget-icon-container"]} ${styles["widget-icon-loi"]}`}>
                        📄
                      </div>
                      <div>
                        <p className={styles["widget-value"]}>{formattedCommittedTotal}</p>
                        <p className={styles["widget-title"]}>Committed</p>
                        <p className={styles["widget-sub"]}>LOI firmate</p>
                      </div>
                    </div>

                    {/* LOI in scadenza */}
                    <div className={styles["widget-card"]}>
                      <div className={`${styles["widget-icon-container"]} ${styles["widget-icon-scadenza"]}`}>
                        📆
                      </div>
                      <div>
                        <p className={styles["widget-value"]}>{kpis.expiringCount ?? 0}</p>
                        <p className={styles["widget-title"]}>LOI in scadenza</p>
                        <p className={styles["widget-sub"]}>≤30 giorni</p>
                      </div>
                    </div>

                    {/* Reminder inviati */}
                    <div className={styles["widget-card"]}>
                      <div className={`${styles["widget-icon-container"]} ${styles["widget-icon-investors"]}`}>
                        🔔
                      </div>
                      <div>
                        <p className={styles["widget-value"]}>{kpis.remindersLast30Days ?? 0}</p>
                        <p className={styles["widget-title"]}>Reminder inviati</p>
                        <p className={styles["widget-sub"]}>ultimi 30 giorni</p>
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* SEZIONE "DA FARE ORA" */}
                  {dashboardData && dashboardData.todo.length > 0 && (
                    <section className={styles["todo-section"]}>
                      <h2 className={styles["section-title"]}>Da fare ora</h2>
                      <div className={styles["todo-list"]}>
                        {dashboardData.todo.map((item) => {
                          const expiryText = item.daysToExpiry === null 
                            ? "Data non definita"
                            : item.daysToExpiry < 0 
                            ? "Scaduta"
                            : `Scade tra ${item.daysToExpiry} giorni`;
                          
                          const expiryClass = item.daysToExpiry === null
                            ? styles["todo-expiry-soon"]
                            : item.daysToExpiry < 0
                            ? styles["todo-expiry-danger"]
                            : item.daysToExpiry <= 7
                            ? styles["todo-expiry-danger"]
                            : item.daysToExpiry <= 14
                            ? styles["todo-expiry-warning"]
                            : styles["todo-expiry-soon"];

                          // Gestione cooldown reminder
                          const isReminderCooldown = item.suggestedAction === "reminder" && 
                            item.reminderCooldownDaysLeft !== null && 
                            item.reminderCooldownDaysLeft > 0;
                          
                          const cooldownText = item.daysSinceLastReminder !== null && item.daysSinceLastReminder < 7
                            ? item.daysSinceLastReminder === 0
                              ? "Riprova tra 7 giorni"
                              : item.daysSinceLastReminder === 1
                              ? "Reminder inviato ieri"
                              : `Reminder inviato ${item.daysSinceLastReminder} giorni fa`
                            : null;

                          return (
                            <div key={item.loiId} className={styles["todo-item"]}>
                              <div className={styles["todo-content"]}>
                                <div className={styles["todo-header"]}>
                                  <Link 
                                    href={`/lois/${item.loiId}`}
                                    className={styles["todo-title-link"]}
                                  >
                                    <span className={styles["todo-title"]}>{item.loiTitle}</span>
                                  </Link>
                                  <LoiStatusBadge status={normalizeStatus(item.status)} size="small" />
                                </div>
                                <div className={styles["todo-investor"]}>
                                  {item.investorName || "—"}
                                </div>
                                <div className={styles["todo-meta"]}>
                                  <span className={expiryClass}>
                                    {expiryText}
                                  </span>
                                  {cooldownText && (
                                    <span className={styles["todo-cooldown"]} title={cooldownText}>
                                      {cooldownText}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={styles["todo-action"]}>
                                <button
                                  onClick={() => handleTodoAction(item.loiId, item.suggestedAction)}
                                  disabled={
                                    actionLoading === item.loiId || 
                                    refreshing || 
                                    isReminderCooldown
                                  }
                                  className={`${styles["todo-action-button"]} ${
                                    item.suggestedAction === "send" 
                                      ? styles["todo-action-primary"] 
                                      : styles["todo-action-secondary"]
                                  } ${isReminderCooldown ? styles["todo-action-disabled"] : ""}`}
                                  title={isReminderCooldown ? cooldownText || "Reminder in cooldown" : undefined}
                                >
                                  {actionLoading === item.loiId 
                                    ? "..." 
                                    : item.suggestedAction === "send" 
                                    ? "Invia LOI" 
                                    : isReminderCooldown
                                    ? `Cooldown (${item.reminderCooldownDaysLeft}g)`
                                    : "Invia reminder"}
                                </button>
                                <Link 
                                  href={`/lois/${item.loiId}`}
                                  className={styles["todo-open-link"]}
                                >
                                  Apri
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>

                {/* CTA IN FONDO – ALLINEATE COME NEL DESIGN */}
                <div className={styles["actions-footer"]}>
                  <button className={styles["action-button"]}>Aggiungi Investor</button>
                  <button className={styles["action-button"]}>Crea LOI</button>
                  <button className={styles["action-button"]}>Carica Documento</button>
                </div>
              </>
            )}
      </section>
      </>
    </RequireCompany>
  );
}

