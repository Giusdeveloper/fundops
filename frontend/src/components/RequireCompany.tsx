"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";

interface RequireCompanyProps {
  children?: ReactNode;
  missingSelectionTitle?: string;
  missingSelectionDescription?: string;
  missingSelectionCtaLabel?: string;
  missingSelectionCtaHref?: string;
}

const wrapperStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "400px",
  padding: "2rem",
} satisfies CSSProperties;

const cardStyle = {
  background: "var(--background-card)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  padding: "2rem",
  maxWidth: "500px",
  textAlign: "center",
} satisfies CSSProperties;

const titleStyle = {
  fontSize: "1.5rem",
  fontWeight: "600",
  color: "var(--text-primary)",
  marginBottom: "0.75rem",
} satisfies CSSProperties;

const descriptionStyle = {
  fontSize: "0.9rem",
  color: "var(--text-secondary)",
  marginBottom: "1.5rem",
  lineHeight: "1.5",
} satisfies CSSProperties;

const ctaStyle = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
  color: "white",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: "500",
  fontSize: "0.9rem",
  transition: "opacity 0.2s",
} satisfies CSSProperties;

function EmptyStateCard({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <p style={descriptionStyle}>{description}</p>
        <Link
          href={ctaHref}
          style={ctaStyle}
          onMouseEnter={(event) => {
            event.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.opacity = "1";
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default function RequireCompany({
  children,
  missingSelectionTitle = "Nessuna company selezionata",
  missingSelectionDescription = "Seleziona una company per iniziare a lavorare su investitori e LOI.",
  missingSelectionCtaLabel = "Vai alle companies",
  missingSelectionCtaHref = "/companies",
}: RequireCompanyProps) {
  const { activeCompanyId, isLoading, bootstrapState } = useCompany();
  const pathname = usePathname();
  const loginHref = pathname && pathname !== "/" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";

  if (isLoading || bootstrapState === "loading") {
    return (
      <div style={wrapperStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Caricamento...</p>
      </div>
    );
  }

  if (bootstrapState === "unauthorized") {
    return (
      <EmptyStateCard
        title="Sessione scaduta"
        description="Effettua di nuovo il login per accedere alla tua company e continuare il lavoro."
        ctaHref={loginHref}
        ctaLabel="Vai al login"
      />
    );
  }

  if (bootstrapState === "forbidden") {
    return (
      <EmptyStateCard
        title="Accesso disabilitato"
        description="Il tuo profilo non e attivo su FundOps. Contatta un amministratore per riattivare l'accesso."
        ctaHref="/login"
        ctaLabel="Torna al login"
      />
    );
  }

  if (bootstrapState === "error") {
    return (
      <EmptyStateCard
        title="Impossibile caricare le companies"
        description="Non siamo riusciti a verificare il contesto company. Riprova dalla lista companies."
        ctaHref="/companies"
        ctaLabel="Vai alle companies"
      />
    );
  }

  if (bootstrapState === "no_companies") {
    return (
      <EmptyStateCard
        title="Nessuna company disponibile"
        description="Non risulta ancora nessuna company associata al tuo account FundOps."
        ctaHref="/companies"
        ctaLabel="Apri companies"
      />
    );
  }

  if (!activeCompanyId) {
    return (
      <EmptyStateCard
        title={missingSelectionTitle}
        description={missingSelectionDescription}
        ctaHref={missingSelectionCtaHref}
        ctaLabel={missingSelectionCtaLabel}
      />
    );
  }

  return <>{children}</>;
}
