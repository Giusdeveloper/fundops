'use client';

import React, { useRef } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import AppContainer from './AppContainer';
import TutorialModal from './onboarding/TutorialModal';
import { useTutorial } from './onboarding/useTutorial';
import type { UserUiContext } from '@/lib/auth/getUserUiContext';
import { platformTutorialContent, platformTutorialDefinition, platformTutorialSteps, type PlatformTutorialStep } from '@/lib/tutorials/platform';
import type { TutorialStepState } from '@/lib/tutorials/types';
import '../app/(app)/dashboard.css';

interface AppShellProps {
  children: React.ReactNode;
  uiContext: UserUiContext;
}

export default function AppShell({ children, uiContext }: AppShellProps) {
  const pathname = usePathname();
  const sectionRefs = useRef<Record<PlatformTutorialStep, HTMLDivElement | null>>({
    sidebar: null,
    header: null,
    workspace: null,
  });
  const tutorial = useTutorial<PlatformTutorialStep>({
    storageKey: platformTutorialDefinition.storageKey,
    steps: platformTutorialSteps.map((step) => step.id),
    initialStepId: "sidebar",
  });
  
  // Don't show sidebar on login/auth pages or landing
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/auth');
  const isPortalPage = pathname?.startsWith('/portal');
  const isLanding = pathname === '/' || pathname === '';
  
  if (isAuthPage || isPortalPage || isLanding) {
    return <>{children}</>;
  }

  const tutorialStates: Record<PlatformTutorialStep, TutorialStepState> = {
    sidebar: {
      status: "complete",
      statusLabel: "Pronto",
      smartMessage: "Da qui entri nei moduli principali della piattaforma e cambi davvero area di lavoro.",
      ctaLabel: "Guarda la navigazione",
      ctaIntent: "focus",
    },
    header: {
      status: "complete",
      statusLabel: "Pronto",
      smartMessage: "L'header mostra il contesto corrente: pagina, company attiva e accesso al profilo.",
      ctaLabel: "Guarda il contesto attivo",
      ctaIntent: "focus",
    },
    workspace: {
      status: "complete",
      statusLabel: "Pronto",
      smartMessage: "Ogni modulo della piattaforma ha una guida contestuale e un workflow dedicato dentro quest'area centrale.",
      ctaLabel: "Apri l'area di lavoro",
      ctaIntent: "focus",
    },
  };
  const tutorialStep = tutorial.currentStepId;
  const currentTutorial = platformTutorialContent[tutorialStep];
  const currentTutorialState = tutorialStates[tutorialStep];

  const focusSection = (step: PlatformTutorialStep) => {
    const node = sectionRefs.current[step];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  const handleTutorialAction = () => {
    tutorial.close(false);
    setTimeout(() => focusSection(tutorialStep), 120);
  };

  // Use consistent className structure to avoid hydration mismatch
  const layoutClassName = 'dashboard-layout';
  const contentClassName = 'dashboard-main-content';
  
  return (
    <div className={layoutClassName}>
      {tutorial.clientReady ? (
        <TutorialModal
          isOpen={tutorial.isOpen}
          ariaLabel={platformTutorialDefinition.ariaLabel}
          eyebrow={platformTutorialDefinition.eyebrow}
          steps={platformTutorialSteps}
          currentStepId={tutorialStep}
          currentIndex={tutorial.currentIndex}
          content={currentTutorial}
          states={tutorialStates}
          smartState={currentTutorialState}
          onClose={() => tutorial.close(false)}
          onSkip={() => tutorial.close(true)}
          onStepSelect={(step) => {
            tutorial.goToStep(step);
            setTimeout(() => focusSection(step), 60);
          }}
          onPrevious={() => {
            const previous = platformTutorialSteps[tutorial.currentIndex - 1]?.id;
            tutorial.goToPreviousStep();
            if (previous) setTimeout(() => focusSection(previous), 60);
          }}
          onNext={() => {
            const next = platformTutorialSteps[tutorial.currentIndex + 1]?.id;
            tutorial.goToNextStep();
            if (next) setTimeout(() => focusSection(next), 60);
          }}
          onAction={handleTutorialAction}
        />
      ) : null}
      <div
        ref={(node) => {
          sectionRefs.current.sidebar = node;
        }}
        className={tutorial.isOpen && tutorialStep === "sidebar" ? "appshell-tutorial-focus" : undefined}
      >
        <Sidebar uiContext={uiContext} />
      </div>
      <div className={contentClassName}>
        <div
          ref={(node) => {
            sectionRefs.current.header = node;
          }}
          className={tutorial.isOpen && tutorialStep === "header" ? "appshell-tutorial-focus" : undefined}
        >
          <Header uiContext={uiContext} />
        </div>
        <div
          ref={(node) => {
            sectionRefs.current.workspace = node;
          }}
          className={tutorial.isOpen && tutorialStep === "workspace" ? "appshell-tutorial-focus" : undefined}
        >
          <AppContainer>{children}</AppContainer>
        </div>
      </div>
      <button type="button" className="global-tutorial-launcher" onClick={() => tutorial.reopen()}>
        Apri guida piattaforma
      </button>
    </div>
  );
}
