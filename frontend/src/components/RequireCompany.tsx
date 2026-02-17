"use client";

import { useCompany } from "@/context/CompanyContext";
import Link from "next/link";

interface RequireCompanyProps {
  children?: React.ReactNode;
}

export default function RequireCompany({ children }: RequireCompanyProps) {
  const { activeCompanyId, isLoading } = useCompany();

  // Mostra loading durante il caricamento del context
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "400px",
        padding: "2rem"
      }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Caricamento...</p>
      </div>
    );
  }

  // Se manca companyId, mostra empty state
  if (!activeCompanyId) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "400px",
        padding: "2rem"
      }}>
        <div style={{
          background: "var(--background-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "2rem",
          maxWidth: "500px",
          textAlign: "center"
        }}>
          <h2 style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            color: "var(--text-primary)",
            marginBottom: "0.75rem"
          }}>
            Nessuna azienda selezionata
          </h2>
          <p style={{
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            marginBottom: "1.5rem",
            lineHeight: "1.5"
          }}>
            Seleziona un&apos;azienda per iniziare a lavorare su investitori e LOI.
          </p>
          <Link
            href="/companies"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "500",
              fontSize: "0.9rem",
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Vai alle companies
          </Link>
        </div>
      </div>
    );
  }

  // Se companyId presente, renderizza children
  return <>{children}</>;
}
