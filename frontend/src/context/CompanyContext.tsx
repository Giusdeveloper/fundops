"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CompanyBootstrapState =
  | "loading"
  | "ready"
  | "unauthorized"
  | "forbidden"
  | "no_companies"
  | "error";

interface CompanyContextType {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
  clearActiveCompanyId: () => void;
  isLoading: boolean;
  bootstrapState: CompanyBootstrapState;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = "fundops_active_company_id";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrapState, setBootstrapState] = useState<CompanyBootstrapState>("loading");

  useEffect(() => {
    let cancelled = false;

    const bootstrapCompany = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const response = await fetch("/api/my_companies");

        if (!response.ok) {
          localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) {
            setActiveCompanyIdState(null);
            if (response.status === 401) {
              setBootstrapState("unauthorized");
            } else if (response.status === 403) {
              setBootstrapState("forbidden");
            } else {
              setBootstrapState("error");
            }
          }
          return;
        }

        const payload = await response.json();
        const companies = Array.isArray(payload?.data) ? payload.data : [];

        if (!stored) {
          const firstCompanyId = companies[0]?.id ?? null;
          if (firstCompanyId) {
            localStorage.setItem(STORAGE_KEY, firstCompanyId);
            if (!cancelled) {
              setActiveCompanyIdState(firstCompanyId);
              setBootstrapState("ready");
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
            if (!cancelled) {
              setActiveCompanyIdState(null);
              setBootstrapState("no_companies");
            }
          }
          return;
        }

        const isValidCompany = companies.some((company: { id: string }) => company.id === stored);

        if (!isValidCompany) {
          localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) {
            setActiveCompanyIdState(null);
            setBootstrapState(companies.length > 0 ? "ready" : "no_companies");
          }
          return;
        }

        if (!cancelled) {
          setActiveCompanyIdState(stored);
          setBootstrapState("ready");
        }
      } catch (error) {
        console.error("Errore nel bootstrap della company attiva:", error);
        if (!cancelled) {
          setBootstrapState("error");
        }
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

  const setActiveCompanyId = (id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      setActiveCompanyIdState(id);
      setBootstrapState("ready");
    } catch (error) {
      console.error("Errore nel salvataggio della company attiva in localStorage:", error);
    }
  };

  const clearActiveCompanyId = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setActiveCompanyIdState(null);
      setBootstrapState("ready");
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
        bootstrapState,
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
