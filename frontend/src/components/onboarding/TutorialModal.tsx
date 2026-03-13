"use client";

import type { TutorialStepContent, TutorialStepDefinition, TutorialStepState } from "@/lib/tutorials/types";
import styles from "./tutorial.module.css";

interface TutorialModalProps<StepId extends string> {
  isOpen: boolean;
  ariaLabel: string;
  eyebrow: string;
  density?: "default" | "compact";
  placement?: "corner" | "center";
  steps: TutorialStepDefinition<StepId>[];
  currentStepId: StepId;
  currentIndex: number;
  content: TutorialStepContent;
  states: Record<StepId, TutorialStepState>;
  smartState: TutorialStepState;
  onClose: () => void;
  onSkip: () => void;
  onStepSelect: (step: StepId) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAction: () => void;
}

export default function TutorialModal<StepId extends string>({
  isOpen,
  ariaLabel,
  eyebrow,
  density = "default",
  placement = "center",
  steps,
  currentStepId,
  currentIndex,
  content,
  states,
  smartState,
  onClose,
  onSkip,
  onStepSelect,
  onPrevious,
  onNext,
  onAction,
}: TutorialModalProps<StepId>) {
  const totalChecksLength = content.checks.reduce((sum, item) => sum + item.length, 0);
  const isCompact =
    density === "compact" ||
    content.intro.length + smartState.smartMessage.length + totalChecksLength > 430 ||
    content.checks.length > 3;

  return (
    <div
      className={`${styles.overlay} ${placement === "center" ? styles.overlayCenter : styles.overlayCorner} ${isOpen ? styles.overlayOpen : styles.overlayClosed}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label={ariaLabel}
    >
      <div className={`${styles.modal} ${isCompact ? styles.modalCompact : ""}`}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 className={styles.title}>{content.title}</h2>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.stepBadge}>
              Step {currentIndex + 1} di {steps.length}
            </span>
            <button type="button" className={styles.buttonGhost} onClick={onClose}>
              Chiudi
            </button>
          </div>
        </div>
        <p className={styles.intro}>{content.intro}</p>
        <div className={styles.summaryStrip}>
          <div className={styles.summaryBlock}>
            <p className={styles.label}>Step attivo</p>
            <p className={styles.summaryValue}>
              {steps[currentIndex]?.number}. {steps[currentIndex]?.label}
            </p>
          </div>
          <div className={styles.summaryBlock}>
            <p className={styles.label}>Stato</p>
            <span
              className={`${styles.progressStatus} ${
                smartState.status === "complete"
                  ? styles.statusComplete
                  : smartState.status === "attention"
                    ? styles.statusAttention
                    : styles.statusPending
              }`}
            >
              {smartState.statusLabel}
            </span>
          </div>
        </div>
        <div className={styles.progress}>
          {steps.map((step) => {
            const state = states[step.id];
            const toneClass =
              state.status === "complete"
                ? styles.statusComplete
                : state.status === "attention"
                  ? styles.statusAttention
                  : styles.statusPending;

            return (
              <button
                key={step.id}
                type="button"
                className={`${styles.progressItem} ${currentStepId === step.id ? styles.progressItemActive : ""}`}
                onClick={() => onStepSelect(step.id)}
              >
                <span className={styles.progressLabel}>
                  {step.number}. {step.label}
                </span>
                <span className={`${styles.progressStatus} ${toneClass}`}>{state.statusLabel}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.body}>
          <div>
            <p className={styles.label}>Cosa controllare</p>
            <ul className={styles.list}>
              {content.checks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={styles.tipBox}>
            <p className={styles.label}>Lettura intelligente</p>
            <p className={styles.smartMessage}>{smartState.smartMessage}</p>
            <p className={styles.label}>Suggerimento</p>
            <p className={styles.tip}>{content.tip}</p>
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <button type="button" className={styles.buttonSecondary} onClick={onPrevious} disabled={currentIndex === 0}>
              Step precedente
            </button>
            <button type="button" className={styles.buttonSecondary} onClick={onSkip}>
              Salta tutorial
            </button>
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={`${styles.buttonSecondary} ${styles.buttonAction}`} onClick={onAction} title={smartState.ctaLabel}>
              {smartState.ctaLabel}
            </button>
            <button type="button" className={`${styles.buttonPrimary} ${styles.buttonActionPrimary}`} onClick={onNext}>
              {currentIndex === steps.length - 1 ? "Chiudi onboarding" : "Step successivo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
