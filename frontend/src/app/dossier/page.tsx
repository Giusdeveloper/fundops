"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TutorialModal from "@/components/onboarding/TutorialModal";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/components/ToastProvider";
import { useTutorial } from "@/components/onboarding/useTutorial";
import { dossierTutorialContent, dossierTutorialDefinition, dossierTutorialSteps, type DossierTutorialStep } from "@/lib/tutorials/dossier";
import type { TutorialStepState } from "@/lib/tutorials/types";
import styles from "./dossier.module.css";

type DriveConnection = {
  provider?: string | null;
  drive_kind: "my_drive" | "shared_drive";
  shared_drive_id: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  drive_subfolders?: Record<string, string> | null;
  root_subfolders?: Record<string, string> | null;
  created_by?: string | null;
  status: "connected" | "error" | "disconnected";
};

type CompanyLite = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
};

type DriveItem = {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType: string;
  sizeBytes: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
};

type DriveListPayload = {
  connected: boolean;
  rootReady: boolean;
  items: DriveItem[];
  driveKind: "my_drive" | "shared_drive" | null;
  sharedDriveId: string | null;
  rootFolderId: string | null;
};

type RoundItem = {
  id: string;
  name: string | null;
  status: string | null;
  issuance_open: boolean | null;
  booking_open: boolean | null;
  created_at: string | null;
  drive_folder_id: string | null;
  drive_subfolders: Record<string, string> | null;
};

type RoundInitRequestBody = {
  companyId: string;
  roundId: string;
  useSharedDrive: boolean;
  driveId?: string;
};

type RoundDocument = {
  id: string;
  type: string;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string | null;
  created_by: string | null;
  file_path: string;
};

type PhaseKey = "booking" | "issuance" | "onboarding";

const ROUND_PHASES: Array<{
  key: PhaseKey;
  title: string;
  description: string;
  folderName: string;
  type: string;
}> = [
  {
    key: "booking",
    title: "01_Booking",
    description: "LOI, booking forms e materiale pre-allocazione.",
    folderName: "01_Booking",
    type: "round_booking_doc",
  },
  {
    key: "issuance",
    title: "02_Issuance",
    description: "Documentazione di emissione e sottoscrizione.",
    folderName: "02_Issuance",
    type: "round_issuance_doc",
  },
  {
    key: "onboarding",
    title: "03_Onboarding",
    description: "KYC, contratti e checklist di onboarding investitore.",
    folderName: "03_Onboarding",
    type: "round_onboarding_doc",
  },
];

const DOSSIER_REQUIREMENTS: Record<
  PhaseKey,
  Array<{ key: "round_booking_doc" | "round_issuance_doc" | "round_onboarding_doc"; label: string }>
> = {
  booking: [{ key: "round_booking_doc", label: "Documenti Booking" }],
  issuance: [{ key: "round_issuance_doc", label: "Documenti Issuance" }],
  onboarding: [{ key: "round_onboarding_doc", label: "Documenti Onboarding" }],
};

function getPhaseStatus(
  docs: RoundDocument[],
  phase: PhaseKey
): { complete: boolean; count: number; lastUploadedAt: string | null } {
  const requirements = DOSSIER_REQUIREMENTS[phase];
  const count = docs.length;
  const lastUploadedAt =
    docs
      .map((doc) => doc.created_at)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const complete = requirements.every((requirement) =>
    docs.some((doc) => doc.type === requirement.key)
  );

  return { complete, count, lastUploadedAt };
}

function formatBytes(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function DossierPageClient() {
  const { activeCompanyId } = useCompany();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const tutorialSectionRefs = useRef<Record<DossierTutorialStep, HTMLElement | null>>({
    connection: null,
    vault: null,
    round: null,
  });

  const companyId = useMemo(
    () => searchParams.get("companyId") || activeCompanyId || "",
    [activeCompanyId, searchParams]
  );

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);

  const [useSharedDrive, setUseSharedDrive] = useState(false);
  const [driveId, setDriveId] = useState("");
  const [shareStatus, setShareStatus] = useState<{ ok: boolean; message?: string } | null>(null);

  const [items, setItems] = useState<DriveItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileAttachments, setProfileAttachments] = useState<Array<{
    id: string;
    type: "deck" | "registry";
    url: string;
    uploaded_at: string;
    uploaded_by?: string | null;
    metadata?: Record<string, unknown>;
  }>>([]);
  const [loadingProfileAttachments, setLoadingProfileAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [roundInitLoading, setRoundInitLoading] = useState(false);
  const [documents, setDocuments] = useState<RoundDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingPhase, setUploadingPhase] = useState<PhaseKey | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<Record<PhaseKey, File | null>>({
    booking: null,
    issuance: null,
    onboarding: null,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const roundFileRefs = useRef<Record<PhaseKey, HTMLInputElement | null>>({
    booking: null,
    issuance: null,
    onboarding: null,
  });

  const connected = Boolean(connection);
  const hasRootFolder = Boolean(connection?.root_folder_id);
  const driveKindLabel = connection?.drive_kind === "shared_drive" ? "Shared Drive" : "My Drive";
  const expectedSubfolders = useMemo(
    () => ["01_Booking", "02_Issuance", "03_Onboarding"],
    []
  );
  const subfoldersMap = useMemo(() => {
    const raw = connection?.drive_subfolders ?? connection?.root_subfolders ?? null;
    if (!raw || typeof raw !== "object") return {};
    const map: Record<string, string> = {};
    for (const name of expectedSubfolders) {
      const value = raw[name];
      if (typeof value === "string" && value.trim()) {
        map[name] = value;
      }
    }
    return map;
  }, [connection?.drive_subfolders, connection?.root_subfolders, expectedSubfolders]);
  const selectedRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId]
  );
  const roundSubfolders = useMemo(() => {
    const raw = selectedRound?.drive_subfolders;
    if (!raw || typeof raw !== "object") return {};
    return raw;
  }, [selectedRound?.drive_subfolders]);
  const documentsByPhase = useMemo(() => {
    const grouped: Record<PhaseKey, RoundDocument[]> = {
      booking: [],
      issuance: [],
      onboarding: [],
    };
    for (const doc of documents) {
      if (doc.type === "round_booking_doc") grouped.booking.push(doc);
      if (doc.type === "round_issuance_doc") grouped.issuance.push(doc);
      if (doc.type === "round_onboarding_doc") grouped.onboarding.push(doc);
    }
    return grouped;
  }, [documents]);
  const phaseStatuses = useMemo(
    () => ({
      booking: getPhaseStatus(documentsByPhase.booking, "booking"),
      issuance: getPhaseStatus(documentsByPhase.issuance, "issuance"),
      onboarding: getPhaseStatus(documentsByPhase.onboarding, "onboarding"),
    }),
    [documentsByPhase]
  );
  const completedPhases = useMemo(
    () => Object.values(phaseStatuses).filter((phase) => phase.complete).length,
    [phaseStatuses]
  );
  const progressPercent = (completedPhases / ROUND_PHASES.length) * 100;
  const dossierSummaryLabel =
    completedPhases === 0
      ? "Dossier non avviato"
      : completedPhases === ROUND_PHASES.length
        ? "Dossier completo"
        : "Dossier in costruzione";
  const tutorialStates = useMemo<Record<DossierTutorialStep, TutorialStepState>>(
    () => ({
      connection: connected
        ? {
            status: hasRootFolder ? "complete" : "attention",
            statusLabel: hasRootFolder ? "Pronta" : "Da inizializzare",
            smartMessage: hasRootFolder
              ? "Google Drive e root FundOps sono attivi. La base documentale è pronta."
              : "La connessione esiste, ma la root FundOps non è ancora inizializzata.",
            ctaLabel: "Controlla la connessione",
            ctaIntent: "focus",
          }
        : {
            status: "pending",
            statusLabel: "Da iniziare",
            smartMessage: "Il dossier parte dalla connessione Google Drive. Senza quella, il resto del workflow documentale non esiste.",
            ctaLabel: "Connetti Drive",
            ctaIntent: "focus",
          },
      vault: hasRootFolder
        ? {
            status: "complete",
            statusLabel: "Pronto",
            smartMessage: `La root FundOps contiene ${items.length} elementi. Qui lavori sui documenti generali della startup.`,
            ctaLabel: "Apri il vault",
            ctaIntent: "focus",
          }
        : {
            status: connected ? "attention" : "pending",
            statusLabel: connected ? "In attesa root" : "In attesa",
            smartMessage: connected
              ? "La connessione c'è, ma senza root FundOps non puoi ancora leggere o caricare documenti generali."
              : "Il vault si attiverà solo dopo la connessione Drive.",
            ctaLabel: "Vai al vault",
            ctaIntent: "focus",
          },
      round: selectedRound
        ? {
            status: selectedRound.drive_folder_id ? "complete" : "attention",
            statusLabel: selectedRound.drive_folder_id ? "Pronto" : "Da inizializzare",
            smartMessage: selectedRound.drive_folder_id
              ? `Il dossier round è ${dossierSummaryLabel.toLowerCase()} con ${completedPhases}/${ROUND_PHASES.length} fasi completate.`
              : "Hai selezionato un round, ma la sua cartella documentale non è ancora pronta.",
            ctaLabel: "Apri il dossier round",
            ctaIntent: "focus",
          }
        : {
            status: rounds.length > 0 ? "attention" : "pending",
            statusLabel: rounds.length > 0 ? "Da selezionare" : "In attesa",
            smartMessage: rounds.length > 0
              ? "Scegli un round per leggere checklist, cartelle e documenti per fase."
              : "Il blocco round sarà utile quando esisterà almeno un round per la company attiva.",
            ctaLabel: "Vai al dossier round",
            ctaIntent: "focus",
          },
    }),
    [completedPhases, connected, dossierSummaryLabel, hasRootFolder, items.length, rounds.length, selectedRound]
  );
  const tutorial = useTutorial<DossierTutorialStep>({
    storageKey: dossierTutorialDefinition.storageKey,
    steps: dossierTutorialSteps.map((step) => step.id),
    initialStepId: "connection",
  });
  const tutorialStep = tutorial.currentStepId;
  const currentTutorial = dossierTutorialContent[tutorialStep];
  const currentTutorialState = tutorialStates[tutorialStep];

  const loadCompanyName = useCallback(async () => {
    if (!companyId) {
      setCompanyName(null);
      return;
    }

    try {
      const res = await fetch("/api/my_companies", { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const rows = (Array.isArray(payload?.data) ? payload.data : []) as CompanyLite[];
      const found = rows.find((row) => row.id === companyId);
      setCompanyName(found?.name || found?.legal_name || null);
    } catch {
      setCompanyName(null);
    }
  }, [companyId]);

  const loadConnection = useCallback(async () => {
    if (!companyId) return;
    setLoadingConnection(true);
    try {
      const res = await fetch(`/api/drive/connection?companyId=${encodeURIComponent(companyId)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Errore caricamento connessione");

      const nextConnection = (payload?.connection ?? null) as DriveConnection | null;
      setConnection(nextConnection);

      if (nextConnection?.drive_kind === "shared_drive") {
        setUseSharedDrive(true);
      }
      if (nextConnection?.shared_drive_id) {
        setDriveId(nextConnection.shared_drive_id);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore connessione Drive", "error");
    } finally {
      setLoadingConnection(false);
    }
  }, [companyId, showToast]);

  const loadItems = useCallback(async () => {
    if (!companyId || !hasRootFolder) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await fetch(`/api/drive/google/list?companyId=${encodeURIComponent(companyId)}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as Partial<DriveListPayload> & {
        error?: string;
      };
      if (!res.ok) throw new Error(payload?.error || "Errore caricamento documenti");

      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems as DriveItem[]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore caricamento documenti", "error");
    } finally {
      setLoadingItems(false);
    }
  }, [companyId, hasRootFolder, showToast]);

  const loadRounds = useCallback(async () => {
    if (!companyId) {
      setRounds([]);
      setSelectedRoundId("");
      return;
    }

    setLoadingRounds(true);
    try {
      const res = await fetch(`/api/drive/google/rounds?companyId=${encodeURIComponent(companyId)}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        rounds?: RoundItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload?.error || "Errore caricamento rounds");

      const nextRounds = Array.isArray(payload?.rounds) ? payload.rounds : [];
      setRounds(nextRounds);
      setSelectedRoundId((prev) => {
        if (prev && nextRounds.some((row) => row.id === prev)) return prev;
        return nextRounds[0]?.id ?? "";
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore caricamento rounds", "error");
    } finally {
      setLoadingRounds(false);
    }
  }, [companyId, showToast]);

  const loadRoundDocuments = useCallback(async () => {
    if (!companyId || !selectedRoundId) {
      setDocuments([]);
      return;
    }

    setLoadingDocuments(true);
    try {
      const res = await fetch(
        `/api/rounds/${encodeURIComponent(selectedRoundId)}/documents?companyId=${encodeURIComponent(
          companyId
        )}`,
        { cache: "no-store" }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        documents?: RoundDocument[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload?.error || "Errore caricamento documenti round");
      setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Errore caricamento documenti round",
        "error"
      );
    } finally {
      setLoadingDocuments(false);
    }
  }, [companyId, selectedRoundId, showToast]);

  const loadProfileAttachments = useCallback(async () => {
    if (!companyId) {
      setProfileAttachments([]);
      setAttachmentsError(null);
      return;
    }
    setLoadingProfileAttachments(true);
    try {
      const res = await fetch(`/api/company-profiles/attachments?companyId=${encodeURIComponent(companyId)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Errore caricamento allegati");
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setProfileAttachments(rows);
      setAttachmentsError(null);
    } catch (error) {
      setProfileAttachments([]);
      setAttachmentsError(error instanceof Error ? error.message : "Errore caricamento allegati");
    } finally {
      setLoadingProfileAttachments(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadCompanyName();
    void loadConnection();
  }, [loadCompanyName, loadConnection]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    void loadProfileAttachments();
  }, [loadProfileAttachments]);

  useEffect(() => {
    void loadRoundDocuments();
  }, [loadRoundDocuments]);

  useEffect(() => {
    setPhaseFiles({
      booking: null,
      issuance: null,
      onboarding: null,
    });
  }, [selectedRoundId]);

  const connectGoogleDrive = () => {
    if (!companyId) {
      showToast("Seleziona una company", "warning");
      return;
    }
    const redirect = `/dossier?companyId=${companyId}`;
    window.location.href = `/api/drive/google/start?companyId=${encodeURIComponent(
      companyId
    )}&redirect=${encodeURIComponent(redirect)}`;
  };

  const initDrive = async () => {
    if (!companyId) return;
    try {
      setLoadingConnection(true);
      const res = await fetch("/api/drive/google/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          useSharedDrive,
          driveId: useSharedDrive ? driveId.trim() : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Errore creazione cartella");

      setShareStatus(payload?.shareAdmin ?? null);
      showToast("Cartella FundOps collegata", "success");
      if (payload?.createdSubfolders === true) {
        showToast("Struttura iniziale creata: Booking / Issuance / Onboarding", "success");
      }
      await loadConnection();
      await loadItems();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore init", "error");
    } finally {
      setLoadingConnection(false);
    }
  };

  const onPickFile = (file: File | null) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !companyId || !hasRootFolder) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("companyId", companyId);
      formData.append("fileName", selectedFile.name);
      formData.append("file", selectedFile);

      const res = await fetch("/api/drive/google/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Errore upload file");

      setSelectedFile(null);
      showToast("File caricato su Drive", "success");
      await loadItems();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore upload file", "error");
    } finally {
      setUploading(false);
    }
  };

  const onPhaseFilePick = (phase: PhaseKey, file: File | null) => {
    setPhaseFiles((prev) => ({ ...prev, [phase]: file }));
  };

  const uploadRoundPhase = async (phase: PhaseKey) => {
    if (!companyId || !selectedRoundId) return;
    const file = phaseFiles[phase];
    if (!file) return;
    if (!selectedRound?.drive_folder_id) {
      showToast("Inizializza prima la cartella round", "warning");
      return;
    }

    try {
      setUploadingPhase(phase);
      const formData = new FormData();
      formData.append("companyId", companyId);
      formData.append("roundId", selectedRoundId);
      formData.append("phase", phase);
      formData.append("title", file.name);
      formData.append("file", file);

      const res = await fetch("/api/drive/google/round/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload?.error || "Errore upload documento round");

      setPhaseFiles((prev) => ({ ...prev, [phase]: null }));
      const input = roundFileRefs.current[phase];
      if (input) input.value = "";
      showToast("Documento caricato con successo", "success");
      await loadRoundDocuments();
      await loadItems();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore upload documento round", "error");
    } finally {
      setUploadingPhase(null);
    }
  };

  const openDocument = async (documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/download`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || "Errore apertura documento");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore apertura documento", "error");
    }
  };

  const initRoundFolder = async () => {
    if (!companyId || !selectedRoundId) return;

    try {
      setRoundInitLoading(true);
      const res = await fetch("/api/drive/google/round/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify((() => {
          const payload: RoundInitRequestBody = {
            companyId,
            roundId: selectedRoundId,
            useSharedDrive: connection?.drive_kind === "shared_drive",
          };
          if (payload.useSharedDrive && connection?.shared_drive_id) {
            payload.driveId = connection.shared_drive_id;
          }
          return payload;
        })()),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: { roundFolder?: boolean; subfolders?: boolean };
      };
      if (!res.ok) throw new Error(payload?.error || "Errore init cartella round");

      if (payload?.created?.roundFolder || payload?.created?.subfolders) {
        showToast("Cartella round inizializzata", "success");
      } else {
        showToast("Cartella round gia pronta", "success");
      }
      await loadRounds();
      await loadRoundDocuments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Errore init cartella round", "error");
    } finally {
      setRoundInitLoading(false);
    }
  };

  const rootDriveUrl = connection?.root_folder_id
    ? `https://drive.google.com/drive/folders/${connection.root_folder_id}`
    : null;

  function focusSection(step: DossierTutorialStep) {
    const node = tutorialSectionRefs.current[step];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleTutorialAction() {
    tutorial.close(true);
    setTimeout(() => focusSection(tutorialStep), 120);
  }

  return (
    <section className={styles.page}>
      {tutorial.clientReady ? (
        <TutorialModal
          isOpen={tutorial.isOpen}
          ariaLabel={dossierTutorialDefinition.ariaLabel}
          eyebrow={dossierTutorialDefinition.eyebrow}
          steps={dossierTutorialSteps}
          currentStepId={tutorialStep}
          currentIndex={tutorial.currentIndex}
          content={currentTutorial}
          states={tutorialStates}
          smartState={currentTutorialState}
          onClose={() => tutorial.close(true)}
          onSkip={() => tutorial.close(true)}
          onStepSelect={(step) => {
            tutorial.goToStep(step);
            setTimeout(() => focusSection(step), 60);
          }}
          onPrevious={() => {
            const previous = dossierTutorialSteps[tutorial.currentIndex - 1]?.id;
            tutorial.goToPreviousStep();
            if (previous) setTimeout(() => focusSection(previous), 60);
          }}
          onNext={() => {
            const next = dossierTutorialSteps[tutorial.currentIndex + 1]?.id;
            tutorial.goToNextStep();
            if (next) setTimeout(() => focusSection(next), 60);
          }}
          onAction={handleTutorialAction}
        />
      ) : null}
      <header
        ref={(node) => {
          tutorialSectionRefs.current.connection = node;
        }}
        className={`${styles.hero} ${tutorial.isOpen && tutorialStep === "connection" ? styles.tutorialSectionActive : ""}`}
      >
        <div>
          <h1 className={styles.title}>Dossier FundOps</h1>
          <p className={styles.subtitle}>
            Il tuo archivio documentale strutturato per Booking, Issuance e Onboarding.
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => tutorial.reopen()}>
              Apri tutorial dossier
            </button>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <p className={styles.companyLine}>Company: <strong>{companyName || companyId || "n/d"}</strong></p>
          <span className={connected ? styles.badgeConnected : styles.badgeDisconnected}>
            {connected ? "Connesso" : "Non connesso"}
          </span>
        </div>
      </header>

      <div className={styles.layoutGrid}>
        <div className={styles.mainCol}>
          <article
            ref={(node) => {
              tutorialSectionRefs.current.vault = node;
            }}
            className={`${styles.card} ${tutorial.isOpen && tutorialStep === "vault" ? styles.tutorialSectionActive : ""}`}
          >
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Documenti</h2>
              {hasRootFolder && <span className={styles.pill}>{items.length} elementi</span>}
            </div>

            {!connected && (
              <div className={styles.stateBlock}>
                <p className={styles.muted}>Nessuna connessione Google Drive attiva.</p>
                <button
                  className={styles.primaryBtn}
                  onClick={connectGoogleDrive}
                  disabled={!companyId || loadingConnection}
                  aria-label="Connetti Google Drive"
                >
                  Connetti Google Drive
                </button>
              </div>
            )}

            {connected && !hasRootFolder && (
              <div className={styles.stateBlock}>
                <p className={styles.muted}>Connessione attiva, ma cartella root FundOps non ancora inizializzata.</p>
                <label className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={useSharedDrive}
                    onChange={(e) => setUseSharedDrive(e.target.checked)}
                  />
                  <span>Usa Shared Drive</span>
                </label>
                {useSharedDrive && (
                  <label className={styles.label}>
                    Drive ID
                    <input
                      className={styles.input}
                      type="text"
                      value={driveId}
                      onChange={(e) => setDriveId(e.target.value)}
                      placeholder="es. 0AExampleSharedDriveIdUk9PVA"
                    />
                  </label>
                )}
                <button
                  className={styles.primaryBtn}
                  onClick={initDrive}
                  disabled={loadingConnection || (useSharedDrive && !driveId.trim())}
                  aria-label="Crea cartella FundOps"
                >
                  Crea cartella FundOps
                </button>
              </div>
            )}

            {connected && hasRootFolder && (
              <>
                {loadingItems ? (
                  <p className={styles.muted}>Caricamento contenuti...</p>
                ) : items.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>Nessun documento ancora</p>
                    <p className={styles.muted}>Carica il primo file per iniziare a popolare il vault.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Nome</th>
                          <th>Ultima modifica</th>
                          <th>Size</th>
                          <th>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <span className={item.kind === "folder" ? styles.kindFolder : styles.kindFile}>
                                {item.kind === "folder" ? "Folder" : "File"}
                              </span>
                            </td>
                            <td className={styles.nameCell}>{item.name}</td>
                            <td>{formatDate(item.modifiedTime)}</td>
                            <td>{item.kind === "file" ? formatBytes(item.sizeBytes) : "-"}</td>
                            <td>
                              {item.webViewLink ? (
                                <a href={item.webViewLink} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                                  Apri
                                </a>
                              ) : (
                                <span className={styles.muted}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </article>
        </div>

        <aside className={styles.sideCol}>
          <article
            ref={(node) => {
              tutorialSectionRefs.current.round = node;
            }}
            className={`${styles.card} ${tutorial.isOpen && tutorialStep === "round" ? styles.tutorialSectionActive : ""}`}
          >
            <h2 className={styles.cardTitle}>Connessione</h2>
            <p className={styles.muted}>Provider: Google Drive</p>
            <p className={styles.muted}>Stato: {connected ? "attiva" : "non attiva"}</p>
            {connected && (
              <>
                <p className={styles.muted}>Drive: {driveKindLabel}</p>
                {connection?.shared_drive_id && (
                  <p className={styles.muted}>Shared Drive ID: <span className={styles.mono}>{connection.shared_drive_id}</span></p>
                )}
                {connection?.created_by && (
                  <p className={styles.muted}>Connessione attivata da: <span className={styles.mono}>{connection.created_by}</span></p>
                )}
                <p className={styles.muted}>
                  Root folder: <span className={styles.mono}>{connection?.root_folder_name || "FundOps"}</span>
                </p>
                {rootDriveUrl && (
                  <a href={rootDriveUrl} target="_blank" rel="noreferrer" className={styles.secondaryBtn}>
                    Apri cartella FundOps in Drive
                  </a>
                )}

                <div className={styles.subfoldersBlock}>
                  <p className={styles.subfoldersTitle}>Struttura FundOps</p>
                  {expectedSubfolders.map((folderName) => {
                    const folderId = subfoldersMap[folderName];
                    const folderUrl = folderId
                      ? `https://drive.google.com/drive/folders/${folderId}`
                      : null;
                    return (
                      <div key={folderName} className={styles.subfolderRow}>
                        <span className={styles.subfolderName}>{folderName}</span>
                        {folderUrl ? (
                          <a
                            href={folderUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.linkBtn}
                          >
                            Apri in Drive
                          </a>
                        ) : (
                          <span className={styles.subfolderMissing}>non disponibile</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!connected && (
              <button
                className={styles.primaryBtn}
                onClick={connectGoogleDrive}
                disabled={!companyId || loadingConnection}
                aria-label="Connetti Google Drive"
              >
                Connetti Google Drive
              </button>
            )}

            {shareStatus && !shareStatus.ok && (
              <p className={styles.warnText}>
                Condivisione admin@imment.it non riuscita. {shareStatus.message ?? ""}
              </p>
            )}
          </article>

          <article className={styles.profileAttachmentsCard}>
            <div className={styles.profileAttachmentsHead}>
              <h2 className={styles.cardTitle}>Documenti startup</h2>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={loadProfileAttachments}
                disabled={!companyId || loadingProfileAttachments}
              >
                {loadingProfileAttachments ? "Aggiornamento..." : "Aggiorna"}
              </button>
            </div>
            {loadingProfileAttachments ? (
              <p className={styles.muted}>Caricamento allegati...</p>
            ) : attachmentsError ? (
              <p className={styles.warnText}>{attachmentsError}</p>
            ) : (
              <div className={styles.profileAttachmentsList}>
                {["deck", "registry"].map((type) => {
                  const attachment = profileAttachments.find((row) => row.type === type);
                  return (
                    <div key={type} className={styles.profileAttachmentItem}>
                      <p className={styles.profileAttachmentLabel}>
                        {type === "deck" ? "Investor Deck" : "Visura"}
                      </p>
                      {attachment ? (
                        <>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.linkBtn}
                          >
                            Apri file
                          </a>
                          <p className={styles.profileAttachmentMeta}>
                            Caricato {new Date(attachment.uploaded_at).toLocaleDateString("it-IT")}
                            {attachment.uploaded_by ? ` da ${attachment.uploaded_by}` : ""}
                          </p>
                        </>
                      ) : (
                        <p className={styles.profileAttachmentPlaceholder}>
                          Ancora non disponibile. Carica il file nella profilazione.
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className={styles.profileAttachmentsFooter}>
                  <p className={styles.profileAttachmentNote}>
                    Ultimo aggiornamento:{" "}
                    {profileAttachments.length > 0
                      ? new Date(profileAttachments[0].uploaded_at).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "ancora nessun file"}
                  </p>
                  <Link
                    href="/companies"
                    className={styles.linkBtn}
                    onClick={() => {
                      if (companyId) {
                        window.localStorage.setItem("lastCompanyFocus", companyId);
                      }
                    }}
                  >
                    Vai alla profilazione
                  </Link>
                </div>
              </div>
            )}
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Carica file</h2>
            {hasRootFolder ? (
              <>
                <div
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0] ?? null;
                    onPickFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Seleziona file da caricare"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <p className={styles.dropTitle}>Drag & drop o click per selezionare</p>
                  <p className={styles.muted}>Upload diretto nella root FundOps.</p>
                </div>
                <input
                  ref={fileInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />

                {selectedFile && (
                  <p className={styles.muted}>Selezionato: <strong>{selectedFile.name}</strong></p>
                )}

                <button
                  className={styles.primaryBtn}
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  aria-label="Carica file su Google Drive"
                >
                  {uploading ? "Caricamento..." : "Carica file"}
                </button>
              </>
            ) : (
              <p className={styles.muted}>Prima inizializza la cartella FundOps per abilitare l&apos;upload.</p>
            )}
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Cartella Round</h2>

            {!hasRootFolder ? (
              <p className={styles.muted}>
                Inizializza prima la root FundOps per abilitare le cartelle round.
              </p>
            ) : loadingRounds ? (
              <p className={styles.muted}>Caricamento rounds...</p>
            ) : rounds.length === 0 ? (
              <p className={styles.muted}>Nessun round disponibile.</p>
            ) : (
              <>
                <label className={styles.label}>
                  Round
                  <select
                    className={styles.input}
                    value={selectedRoundId}
                    onChange={(e) => setSelectedRoundId(e.target.value)}
                  >
                    {rounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.name || `Round ${round.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedRound && !selectedRound.drive_folder_id && (
                  <button
                    className={styles.primaryBtn}
                    onClick={initRoundFolder}
                    disabled={roundInitLoading}
                    aria-label="Inizializza cartella round"
                  >
                    {roundInitLoading ? "Inizializzazione..." : "Inizializza cartella Round"}
                  </button>
                )}

                {selectedRound?.drive_folder_id && (
                  <>
                    <p className={styles.muted}>
                      Folder ID: <span className={styles.mono}>{selectedRound.drive_folder_id}</span>
                    </p>
                    <a
                      href={`https://drive.google.com/drive/folders/${selectedRound.drive_folder_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.secondaryBtn}
                    >
                      Apri cartella Round
                    </a>

                    <div className={styles.subfoldersBlock}>
                      <p className={styles.subfoldersTitle}>Sottocartelle round</p>
                      {["01_Booking", "02_Issuance", "03_Onboarding", "99_Archive"].map((folderName) => {
                        const folderId = roundSubfolders[folderName];
                        const folderUrl = folderId
                          ? `https://drive.google.com/drive/folders/${folderId}`
                          : null;
                        return (
                          <div key={folderName} className={styles.subfolderRow}>
                            <span className={styles.subfolderName}>{folderName}</span>
                            {folderUrl ? (
                              <a href={folderUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                                Apri in Drive
                              </a>
                            ) : (
                              <span className={styles.subfolderMissing}>non disponibile</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.roundDocsSection}>
                      <div className={styles.roundDocsHead}>
                        <p className={styles.subfoldersTitle}>Documenti Round</p>
                        {loadingDocuments && <span className={styles.muted}>Aggiornamento...</span>}
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryHead}>
                          <div>
                            <p className={styles.summaryTitle}>Stato dossier round</p>
                            <p className={styles.summaryCopy}>{dossierSummaryLabel}</p>
                          </div>
                          <span
                            className={
                              completedPhases === ROUND_PHASES.length
                                ? styles.statusComplete
                                : completedPhases > 0
                                  ? styles.statusInProgress
                                  : styles.statusEmpty
                            }
                          >
                            {completedPhases}/{ROUND_PHASES.length}
                          </span>
                        </div>
                        <div className={styles.progressTrack} aria-hidden="true">
                          <div
                            className={styles.progressFill}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className={styles.phaseGrid}>
                        {ROUND_PHASES.map((phase) => {
                          const phaseDocs = documentsByPhase[phase.key];
                          const phaseFile = phaseFiles[phase.key];
                          const isUploading = uploadingPhase === phase.key;
                          const folderId = roundSubfolders[phase.folderName];
                          const folderUrl = folderId
                            ? `https://drive.google.com/drive/folders/${folderId}`
                            : null;
                          const phaseStatus = phaseStatuses[phase.key];
                          const phaseBadgeClass = phaseStatus.complete
                            ? styles.statusComplete
                            : phaseStatus.count > 0
                              ? styles.statusInProgress
                              : styles.statusEmpty;
                          const phaseBadgeLabel = phaseStatus.complete
                            ? "Completo"
                            : phaseStatus.count > 0
                              ? "In corso"
                              : "Vuoto";

                          return (
                            <div key={phase.key} className={styles.phaseCard}>
                              <div className={styles.phaseCardHead}>
                                <div className={styles.phaseTitleWrap}>
                                  <p className={styles.phaseTitle}>{phase.title}</p>
                                  <span className={phaseBadgeClass}>{phaseBadgeLabel}</span>
                                </div>
                                {folderUrl ? (
                                  <a
                                    href={folderUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.linkBtn}
                                  >
                                    Apri cartella
                                  </a>
                                ) : (
                                  <span className={styles.subfolderMissing}>cartella non trovata</span>
                                )}
                              </div>
                              <p className={styles.phaseHint}>{phase.description}</p>
                              <div className={styles.phaseMeta}>
                                <span>{phaseStatus.count} documenti</span>
                                <span>
                                  Ultima modifica:{" "}
                                  {phaseStatus.lastUploadedAt
                                    ? formatDate(phaseStatus.lastUploadedAt)
                                    : "-"}
                                </span>
                              </div>
                              <div className={styles.checklist}>
                                {DOSSIER_REQUIREMENTS[phase.key].map((requirement) => {
                                  const present = phaseDocs.some((doc) => doc.type === requirement.key);
                                  return (
                                    <div key={requirement.key} className={styles.checklistRow}>
                                      <span
                                        className={
                                          present ? styles.checklistDotDone : styles.checklistDotTodo
                                        }
                                        aria-hidden="true"
                                      />
                                      <span className={styles.checklistLabel}>{requirement.label}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              <div
                                className={styles.phaseDropzone}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  onPhaseFilePick(phase.key, e.dataTransfer.files?.[0] ?? null);
                                }}
                              >
                                <p className={styles.phaseDropTitle}>Drag & drop</p>
                                <button
                                  type="button"
                                  className={styles.secondaryBtn}
                                  onClick={() => roundFileRefs.current[phase.key]?.click()}
                                  aria-label={`Seleziona file per fase ${phase.title}`}
                                >
                                  Seleziona file
                                </button>
                                <input
                                  ref={(node) => {
                                    roundFileRefs.current[phase.key] = node;
                                  }}
                                  className={styles.hiddenInput}
                                  type="file"
                                  onChange={(e) => onPhaseFilePick(phase.key, e.target.files?.[0] ?? null)}
                                />
                              </div>

                              {phaseFile && (
                                <p className={styles.muted}>
                                  File: <strong>{phaseFile.name}</strong>
                                </p>
                              )}

                              <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={() => uploadRoundPhase(phase.key)}
                                disabled={!phaseFile || isUploading || !selectedRound?.drive_folder_id}
                                aria-label={`Carica documento nella fase ${phase.title}`}
                              >
                                {isUploading ? "Caricamento..." : "Carica"}
                              </button>

                              <div className={styles.phaseDocsList}>
                                {phaseDocs.length === 0 ? (
                                  <p className={styles.subfolderMissing}>Nessun documento in questa fase.</p>
                                ) : (
                                  phaseDocs.map((doc) => (
                                    <div key={doc.id} className={styles.phaseDocRow}>
                                      <div className={styles.phaseDocMeta}>
                                        <p className={styles.phaseDocTitle}>{doc.title}</p>
                                        <p className={styles.phaseDocInfo}>
                                          {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className={styles.linkBtn}
                                        onClick={() => void openDocument(doc.id)}
                                        aria-label={`Apri documento ${doc.title}`}
                                      >
                                        Apri
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Naming convention</h2>
            <p className={styles.muted}>
              Usa sempre prefissi 01/02/03 e nomi chiari
              (es. 01_Booking/LOI, 02_Issuance/Modulo, 03_Onboarding/Contratti).
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default function DossierPage() {
  return (
    <Suspense fallback={<section className={styles.page} aria-busy="true" />}>
      <DossierPageClient />
    </Suspense>
  );
}
