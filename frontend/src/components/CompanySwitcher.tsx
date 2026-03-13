"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import "./CompanySwitcher.css";

interface Company {
  id: string;
  name: string;
  legal_name?: string;
}

export default function CompanySwitcher() {
  const {
    activeCompanyId,
    setActiveCompanyId,
    clearActiveCompanyId,
    isLoading: isLoadingContext,
    bootstrapState,
  } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [fetchState, setFetchState] = useState<"loading" | "ready" | "unauthorized" | "forbidden" | "error">("loading");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setFetchState("loading");
        const response = await fetch("/api/my_companies");
        if (response.status === 401) {
          setFetchState("unauthorized");
          setCompanies([]);
          return;
        }
        if (response.status === 403) {
          setFetchState("forbidden");
          setCompanies([]);
          return;
        }
        if (!response.ok) {
          throw new Error("Errore nel caricamento delle aziende");
        }
        const result = await response.json();
        setCompanies(result.data ?? []);
        setFetchState("ready");
      } catch (error) {
        console.error("Errore nel caricamento delle aziende:", error);
        setCompanies([]);
        setFetchState("error");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchCompanies();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeCompany = companies.find((company) => company.id === activeCompanyId);
  const displayName =
    bootstrapState === "unauthorized" || fetchState === "unauthorized"
      ? "Sessione scaduta"
      : bootstrapState === "forbidden" || fetchState === "forbidden"
        ? "Accesso disabilitato"
        : bootstrapState === "error" || fetchState === "error"
          ? "Errore companies"
          : bootstrapState === "no_companies"
            ? "Nessuna company"
            : activeCompany?.name || "Seleziona company";

  const handleSelectCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
    setIsOpen(false);
    router.push("/dashboard");
  };

  const handleReset = () => {
    clearActiveCompanyId();
    setIsOpen(false);
    router.push("/companies");
  };

  const handleManageCompanies = () => {
    setIsOpen(false);
    router.push("/companies");
  };

  const handleLogin = () => {
    setIsOpen(false);
    const redirect = pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : "";
    router.push(`/login${redirect}`);
  };

  if (isLoadingContext) {
    return null;
  }

  return (
    <div className="company-switcher" ref={dropdownRef}>
      <button
        className="company-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Seleziona azienda"
        aria-expanded={isOpen ? "true" : "false"}
      >
        <span className="company-switcher-label">{displayName}</span>
        <ChevronDown className={`company-switcher-icon ${isOpen ? "open" : ""}`} size={16} />
      </button>

      {isOpen ? (
        <div className="company-switcher-dropdown">
          {isLoading ? (
            <div className="company-switcher-item">Caricamento...</div>
          ) : bootstrapState === "unauthorized" || fetchState === "unauthorized" ? (
            <>
              <div className="company-switcher-item company-switcher-disabled">Sessione scaduta</div>
              <button className="company-switcher-item" onClick={handleLogin}>
                Vai al login
              </button>
            </>
          ) : bootstrapState === "forbidden" || fetchState === "forbidden" ? (
            <div className="company-switcher-item company-switcher-disabled">Accesso disabilitato</div>
          ) : bootstrapState === "error" || fetchState === "error" ? (
            <>
              <div className="company-switcher-item company-switcher-disabled">Impossibile caricare le companies</div>
              <button className="company-switcher-item" onClick={handleManageCompanies}>
                Vai alle companies
              </button>
            </>
          ) : companies.length === 0 ? (
            <>
              <div className="company-switcher-item company-switcher-disabled">Nessuna company disponibile</div>
              <button className="company-switcher-item" onClick={handleManageCompanies}>
                Vai alle companies
              </button>
            </>
          ) : (
            <>
              {companies.map((company) => (
                <button
                  key={company.id}
                  className={`company-switcher-item ${activeCompanyId === company.id ? "active" : ""}`}
                  onClick={() => handleSelectCompany(company.id)}
                >
                  {company.name}
                </button>
              ))}
              <div className="company-switcher-divider" />
              <button className="company-switcher-item" onClick={handleManageCompanies}>
                Gestisci aziende
              </button>
              <button className="company-switcher-item company-switcher-reset" onClick={handleReset}>
                Reset selezione
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
