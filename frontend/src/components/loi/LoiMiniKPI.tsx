"use client";

import { useState, useEffect } from "react";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/loiEvents";
import { LoiEventType } from "@/lib/loiEvents";
import styles from "./LoiMiniKPI.module.css";

interface LoiMiniKPIProps {
  loiId: string;
}

interface LoiEventRow {
  event_type: LoiEventType | string;
  created_at: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("it-IT");
  } catch {
    return dateString.slice(0, 10);
  }
};

export default function LoiMiniKPI({ loiId }: LoiMiniKPIProps) {
  const [kpiData, setKpiData] = useState<{
    ticketAmount: number | null;
    currency: string | null;
    createdAt: string | null;
    sentAt: string | null;
    reminderCount: number;
    lastReminderAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        setLoading(true);
        
        // Carica LOI per ticket amount e creazione
        const loiResponse = await fetch(`/api/fundops_lois/${loiId}`);
        if (!loiResponse.ok) return;
        
        const loiData = await loiResponse.json();
        const loi = loiData.data;

        // Carica eventi per sentAt, reminderCount, lastReminderAt
        const eventsResponse = await fetch(`/api/fundops_loi_events?loiId=${loiId}`);
        if (!eventsResponse.ok) return;
        
        const eventsData = await eventsResponse.json();
        const events = (eventsData.data || []) as LoiEventRow[];

        // Trova evento sent
        const sentEvent = events.find((e) => e.event_type === LoiEventType.SENT);
        
        // Conta reminder e trova ultimo
        const reminderEvents = events.filter((e) => e.event_type === LoiEventType.REMINDER);
        const lastReminder = reminderEvents.length > 0 
          ? reminderEvents.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
          : null;

        setKpiData({
          ticketAmount: loi.ticket_amount || null,
          currency: loi.currency || "EUR",
          createdAt: loi.created_at || null,
          sentAt: sentEvent?.created_at || null,
          reminderCount: reminderEvents.length,
          lastReminderAt: lastReminder?.created_at || null,
        });
      } catch (err) {
        console.error("Errore nel caricamento KPI:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchKPI();
  }, [loiId]);

  if (loading || !kpiData) {
    return (
      <div className={styles["kpi-loading"]}>
        <p>Caricamento...</p>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  };

  return (
    <>
      <div className={styles["detail-row"]}>
        <div className={styles["detail-label"]}>Ticket amount</div>
        <div className={styles["detail-value"]}>
          {kpiData.ticketAmount !== null
            ? formatCurrency(kpiData.ticketAmount, kpiData.currency || undefined)
            : "—"}
        </div>
      </div>
      <div className={styles["detail-row"]}>
        <div className={styles["detail-label"]}>Data creazione</div>
        <div className={styles["detail-value"]}>
          {kpiData.createdAt ? formatDate(kpiData.createdAt) : "—"}
        </div>
      </div>
      <div className={styles["detail-row"]}>
        <div className={styles["detail-label"]}>Data invio</div>
        <div className={styles["detail-value"]}>
          {kpiData.sentAt ? (
            <>
              {formatDate(kpiData.sentAt)}
              <span className={styles["kpi-relative"]} title={formatAbsoluteTime(kpiData.sentAt)}>
                {" "}({formatRelativeTime(kpiData.sentAt)})
              </span>
            </>
          ) : "—"}
        </div>
      </div>
      <div className={styles["detail-row"]}>
        <div className={styles["detail-label"]}>Reminder inviati</div>
        <div className={styles["detail-value"]}>
          {kpiData.reminderCount}
        </div>
      </div>
      <div className={styles["detail-row"]}>
        <div className={styles["detail-label"]}>Ultimo reminder</div>
        <div className={styles["detail-value"]}>
          {kpiData.lastReminderAt ? (
            <>
              {formatRelativeTime(kpiData.lastReminderAt)}
              <span className={styles["kpi-absolute"]} title={formatAbsoluteTime(kpiData.lastReminderAt)}>
                {" "}({formatDate(kpiData.lastReminderAt)})
              </span>
            </>
          ) : "Mai"}
        </div>
      </div>
    </>
  );
}
