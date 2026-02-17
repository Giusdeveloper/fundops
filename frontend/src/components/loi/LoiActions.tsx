"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LoiStatus, normalizeStatus } from "@/lib/loiStatus";
import { LoiEventType } from "@/lib/loiEvents";
import { useToast } from "@/components/ToastProvider";
import styles from "./LoiActions.module.css";

interface LoiActionsProps {
  status: LoiStatus | string;
  loiId: string;
  companyId?: string;
  onStatusUpdate?: (newStatus: LoiStatus) => void;
  className?: string;
}

/**
 * Componente riusabile per le azioni contestuali di una LOI in base al suo status
 */
export default function LoiActions({
  status,
  loiId,
  companyId,
  onStatusUpdate,
  className = "",
}: LoiActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const normalizedStatus = normalizeStatus(status);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Costruisce l'URL con companyId se presente
  const buildUrl = (path: string) => {
    const url = new URL(path, window.location.origin);
    if (companyId) {
      url.searchParams.set("companyId", companyId);
    }
    return url.pathname + url.search;
  };

  // Funzione per aggiornare lo status
  const updateStatus = async (newStatus: LoiStatus) => {
    if (isLoading) return;

    setIsLoading(newStatus);
    try {
      const response = await fetch(`/api/fundops_lois/${loiId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'aggiornamento dello status");
      }

      await response.json();
      
      // Crea evento corrispondente allo status update
      let eventType: LoiEventType | null = null;
      if (newStatus === LoiStatus.SENT) {
        eventType = LoiEventType.SENT;
      } else if (newStatus === LoiStatus.SIGNED) {
        eventType = LoiEventType.SIGNED;
      }

      // Crea evento se necessario (non blocca se fallisce)
      if (eventType) {
        try {
          const eventResponse = await fetch("/api/fundops_loi_events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              loi_id: loiId,
              event_type: eventType,
            }),
          });
          
          if (eventResponse.ok) {
            // Notifica altri componenti che un evento è stato creato
            window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
          }
          } catch (eventError) {
            console.warn("Errore nella creazione dell'evento:", eventError);
            // Non bloccare se l'evento non viene creato
          }
      }
      
      // Callback per aggiornare la UI (optimistic update)
      if (onStatusUpdate) {
        onStatusUpdate(newStatus);
      } else {
        // Refresh della pagina se non c'è callback (con piccolo delay per evitare flicker)
        setTimeout(() => {
          router.refresh();
        }, 100);
      }

      // Toast di successo
      showToast(`Status aggiornato a: ${getStatusLabel(newStatus)}`, "success");
    } catch (error) {
      console.error("Errore nell'aggiornamento dello status:", error);
      showToast(
        error instanceof Error ? error.message : "Errore nell'aggiornamento dello status",
        "error"
      );
    } finally {
      setIsLoading(null);
    }
  };


  // Funzione helper per etichette status
  const getStatusLabel = (status: LoiStatus): string => {
    const labels: Record<LoiStatus, string> = {
      [LoiStatus.DRAFT]: "Bozza",
      [LoiStatus.SENT]: "Inviata",
      [LoiStatus.SIGNED]: "Firmata",
      [LoiStatus.EXPIRED]: "Scaduta",
      [LoiStatus.CANCELLED]: "Annullata",
    };
    return labels[status] || status;
  };

  // Gestione azioni specifiche per stato
  const handleAction = async (action: string) => {
    switch (action) {
      case "send":
        // Usa endpoint dedicato per inviare LOI
        setIsLoading("send");
        try {
          if (!companyId) {
            throw new Error("companyId è richiesto per inviare la LOI");
          }

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

          const result: { eventCreated?: boolean } = await response.json();
          
          if (result.eventCreated) {
            window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
          }
          
          showToast("LOI inviata con successo", "success");
          
          if (onStatusUpdate) {
            onStatusUpdate(LoiStatus.SENT);
          } else {
            setTimeout(() => {
              router.refresh();
            }, 100);
          }
        } catch (error) {
          console.error("Errore nell'invio della LOI:", error);
          showToast(
            error instanceof Error ? error.message : "Errore nell'invio della LOI",
            "error"
          );
        } finally {
          setIsLoading(null);
        }
        break;
      case "mark-signed":
        // Usa endpoint dedicato per segnare come firmata
        setIsLoading("mark-signed");
        try {
          if (!companyId) {
            throw new Error("companyId è richiesto");
          }

          const response = await fetch(`/api/fundops_lois/${loiId}/mark-signed?companyId=${companyId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Errore nel segnare come firmata");
          }

          const result: { eventCreated?: boolean } = await response.json();
          
          if (result.eventCreated) {
            window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
            // Notifica anche il dashboard per aggiornamento
            window.dispatchEvent(new CustomEvent('loi-status-updated', { detail: { loiId, newStatus: LoiStatus.SIGNED } }));
          }

          showToast("LOI segnata come firmata", "success");
          
          if (onStatusUpdate) {
            onStatusUpdate(LoiStatus.SIGNED);
          } else {
            setTimeout(() => {
              router.refresh();
            }, 100);
          }
        } catch (error) {
          console.error("Errore nel segnare come firmata:", error);
          showToast(
            error instanceof Error ? error.message : "Errore nel segnare come firmata",
            "error"
          );
        } finally {
          setIsLoading(null);
        }
        break;
      case "reopen":
        // Aggiorna status e crea evento reopened
        setIsLoading(LoiStatus.SENT);
        try {
          await updateStatus(LoiStatus.SENT);
          // Crea evento reopened dopo update status
          try {
            const eventResponse = await fetch("/api/fundops_loi_events", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                loi_id: loiId,
                event_type: LoiEventType.REOPENED,
              }),
            });
            
            if (eventResponse.ok) {
              // Notifica altri componenti che un evento è stato creato
              window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
            }
          } catch (eventError) {
            console.warn("Errore nella creazione dell'evento reopened:", eventError);
            showToast("Evento non registrato", "error");
          }
        } finally {
          setIsLoading(null);
        }
        break;
      case "edit":
        // Naviga alla pagina di modifica se esiste, altrimenti mostra placeholder
        const editUrl = buildUrl(`/lois/${loiId}/edit`);
        router.push(editUrl);
        break;
      case "reminder":
        // Invia reminder tramite endpoint dedicato
        setIsLoading("reminder");
        try {
          if (!companyId) {
            throw new Error("companyId è richiesto per inviare un reminder");
          }

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

          const result = await response.json();
          
          // Notifica altri componenti che un evento è stato creato
          if (result.eventCreated) {
            window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
          }
          
          // TODO: trigger webhook n8n con payload { loiId, companyId, investorId, email, expiryDate }
          // Esempio payload:
          // {
          //   loiId: loiId,
          //   companyId: companyId,
          //   investorId: result.data?.investor_id,
          //   email: investorEmail, // da recuperare se necessario
          //   expiryDate: result.data?.expiry_date,
          //   reminderCount: result.data?.reminder_count,
          //   lastReminderAt: result.data?.last_reminder_at
          // }
          
          showToast("Reminder registrato con successo");
          
          // Refresh per aggiornare i dati della LOI
          if (onStatusUpdate) {
            // Se c'è un callback, possiamo aggiornare la LOI localmente
            setTimeout(() => {
              router.refresh();
            }, 100);
          } else {
            setTimeout(() => {
              router.refresh();
            }, 100);
          }
        } catch (error) {
          console.error("Errore nell'invio del reminder:", error);
          showToast(
            error instanceof Error ? error.message : "Errore nell'invio del reminder",
            "error"
          );
        } finally {
          setIsLoading(null);
        }
        break;
      case "cancel":
        // Usa endpoint dedicato per annullare LOI
        setIsLoading("cancel");
        try {
          if (!companyId) {
            throw new Error("companyId è richiesto");
          }

          const response = await fetch(`/api/fundops_lois/${loiId}/cancel?companyId=${companyId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Errore nell'annullamento della LOI");
          }

          const result = await response.json();
          
          if (result.eventCreated) {
            window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
            // Notifica anche il dashboard per aggiornamento
            window.dispatchEvent(new CustomEvent('loi-status-updated', { detail: { loiId, newStatus: LoiStatus.CANCELLED } }));
          }

          showToast("LOI annullata", "success");
          
          if (onStatusUpdate) {
            onStatusUpdate(LoiStatus.CANCELLED);
          } else {
            setTimeout(() => {
              router.refresh();
            }, 100);
          }
        } catch (error) {
          console.error("Errore nell'annullamento della LOI:", error);
          showToast(
            error instanceof Error ? error.message : "Errore nell'annullamento della LOI",
            "error"
          );
        } finally {
          setIsLoading(null);
        }
        break;
      case "upload-docs":
        // Naviga alla sezione documenti o mostra placeholder
        showToast("Funzionalità documenti in arrivo", "error");
        break;
      case "duplicate":
        // Duplica la LOI
        setIsLoading("duplicate");
        try {
          const response = await fetch(`/api/fundops_lois/${loiId}/duplicate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ companyId }),
          });

          if (!response.ok) {
            throw new Error("Errore nella duplicazione della LOI");
          }

          const result = await response.json();
          
          // Crea evento duplicated sulla nuova LOI (se creata con successo)
          if (result.data?.id) {
            try {
              const eventResponse = await fetch("/api/fundops_loi_events", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  loi_id: result.data.id,
                  event_type: LoiEventType.DUPLICATED,
                  metadata: { source_loi_id: loiId },
                }),
              });
              
              if (eventResponse.ok) {
                // Notifica altri componenti che un evento è stato creato
                window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId: result.data.id } }));
              }
            } catch (eventError) {
              console.warn("Errore nella creazione dell'evento duplicated:", eventError);
            }
          }
          
          showToast("LOI duplicata con successo");
          
          // Naviga alla nuova LOI o ricarica la lista
          if (result.data?.id) {
            router.push(buildUrl(`/lois/${result.data.id}`));
          } else {
            router.refresh();
          }
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : "Errore nella duplicazione",
            "error"
          );
        } finally {
          setIsLoading(null);
        }
        break;
    }
  };

  // Renderizza i bottoni in base allo status
  // Mostra solo CTA principale per ogni stato, secondo i requisiti
  const renderActions = () => {
    const actions: React.ReactElement[] = [];
    const secondaryActions: React.ReactElement[] = [];

    switch (normalizedStatus) {
      case LoiStatus.DRAFT:
        // CTA principale: Invia LOI
        actions.push(
          <button
            key="send"
            onClick={() => handleAction("send")}
            disabled={isLoading === "send"}
            className={`${styles["action-button"]} ${styles["action-primary"]}`}
          >
            {isLoading === "send" ? "Invio..." : "Invia LOI"}
          </button>
        );
        // CTA secondarie: Modifica, Annulla LOI
        secondaryActions.push(
          <button
            key="edit"
            onClick={() => handleAction("edit")}
            className={`${styles["action-button"]} ${styles["action-secondary"]}`}
          >
            Modifica
          </button>
        );
        secondaryActions.push(
          <button
            key="cancel"
            onClick={() => handleAction("cancel")}
            disabled={isLoading === "cancel"}
            className={`${styles["action-button"]} ${styles["action-danger"]}`}
          >
            {isLoading === "cancel" ? "Annullamento..." : "Annulla LOI"}
          </button>
        );
        break;

      case LoiStatus.SENT:
        // CTA principale: Segna firmata (priorità) o Invia reminder
        actions.push(
          <button
            key="mark-signed"
            onClick={() => handleAction("mark-signed")}
            disabled={isLoading === "mark-signed"}
            className={`${styles["action-button"]} ${styles["action-primary"]}`}
          >
            {isLoading === "mark-signed" ? "Aggiornamento..." : "Segna come firmata"}
          </button>
        );
        actions.push(
          <button
            key="reminder"
            onClick={() => handleAction("reminder")}
            disabled={isLoading === "reminder"}
            className={`${styles["action-button"]} ${styles["action-secondary"]}`}
          >
            {isLoading === "reminder" ? "Invio..." : "Invia reminder"}
          </button>
        );
        // CTA secondaria: Annulla LOI
        secondaryActions.push(
          <button
            key="cancel"
            onClick={() => handleAction("cancel")}
            disabled={isLoading === "cancel"}
            className={`${styles["action-button"]} ${styles["action-danger"]}`}
          >
            {isLoading === "cancel" ? "Annullamento..." : "Annulla LOI"}
          </button>
        );
        break;

      case LoiStatus.SIGNED:
        // Nessuna azione disponibile (solo badge verde)
        break;

      case LoiStatus.EXPIRED:
        // Nessuna azione disponibile (solo badge rosso)
        break;

      case LoiStatus.CANCELLED:
        // Nessuna azione disponibile (solo badge grigio)
        break;
    }

    // Combina azioni principali e secondarie
    return [...actions, ...secondaryActions];
  };

  const actions = renderActions();

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={`${styles["loi-actions"]} ${className}`}>
      {actions}
    </div>
  );
}
