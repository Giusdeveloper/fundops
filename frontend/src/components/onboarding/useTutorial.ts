"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface UseTutorialOptions<StepId extends string> {
  storageKey: string;
  steps: StepId[];
  initialStepId: StepId;
  enabled?: boolean;
  onStepChange?: (step: StepId) => void;
}

export function useTutorial<StepId extends string>({
  storageKey,
  steps,
  initialStepId,
  enabled = true,
  onStepChange,
}: UseTutorialOptions<StepId>) {
  const [clientReady, setClientReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<StepId>(initialStepId);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!clientReady || !enabled || typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(storageKey);
    if (!dismissed) {
      setCurrentStepId(initialStepId);
      setIsOpen(true);
      onStepChange?.(initialStepId);
    }
  }, [clientReady, enabled, initialStepId, onStepChange, storageKey]);

  const currentIndex = useMemo(() => Math.max(steps.indexOf(currentStepId), 0), [currentStepId, steps]);

  const goToStep = useCallback(
    (stepId: StepId) => {
      setCurrentStepId(stepId);
      onStepChange?.(stepId);
    },
    [onStepChange]
  );

  const close = useCallback(
    (persistDismissal: boolean) => {
      setIsOpen(false);
      if (persistDismissal && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, "1");
      }
    },
    [storageKey]
  );

  const reopen = useCallback(
    (stepId?: StepId) => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }
      const nextStep = stepId ?? currentStepId;
      setCurrentStepId(nextStep);
      setIsOpen(true);
      onStepChange?.(nextStep);
    },
    [currentStepId, onStepChange, storageKey]
  );

  const goToPreviousStep = useCallback(() => {
    if (currentIndex <= 0) return;
    const previousStep = steps[currentIndex - 1];
    if (previousStep) goToStep(previousStep);
  }, [currentIndex, goToStep, steps]);

  const goToNextStep = useCallback(() => {
    if (currentIndex >= steps.length - 1) {
      close(true);
      return;
    }
    const nextStep = steps[currentIndex + 1];
    if (nextStep) goToStep(nextStep);
  }, [close, currentIndex, goToStep, steps]);

  return {
    clientReady,
    isOpen,
    currentStepId,
    currentIndex,
    close,
    reopen,
    setOpen: setIsOpen,
    goToStep,
    goToPreviousStep,
    goToNextStep,
  };
}
