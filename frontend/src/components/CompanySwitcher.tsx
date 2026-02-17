"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import { ChevronDown } from "lucide-react";
import "./CompanySwitcher.css";

interface Company {
  id: string;
  name: string;
  legal_name?: string;
}

export default function CompanySwitcher() {
  const { activeCompanyId, setActiveCompanyId, clearActiveCompanyId, isLoading: isLoadingContext } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [accessDisabled, setAccessDisabled] = useState(false);

  // Carica companies via endpoint my_companies (RLS-safe)
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setAccessDisabled(false);
        const response = await fetch("/api/my_companies");
        if (response.status === 403) {
          setAccessDisabled(true);
          setCompanies([]);
          return;
        }
        if (!response.ok) {
          throw new Error("Errore nel caricamento delle aziende");
        }
        const result = await response.json();
        setCompanies(result.data ?? []);
      } catch (error) {
        console.error("Errore nel caricamento delle aziende:", error);
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Chiudi dropdown quando si clicca fuori
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

  // Trova la company attiva
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const displayName = accessDisabled
    ? "Accesso disabilitato"
    : activeCompany?.name || (companies.length === 0 ? "Nessuna azienda disponibile" : "Seleziona azienda");

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

  // Non mostrare nulla durante il caricamento iniziale del context
  if (isLoadingContext) {
    return null;
  }

  const buttonAriaProps = {
    "aria-label": "Seleziona azienda",
    "aria-expanded": (isOpen ? "true" : "false") as "true" | "false",
  };

  return (
    <div className="company-switcher" ref={dropdownRef}>
      <button
        className="company-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        {...buttonAriaProps}
      >
        <span className="company-switcher-label">{displayName}</span>
        <ChevronDown className={`company-switcher-icon ${isOpen ? "open" : ""}`} size={16} />
      </button>

      {isOpen && (
        <div className="company-switcher-dropdown">
          {isLoading ? (
            <div className="company-switcher-item">Caricamento...</div>
          ) : accessDisabled ? (
            <div className="company-switcher-item company-switcher-disabled">Accesso disabilitato</div>
          ) : companies.length === 0 ? (
            <div className="company-switcher-item">Nessuna azienda disponibile</div>
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
      )}
    </div>
  );
}
