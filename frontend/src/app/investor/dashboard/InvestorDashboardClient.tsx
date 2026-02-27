"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileDown } from "lucide-react";
import type { InvestorCompanyCard } from "@/lib/investorDashboard";
import AttestationDownloadClient from "./AttestationDownloadClient";
import styles from "./investorDashboard.module.css";

function getPhaseDisplayLabel(phase: string): string {
  if (phase === "issuing") return "issuance";
  return phase || "booking";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getSecondaryCta(card: InvestorCompanyCard): { label: string; documentId: string } | null {
  if (card.loiReceipt) {
    return { label: "Scarica attestazione", documentId: card.loiReceipt.id };
  }
  return null;
}

export default function InvestorDashboardClient({ cards }: { cards: InvestorCompanyCard[] }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(cards[0]?.companyId ?? "");

  const selectedCard = cards.find((c) => c.companyId === selectedCompanyId) ?? cards[0];

  return (
    <>
      <div className={styles.cardsGrid}>
        {cards.map((card) => {
          const secondaryCta = getSecondaryCta(card);
          const isSelected = card.companyId === selectedCompanyId;
          return (
            <div
              key={card.companyId}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCompanyId(card.companyId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedCompanyId(card.companyId);
                }
              }}
              aria-current={isSelected ? "true" : undefined}
              aria-label={`Seleziona ${card.companyName}${isSelected ? ", selezionata" : ""}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.logoPlaceholder} aria-hidden>
                  {getInitials(card.companyName)}
                </div>
                <h2 className={styles.cardTitle}>{card.companyName}</h2>
              </div>
              <div className={styles.badges}>
                <span className={`${styles.badge} ${styles.badgePhase}`}>
                  {getPhaseDisplayLabel(card.phase)}
                </span>
                <span className={`${styles.badge} ${styles.badgeLifecycle}`}>
                  {card.investorStatusLabel}
                </span>
              </div>

              <div className={styles.stepper}>
                <ul className={styles.stepperList}>
                  <li className={`${styles.stepperItem} ${card.loiSigned ? styles.stepperItemCompleted : ""}`}>
                    <span className={`${styles.stepperDot} ${card.loiSigned ? styles.stepperDotCompleted : ""}`} />
                    Booking: LOI firmata
                  </li>
                  <li className={styles.stepperItem}>
                    <span className={styles.stepperDot} />
                    Issuance: Documenti investimento
                  </li>
                  <li className={styles.stepperItem}>
                    <span className={styles.stepperDot} />
                    Onboarding: Completamento
                  </li>
                </ul>
              </div>

              <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                {card.publicSlug ? (
                  <Link href={`/portal/${card.publicSlug}`} className={styles.btnPrimary}>
                    <ExternalLink size={16} />
                    Vai al portale
                  </Link>
                ) : (
                  <span className={`${styles.btnPrimary} ${styles.btnPrimaryDisabled}`} title="Portal non configurato">
                    <ExternalLink size={16} />
                    Vai al portale
                  </span>
                )}
                {card.publicSlug && (card.phase === "issuance" || card.phase === "issuing") && (
                  <Link href={`/investor/issuance/${card.publicSlug}`} className={styles.btnSecondary}>
                    <ExternalLink size={16} />
                    Finalizza investimento
                  </Link>
                )}
                {secondaryCta ? (
                  <AttestationDownloadClient
                    documentId={secondaryCta.documentId}
                    className={styles.btnSecondary}
                  >
                    <FileDown size={16} />
                    {secondaryCta.label}
                  </AttestationDownloadClient>
                ) : card.loiSigned && !card.loiReceipt ? (
                  <div className={styles.attestationPending}>
                    <p className={styles.attestationPendingText}>
                      Attestazione in preparazione. Se non la vedi entro 5 minuti, apri il portale e riscaricala.
                    </p>
                    {card.publicSlug && (
                      <Link href={`/portal/${card.publicSlug}`} className={styles.btnSecondary}>
                        <ExternalLink size={16} />
                        Apri portale
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCard && (
        <section className={styles.nextStepSection}>
          <h2 className={styles.nextStepTitle}>
            Prossimo passo{cards.length > 1 ? ` · ${selectedCard.companyName}` : ""}
          </h2>
          <p className={styles.nextStepText}>
            {(selectedCard.phase === "issuance" || selectedCard.phase === "issuing")
              ? "La fase Issuance e attiva. Completa importo, privacy e documenti per inviare l'investimento."
              : selectedCard.loiSigned
              ? "Hai completato la prenotazione. Ti avviseremo quando si apre la fase Issuance."
              : "Completa la prenotazione firmando la LOI dal portale."}
          </p>
          {selectedCard.publicSlug && (
            <Link
              href={
                selectedCard.phase === "issuance" || selectedCard.phase === "issuing"
                  ? `/investor/issuance/${selectedCard.publicSlug}`
                  : `/portal/${selectedCard.publicSlug}`
              }
              className={styles.nextStepLink}
            >
              <ExternalLink size={16} />
              {selectedCard.phase === "issuance" || selectedCard.phase === "issuing"
                ? "Finalizza investimento"
                : "Apri portale"}
            </Link>
          )}
        </section>
      )}
    </>
  );
}
