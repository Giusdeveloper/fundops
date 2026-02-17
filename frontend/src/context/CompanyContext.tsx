"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CompanyContextType {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
  clearActiveCompanyId: () => void;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = "fundops_active_company_id";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carica da localStorage al mount e valida che la company sia ancora accessibile.
  useEffect(() => {
    let cancelled = false;

    const bootstrapCompany = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;

        const response = await fetch("/api/my_companies");
        if (!response.ok) {
          // Sessione non valida o permessi mancanti: evita stato stale.
          localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) {
            setActiveCompanyIdState(null);
          }
          return;
        }

        const payload = await response.json();
        const companies = Array.isArray(payload?.data) ? payload.data : [];
        const isValidCompany = companies.some((company: { id: string }) => company.id === stored);

        if (!isValidCompany) {
          localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) {
            setActiveCompanyIdState(null);
          }
          return;
        }

        if (!cancelled) {
          setActiveCompanyIdState(stored);
        }
      } catch (error) {
        console.error("Errore nel bootstrap della company attiva:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapCompany();

    return () => {
      cancelled = true;
    };
  }, []);

  // Salva in localStorage quando cambia
  const setActiveCompanyId = (id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      setActiveCompanyIdState(id);
    } catch (error) {
      console.error("Errore nel salvataggio della company attiva in localStorage:", error);
    }
  };

  const clearActiveCompanyId = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setActiveCompanyIdState(null);
    } catch (error) {
      console.error("Errore nella rimozione della company attiva da localStorage:", error);
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        activeCompanyId,
        setActiveCompanyId,
        clearActiveCompanyId,
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
