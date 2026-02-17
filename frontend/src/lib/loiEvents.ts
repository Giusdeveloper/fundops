/**
 * Tipi di eventi LOI supportati
 */
export enum LoiEventType {
  CREATED = 'created',
  SENT = 'sent',
  REMINDER = 'reminder',
  SIGNED = 'signed',
  EXPIRED = 'expired',
  REOPENED = 'reopened',
  CANCELLED = 'cancelled',
  DUPLICATED = 'duplicated',
  NOTE_ADDED = 'note_added',
  STATUS_CHANGED = 'status_changed',
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_GENERATED = 'document_generated',
  DOCUMENT_DELETED = 'document_deleted',
}

/**
 * Interfaccia per un evento LOI
 */
export interface LoiEvent {
  id: string;
  loi_id: string;
  event_type: LoiEventType | string;
  label: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  created_by?: string | null;
}

/**
 * Costruisce un evento LOI con label di default se non fornita
 */
export function buildLoiEvent(
  eventType: LoiEventType | string,
  overrides?: {
    loi_id?: string;
    label?: string;
    metadata?: Record<string, unknown>;
    created_by?: string | null;
  }
): Partial<LoiEvent> {
  return {
    event_type: eventType,
    label: overrides?.label || getEventLabel(eventType),
    metadata: overrides?.metadata,
    created_by: overrides?.created_by || null,
    ...(overrides?.loi_id && { loi_id: overrides.loi_id }),
  };
}

/**
 * Ottiene l'etichetta italiana per un tipo di evento
 */
export function getEventLabel(eventType: LoiEventType | string): string {
  const labels: Record<LoiEventType, string> = {
    [LoiEventType.CREATED]: 'LOI creata',
    [LoiEventType.SENT]: 'LOI inviata',
    [LoiEventType.REMINDER]: 'Reminder inviato',
    [LoiEventType.SIGNED]: 'LOI firmata',
    [LoiEventType.EXPIRED]: 'LOI scaduta',
    [LoiEventType.REOPENED]: 'LOI riaperta',
    [LoiEventType.CANCELLED]: 'LOI annullata',
    [LoiEventType.DUPLICATED]: 'LOI duplicata',
    [LoiEventType.NOTE_ADDED]: 'Nota aggiunta',
    [LoiEventType.STATUS_CHANGED]: 'Stato aggiornato',
    [LoiEventType.DOCUMENT_UPLOADED]: 'Documento caricato',
    [LoiEventType.DOCUMENT_GENERATED]: 'LOI PDF generata',
    [LoiEventType.DOCUMENT_DELETED]: 'Documento rimosso',
  };

  return labels[eventType as LoiEventType] || eventType;
}

/**
 * Formatta un timestamp come tempo relativo (es. "2 ore fa", "3 giorni fa")
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'poco fa';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minuti'} fa`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} ${diffWeeks === 1 ? 'settimana' : 'settimane'} fa`;
    } else if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'mese' : 'mesi'} fa`;
    } else {
      return `${diffYears} ${diffYears === 1 ? 'anno' : 'anni'} fa`;
    }
  } catch {
    return dateString;
  }
}

/**
 * Formatta un timestamp come data assoluta (es. "28 Nov 2025, 14:35")
 */
export function formatAbsoluteTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Ottiene l'icona Lucide per un tipo di evento
 */
export function getEventIcon(eventType: LoiEventType | string): string {
  const icons: Record<LoiEventType, string> = {
    [LoiEventType.CREATED]: 'FileText',
    [LoiEventType.SENT]: 'Mail',
    [LoiEventType.REMINDER]: 'Bell',
    [LoiEventType.SIGNED]: 'CheckCircle',
    [LoiEventType.EXPIRED]: 'Clock',
    [LoiEventType.REOPENED]: 'RefreshCw',
    [LoiEventType.CANCELLED]: 'XCircle',
    [LoiEventType.DUPLICATED]: 'Copy',
    [LoiEventType.NOTE_ADDED]: 'MessageSquare',
    [LoiEventType.STATUS_CHANGED]: 'Edit',
    [LoiEventType.DOCUMENT_UPLOADED]: 'Upload',
    [LoiEventType.DOCUMENT_GENERATED]: 'FileText',
    [LoiEventType.DOCUMENT_DELETED]: 'Trash2',
  };

  return icons[eventType as LoiEventType] || 'Circle';
}
