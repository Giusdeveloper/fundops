/**
 * Utility per gestire scadenze LOI e classificazione
 */

export type ExpiryClassification = "danger" | "warning" | "soon" | "ok" | "expired";

export interface ExpiryInfo {
  daysToExpiry: number | null;
  classification: ExpiryClassification;
  label: string;
}

/**
 * Calcola i giorni rimanenti fino alla scadenza
 */
export function calculateDaysToExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Classifica la scadenza in base ai giorni rimanenti
 */
export function classifyExpiry(
  daysToExpiry: number | null,
  status?: string
): ExpiryClassification {
  // Se la LOI è già scaduta o expired, ritorna expired
  if (status === "expired" || (daysToExpiry !== null && daysToExpiry < 0)) {
    return "expired";
  }
  
  if (daysToExpiry === null) {
    return "ok";
  }
  
  if (daysToExpiry <= 7) {
    return "danger";
  } else if (daysToExpiry <= 14) {
    return "warning";
  } else if (daysToExpiry <= 30) {
    return "soon";
  } else {
    return "ok";
  }
}

/**
 * Ottiene informazioni complete sulla scadenza
 */
export function getExpiryInfo(
  expiryDate: string | null | undefined,
  status?: string
): ExpiryInfo {
  const daysToExpiry = calculateDaysToExpiry(expiryDate);
  const classification = classifyExpiry(daysToExpiry, status);
  
  let label = "";
  if (daysToExpiry === null) {
    label = "Nessuna scadenza";
  } else if (daysToExpiry < 0) {
    label = "Scaduta";
  } else if (daysToExpiry === 0) {
    label = "Scade oggi";
  } else if (daysToExpiry === 1) {
    label = "Scade domani";
  } else {
    label = `Scade tra ${daysToExpiry} giorni`;
  }
  
  return {
    daysToExpiry,
    classification,
    label,
  };
}

/**
 * Verifica se una LOI è in scadenza (<= 30 giorni e non signed/cancelled)
 */
export function isExpiringSoon(
  expiryDate: string | null | undefined,
  status?: string
): boolean {
  const normalizedStatus = status?.toLowerCase();
  if (normalizedStatus === "signed" || normalizedStatus === "cancelled") {
    return false;
  }
  
  const daysToExpiry = calculateDaysToExpiry(expiryDate);
  return daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0;
}
