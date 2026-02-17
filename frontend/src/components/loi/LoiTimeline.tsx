"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LoiEvent, formatRelativeTime, formatAbsoluteTime, getEventIcon } from "@/lib/loiEvents";
import {
  FileText,
  Mail,
  Bell,
  CheckCircle,
  Clock,
  RefreshCw,
  XCircle,
  Copy,
  Circle,
  MessageSquare,
  Edit,
  Upload,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { LoiEventType } from "@/lib/loiEvents";
import styles from "./LoiTimeline.module.css";

interface LoiTimelineProps {
  loiId: string;
  loiCreatedAt?: string;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  Mail,
  Bell,
  CheckCircle,
  Clock,
  RefreshCw,
  XCircle,
  Copy,
  Circle,
  MessageSquare,
  Edit,
  Upload,
  Trash2,
};

export default function LoiTimeline({ loiId, loiCreatedAt }: LoiTimelineProps) {
  const { showToast } = useToast();
  const [events, setEvents] = useState<LoiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/fundops_loi_events?loiId=${loiId}`);

      if (!response.ok) {
        throw new Error("Errore nel caricamento degli eventi");
      }

      const result = await response.json();
      setEvents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [loiId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setSubmittingNote(true);
    try {
      const response = await fetch("/api/fundops_loi_events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loi_id: loiId,
          event_type: LoiEventType.NOTE_ADDED,
          label: "Nota aggiunta",
          metadata: {
            note: noteText.trim(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'aggiunta della nota");
      }

      showToast("Nota aggiunta con successo", "success");
      setNoteText("");
      fetchEvents();
      window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Errore nell'aggiunta della nota",
        "error"
      );
    } finally {
      setSubmittingNote(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    // Ascolta eventi personalizzati per refresh automatico quando viene creato un nuovo evento
    const handleEventCreated = () => {
      fetchEvents();
    };
    
    window.addEventListener('loi-event-created', handleEventCreated);
    
    return () => {
      window.removeEventListener('loi-event-created', handleEventCreated);
    };
  }, [fetchEvents]);

  // Se non ci sono eventi e c'è una data di creazione LOI, mostra evento virtuale
  const hasVirtualCreatedEvent = events.length === 0 && loiCreatedAt;

  return (
    <section className={styles["timeline-section"]}>
      <h2 className={styles["timeline-title"]}>Attività</h2>
      <p className={styles["timeline-subtitle"]}>
        Cronologia degli eventi e delle azioni sulla LOI.
      </p>

      {loading ? (
        <div className={styles["timeline-loading"]}>
          <p>Caricamento...</p>
        </div>
      ) : error ? (
        <div className={styles["timeline-error"]}>
          <p>{error}</p>
          <button
            onClick={fetchEvents}
            className={styles["timeline-retry-button"]}
          >
            Riprova
          </button>
        </div>
      ) : events.length === 0 && !hasVirtualCreatedEvent ? (
        <div className={styles["timeline-empty"]}>
          <p>Nessuna attività registrata.</p>
        </div>
      ) : (
        <div className={styles["timeline-list"]}>
          {/* Evento virtuale "created" se non ci sono eventi */}
          {hasVirtualCreatedEvent && (
            <div className={styles["timeline-item"]}>
              <div className={styles["timeline-icon-wrapper"]}>
                <FileText size={16} className={styles["timeline-icon"]} />
              </div>
              <div className={styles["timeline-content"]}>
                <div className={styles["timeline-label"]}>LOI creata</div>
                <div className={styles["timeline-time"]}>
                  <span className={styles["timeline-relative"]}>
                    {formatRelativeTime(loiCreatedAt!)}
                  </span>
                  <span className={styles["timeline-absolute"]}>
                    {formatAbsoluteTime(loiCreatedAt!)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Eventi reali */}
          {events.map((event) => {
            const IconComponent =
              iconMap[getEventIcon(event.event_type)] || Circle;
            
            // Costruisci label con metadata se presente
            let displayLabel = event.label;
            if (event.event_type === LoiEventType.NOTE_ADDED && event.metadata?.note) {
              displayLabel = `Nota: ${event.metadata.note}`;
            } else if (event.event_type === LoiEventType.STATUS_CHANGED && event.metadata) {
              const from = event.metadata.from || "—";
              const to = event.metadata.to || "—";
              displayLabel = `Stato aggiornato: ${from} → ${to}`;
            }

            // Actor: usa created_by se presente, altrimenti "System"
            const actor = event.created_by || "System";

            return (
              <div key={event.id} className={styles["timeline-item"]}>
                <div className={styles["timeline-icon-wrapper"]}>
                  <IconComponent size={16} className={styles["timeline-icon"]} />
                </div>
                <div className={styles["timeline-content"]}>
                  <div className={styles["timeline-label"]}>{displayLabel}</div>
                  <div className={styles["timeline-meta"]}>
                    <span className={styles["timeline-actor"]}>{actor}</span>
                    <span className={styles["timeline-time"]}>
                      <span className={styles["timeline-relative"]} title={formatAbsoluteTime(event.created_at)}>
                        {formatRelativeTime(event.created_at)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Aggiungi nota */}
      <form onSubmit={handleAddNote} className={styles["timeline-note-form"]}>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Aggiungi una nota..."
          rows={3}
          className={styles["timeline-note-input"]}
          disabled={submittingNote}
        />
        <button
          type="submit"
          disabled={!noteText.trim() || submittingNote}
          className={styles["timeline-note-button"]}
        >
          {submittingNote ? "Invio..." : "Aggiungi nota"}
        </button>
      </form>
    </section>
  );
}
