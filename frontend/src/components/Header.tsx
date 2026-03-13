 "use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import ProfileOrbitMenu from "./ProfileOrbitMenu";
import type { UserUiContext } from "@/lib/auth/getUserUiContext";

interface HeaderProps {
  uiContext: UserUiContext;
}

const Header = ({ uiContext }: HeaderProps) => {
  const pathname = usePathname();
  const { activeCompanyId } = useCompany();
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyName = async () => {
      if (!activeCompanyId) {
        setCompanyName(null);
        return;
      }

      try {
        const response = await fetch("/api/my_companies", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setCompanyName(null);
          return;
        }

        const payload = await response.json();
        const companies = Array.isArray(payload?.data) ? payload.data : [];
        const activeCompany = companies.find((company: { id: string; name?: string; legal_name?: string }) => company.id === activeCompanyId);

        if (!cancelled) {
          setCompanyName(activeCompany?.name || activeCompany?.legal_name || null);
        }
      } catch {
        if (!cancelled) setCompanyName(null);
      }
    };

    void loadCompanyName();

    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  const headerMeta = useMemo(() => {
    const path = pathname || "/dashboard";

    if (path.startsWith("/cap-table")) {
      return {
        title: "Cap Table",
        subtitle: "Simulazioni e scenari della struttura societaria.",
      };
    }
    if (path.startsWith("/issuance")) {
      return {
        title: "Issuance",
        subtitle: "Workflow operativo di emissione e tracking investimenti.",
      };
    }
    if (path.startsWith("/lois")) {
      return {
        title: "LOI",
        subtitle: "Lettere di intenti, signing flow e follow-up.",
      };
    }
    if (path.startsWith("/investors")) {
      return {
        title: "Supporters",
        subtitle: "Anagrafica, stato e relazione con investitori e supporter.",
      };
    }
    if (path.startsWith("/companies")) {
      return {
        title: "Companies",
        subtitle: "Contesto startup e gestione company attive.",
      };
    }
    if (path.startsWith("/dossier")) {
      return {
        title: "Dossier",
        subtitle: "Documenti e materiali della startup in un unico punto.",
      };
    }
    if (path.startsWith("/account")) {
      return {
        title: "Account",
        subtitle: "Profilo, accessi, preferenze e sicurezza personale.",
      };
    }
    if (path.startsWith("/admin")) {
      return {
        title: "Admin",
        subtitle: "Controllo utenti, permessi e configurazioni di piattaforma.",
      };
    }

    return {
      title: "Dashboard",
      subtitle: "Vista generale del workspace FundOps.",
    };
  }, [pathname]);

  return (
    <header className="main-header">
      <div className="header-copy">
        <h1 className="header-title">{headerMeta.title}</h1>
        <p className="header-subtitle">{headerMeta.subtitle}</p>
      </div>
      <div className="header-actions">
        {companyName ? (
          <div className="header-chip" title={companyName}>
            <span className="header-chip-label">Company attiva</span>
            <span className="header-chip-value">{companyName}</span>
          </div>
        ) : null}
        <ProfileOrbitMenu uiContext={uiContext} />
      </div>
    </header>
  );
};

export default Header; 
