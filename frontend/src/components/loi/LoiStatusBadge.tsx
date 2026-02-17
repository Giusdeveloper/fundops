"use client";

import React from "react";
import { LoiStatus, normalizeStatus, getStatusLabel, getStatusColorClass } from "@/lib/loiStatus";
import styles from "./LoiStatusBadge.module.css";

interface LoiStatusBadgeProps {
  status: LoiStatus | string;
  className?: string;
  size?: "small" | "medium" | "large";
  showSoftCommitment?: boolean;
}

/**
 * Componente riusabile per visualizzare il badge dello status di una LOI
 */
export default function LoiStatusBadge({ 
  status, 
  className = "", 
  size = "medium",
  showSoftCommitment = false
}: LoiStatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const label = getStatusLabel(normalizedStatus);
  
  // Gestione stati signers (invited, accepted, signed, expired, revoked)
  const signerStatus = status.toLowerCase();
  const isSignerStatus = ["invited", "accepted", "signed", "expired", "revoked"].includes(signerStatus);
  
  // Determina la classe colore: se è uno stato signer, usa quello, altrimenti usa normalizedStatus
  let colorClass = getStatusColorClass(normalizedStatus);
  if (isSignerStatus) {
    if (signerStatus === "accepted") {
      colorClass = "loi-status-accepted";
    } else if (signerStatus === "invited") {
      colorClass = "loi-status-invited";
    } else if (signerStatus === "revoked") {
      colorClass = "loi-status-revoked";
    } else if (signerStatus === "signed") {
      colorClass = "loi-status-signed";
    } else if (signerStatus === "expired") {
      colorClass = "loi-status-expired";
    }
  }

  // Tooltip personalizzato per signers
  let tooltipText = label;
  if (isSignerStatus && showSoftCommitment) {
    if (signerStatus === "signed") {
      tooltipText = "Firma registrata. Commitment attivo per il round.";
    } else if (signerStatus === "accepted") {
      tooltipText = "Accettazione registrata in piattaforma, firma non ancora completata.";
    } else if (signerStatus === "invited") {
      tooltipText = "Investitore invitato alla LOI del round.";
    } else if (signerStatus === "expired") {
      tooltipText = "La LOI è scaduta e non è più valida nel sistema FundOps.";
    } else if (signerStatus === "revoked") {
      tooltipText = "La LOI è stata revocata.";
    }
  } else if (normalizedStatus === LoiStatus.SIGNED && showSoftCommitment) {
    tooltipText = "Firma registrata. Commitment attivo per il round.";
  } else if (normalizedStatus !== LoiStatus.SIGNED && showSoftCommitment) {
    tooltipText = "Una LOI è considerata valida nel sistema FundOps solo dopo la firma.";
  }

  // Badge label personalizzato per signers
  let displayLabel = label;
  if (isSignerStatus && showSoftCommitment) {
    if (signerStatus === "signed") {
      displayLabel = "Firmata (hard)";
    } else if (signerStatus === "accepted") {
      displayLabel = "Accettata (soft)";
    } else if (signerStatus === "invited") {
      displayLabel = "Invito inviato";
    } else if (signerStatus === "expired") {
      displayLabel = "Scaduta";
    } else if (signerStatus === "revoked") {
      displayLabel = "Revocata";
    }
  } else if (normalizedStatus === LoiStatus.SIGNED && showSoftCommitment) {
    displayLabel = "Firmata (hard)";
  } else if (normalizedStatus !== LoiStatus.SIGNED && normalizedStatus !== LoiStatus.EXPIRED && normalizedStatus !== LoiStatus.CANCELLED && showSoftCommitment) {
    displayLabel = "Non ancora valida";
  }

  return (
    <span 
      className={`${styles["loi-status-badge"]} ${styles[colorClass]} ${styles[`badge-${size}`]} ${className}`}
      title={tooltipText}
    >
      {displayLabel}
    </span>
  );
}
