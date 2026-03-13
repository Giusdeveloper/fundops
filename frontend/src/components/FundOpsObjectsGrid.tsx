"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import styles from "./FundOpsObjectsGrid.module.css";

interface ProcessStatus {
  booking: {
    status: "not_started" | "in_progress" | "completed";
    investors_count: number;
    lois_count: number;
    pipeline_amount: number;
  };
  issuing: {
    status: "not_started";
  };
  onboarding: {
    status: "not_started";
  };
  current_phase: "booking" | "issuing" | "onboarding";
}

interface FundOpsObject {
  id: string;
  name: string;
  description: string;
  iconLabel: string;
  route?: string;
  status: "not_started" | "partial" | "complete";
  disabled: boolean;
  tooltip?: string;
}

export default function FundOpsObjectsGrid() {
  const { activeCompanyId: companyId } = useCompany();
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!companyId || companyId.trim() === "") {
      setLoading(false);
      return;
    }

    const fetchProcessStatus = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/fundops_process_status?companyId=${companyId}`
        );

        if (!response.ok) {
          throw new Error("Errore nel caricamento dello stato del processo");
        }

        const data: ProcessStatus = await response.json();
        setProcessStatus(data);
      } catch (err) {
        console.error("Error fetching process status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProcessStatus();
  }, [companyId]);

  const getObjectStatus = (
    objectId: string
  ): "not_started" | "partial" | "complete" => {
    if (!processStatus) return "not_started";

    const { booking } = processStatus;

    switch (objectId) {
      case "investors":
        return booking.investors_count > 0 ? "complete" : "not_started";
      case "loi":
        if (booking.lois_count > 0) return "complete";
        if (booking.investors_count > 0) return "partial";
        return "not_started";
      default:
        return "not_started";
    }
  };

  const baseObjects: Array<
    Omit<FundOpsObject, "status"> & {
      status?: "not_started" | "partial" | "complete";
    }
  > = [
    {
      id: "investors",
      name: "Supporters",
      description: "Gestione supporter e relazioni",
      iconLabel: "SU",
      route: "/investors",
      disabled: false,
    },
    {
      id: "loi",
      name: "LOI",
      description: "Lettere di intenti e soft commitment",
      iconLabel: "LOI",
      route: "/lois",
      disabled: false,
    },
    {
      id: "investor-deck",
      name: "Pitch Deck",
      description: "Materiali per supporter",
      iconLabel: "PD",
      status: "not_started",
      disabled: true,
      tooltip: "Funzionalita in arrivo",
    },
    {
      id: "cap-table",
      name: "Cap Table",
      description: "Struttura equity e conversioni",
      iconLabel: "CT",
      route: "/cap-table",
      status: "not_started",
      disabled: false,
     },
    {
      id: "issuance",
      name: "Issuance",
      description: "Verifica investimenti e avanzamento della fase di issuance",
      iconLabel: "IS",
      route: "/issuance",
      status: "not_started",
      disabled: false,
    },
    {
      id: "safe-sfp",
      name: "SAFE/SFP",
      description: "Emissione strumenti finanziari (SAFE / SFP)",
      iconLabel: "SF",
      status: "not_started",
      disabled: true,
      tooltip: "Funzionalita in arrivo",
    },
    {
      id: "data-room",
      name: "Data Room",
      description: "Documentazione e due diligence",
      iconLabel: "DR",
      status: "not_started",
      disabled: true,
      tooltip: "Funzionalita in arrivo",
    },
    {
      id: "dossier-investitore",
      name: "Dossier",
      description: "Documentazione round e due diligence",
      iconLabel: "DO",
      route: "/dossier",
      status: "not_started",
      disabled: false,
    },
  ];

  const objects: FundOpsObject[] = baseObjects.map((obj) => ({
    ...obj,
    status: obj.status || getObjectStatus(obj.id),
  })) as FundOpsObject[];

  const getStatusLabel = (
    status: "not_started" | "partial" | "complete"
  ): string => {
    switch (status) {
      case "not_started":
        return "Non iniziato";
      case "partial":
        return "Parziale";
      case "complete":
        return "Completo";
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.loadingText}>Caricamento...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>FundOps Objects</h2>
        <p className={styles.subtitle}>Oggetti del sistema FundOps</p>
      </div>

      <div className={styles.grid}>
        {objects.map((object) => {
          const cardContent = (
            <>
              <div className={styles.cardHeader}>
                <div className={styles.iconContainer}>
                  <span className={styles.icon}>{object.iconLabel}</span>
                </div>
                <div
                  className={`${styles.statusBadge} ${styles[`status-${object.status}`]}`}
                >
                  {getStatusLabel(object.status)}
                </div>
              </div>
              <h3 className={styles.objectName}>{object.name}</h3>
              <p className={styles.objectDescription}>{object.description}</p>
              {!object.disabled && object.route && (
                <div className={styles.cta}>
                  <span className={styles.ctaText}>Apri -&gt;</span>
                </div>
              )}
              {object.disabled && (
                <div className={styles.disabledNote}>
                  <span className={styles.disabledText}>In arrivo</span>
                </div>
              )}
            </>
          );

          if (object.disabled) {
            return (
              <div
                key={object.id}
                className={`${styles.card} ${styles.disabled}`}
                data-object-id={object.id}
                title={object.tooltip}
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={object.id}
              href={object.route!}
              className={`${styles.card} ${styles[`status-${object.status}`]}`}
              data-object-id={object.id}
              aria-label={`Apri ${object.name}`}
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
