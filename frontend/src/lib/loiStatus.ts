/**
 * Enum unico per lo stato delle LOI
 */
export enum LoiStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  SIGNED = 'signed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Valori validi dello status (per validazione)
 */
export const VALID_LOI_STATUSES = Object.values(LoiStatus) as string[];

/**
 * Normalizza lo status di una LOI
 * Se lo status è mancante/undefined o non valido, restituisce 'draft'
 */
export function normalizeStatus(status: string | null | undefined): LoiStatus {
  if (!status) {
    return LoiStatus.DRAFT;
  }

  const normalized = status.toLowerCase().trim();
  
  // Mapping per compatibilità con valori legacy
  const statusMap: Record<string, LoiStatus> = {
    'draft': LoiStatus.DRAFT,
    'sent': LoiStatus.SENT,
    'signed': LoiStatus.SIGNED,
    'expired': LoiStatus.EXPIRED,
    'cancelled': LoiStatus.CANCELLED,
    'canceled': LoiStatus.CANCELLED, // Variante inglese
    'rejected': LoiStatus.CANCELLED, // Mappa rejected a cancelled
  };

  return statusMap[normalized] || LoiStatus.DRAFT;
}

/**
 * Valida se uno status è valido
 */
export function validateStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return VALID_LOI_STATUSES.includes(status.toLowerCase().trim());
}

/**
 * Ottiene l'etichetta italiana per lo status
 */
export function getStatusLabel(status: LoiStatus | string): string {
  const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
  
  const labels: Record<LoiStatus, string> = {
    [LoiStatus.DRAFT]: 'BOZZA',
    [LoiStatus.SENT]: 'INVIATA',
    [LoiStatus.SIGNED]: 'FIRMATA',
    [LoiStatus.EXPIRED]: 'SCADUTA',
    [LoiStatus.CANCELLED]: 'ANNULLATA',
  };

  return labels[normalized] || 'Bozza';
}

/**
 * Ottiene la classe CSS per il colore del badge in base allo status
 */
export function getStatusColorClass(status: LoiStatus | string): string {
  const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
  
  const colorClasses: Record<LoiStatus, string> = {
    [LoiStatus.DRAFT]: 'loi-status-draft',
    [LoiStatus.SENT]: 'loi-status-sent',
    [LoiStatus.SIGNED]: 'loi-status-signed',
    [LoiStatus.EXPIRED]: 'loi-status-expired',
    [LoiStatus.CANCELLED]: 'loi-status-cancelled',
  };

  return colorClasses[normalized] || 'loi-status-draft';
}

/**
 * Ottiene il colore di sfondo per il badge (per stili inline se necessario)
 */
export function getStatusColor(status: LoiStatus | string): {
  bg: string;
  text: string;
  border: string;
} {
  const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
  
  const colors: Record<LoiStatus, { bg: string; text: string; border: string }> = {
    [LoiStatus.DRAFT]: {
      bg: 'rgba(59, 130, 246, 0.15)', // blue-500 con opacità
      text: '#60a5fa', // blue-400
      border: 'rgba(59, 130, 246, 0.3)',
    },
    [LoiStatus.SENT]: {
      bg: 'rgba(147, 51, 234, 0.15)', // violet-600 con opacità
      text: '#a78bfa', // violet-400
      border: 'rgba(147, 51, 234, 0.3)',
    },
    [LoiStatus.SIGNED]: {
      bg: 'rgba(34, 197, 94, 0.15)', // green-500 con opacità
      text: '#4ade80', // green-400
      border: 'rgba(34, 197, 94, 0.3)',
    },
    [LoiStatus.EXPIRED]: {
      bg: 'rgba(239, 68, 68, 0.15)', // red-500 con opacità
      text: '#f87171', // red-400
      border: 'rgba(239, 68, 68, 0.3)',
    },
    [LoiStatus.CANCELLED]: {
      bg: 'rgba(107, 114, 128, 0.15)', // gray-500 con opacità
      text: '#9ca3af', // gray-400
      border: 'rgba(107, 114, 128, 0.3)',
    },
  };

  return colors[normalized] || colors[LoiStatus.DRAFT];
}
