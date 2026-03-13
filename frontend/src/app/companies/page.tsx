"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TutorialModal from "@/components/onboarding/TutorialModal";
import { useTutorial } from "@/components/onboarding/useTutorial";
import { useCompany } from "@/context/CompanyContext";
import { companiesTutorialContent, companiesTutorialDefinition, companiesTutorialSteps, type CompaniesTutorialStep } from "@/lib/tutorials/companies";
import type { TutorialStepState } from "@/lib/tutorials/types";
import { Upload, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./companies.module.css";

interface Company {
  id: string;
  name: string;
  legal_name?: string;
  vat_number?: string;
  address?: string;
  email?: string;
  pec?: string;
  city?: string;
  notes?: string;
  settore?: string;
  website?: string;
  profilo_linkedin?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApiResponse {
  data: Company[];
  error?: string;
}

export default function CompaniesPage() {
  const router = useRouter();
  const { activeCompanyId, setActiveCompanyId } = useCompany();
  const sectionRefs = useRef<Record<CompaniesTutorialStep, HTMLElement | null>>({
    context: null,
    create: null,
    select: null,
  });
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    vat_number: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "created-desc">("name-asc");
  const [hasEmailFilter, setHasEmailFilter] = useState<"all" | "yes" | "no">("all");
  const [hasVatFilter, setHasVatFilter] = useState<"all" | "yes" | "no">("all");
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState<"all" | "yes" | "no">("all");

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/fundops_companies");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel caricamento delle aziende");
      }

      const result: ApiResponse = await response.json();
      const companiesData = result.data || [];
      setCompanies(companiesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.name) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/fundops_companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Errore nella creazione dell'azienda");
        return;
      }

      setForm({
        name: "",
        legal_name: "",
        vat_number: "",
        address: "",
      });

      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetActive = (companyId: string) => {
    setActiveCompanyId(companyId);
    router.push('/dashboard');
  };

  // Filtri e sort
  const filteredAndSortedCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        company.name?.toLowerCase().includes(term) ||
        company.legal_name?.toLowerCase().includes(term) ||
        company.vat_number?.toLowerCase().includes(term) ||
        company.email?.toLowerCase().includes(term) ||
        company.pec?.toLowerCase().includes(term) ||
        company.city?.toLowerCase().includes(term) ||
        company.settore?.toLowerCase().includes(term) ||
        company.website?.toLowerCase().includes(term);

      const matchesEmail =
        hasEmailFilter === "all" ||
        (hasEmailFilter === "yes" && company.email && company.email.trim() !== "") ||
        (hasEmailFilter === "no" && (!company.email || company.email.trim() === ""));

      const matchesVat =
        hasVatFilter === "all" ||
        (hasVatFilter === "yes" && company.vat_number && company.vat_number.trim() !== "") ||
        (hasVatFilter === "no" && (!company.vat_number || company.vat_number.trim() === ""));

      const matchesWebsite =
        hasWebsiteFilter === "all" ||
        (hasWebsiteFilter === "yes" && company.website && company.website.trim() !== "") ||
        (hasWebsiteFilter === "no" && (!company.website || company.website.trim() === ""));

      return matchesSearch && matchesEmail && matchesVat && matchesWebsite;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      } else if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "");
      } else if (sortBy === "created-desc") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return filtered;
  }, [companies, searchTerm, hasEmailFilter, hasVatFilter, hasWebsiteFilter, sortBy]);
  const tutorialStates = useMemo<Record<CompaniesTutorialStep, TutorialStepState>>(() => {
    const hasCompanies = companies.length > 0;
    const hasActiveCompany = Boolean(activeCompanyId);
    const createReady = Boolean(form.name.trim());

    return {
      context: hasActiveCompany
        ? {
            status: "complete",
            statusLabel: "Pronto",
            smartMessage: `La company attiva è ${companies.find((company) => company.id === activeCompanyId)?.name || "impostata"}. Tutti i moduli useranno questo contesto.`,
            ctaLabel: "Rivedi il contesto attivo",
            ctaIntent: "focus",
          }
        : {
            status: hasCompanies ? "attention" : "pending",
            statusLabel: hasCompanies ? "Da impostare" : "Da iniziare",
            smartMessage: hasCompanies
              ? "Hai già company disponibili, ma devi ancora impostarne una come attiva prima di entrare nel workflow."
              : "Non hai ancora una company attiva. Se la startup non esiste, creala qui e poi selezionala.",
            ctaLabel: hasCompanies ? "Scegli la company attiva" : "Parti da qui",
            ctaIntent: "focus",
          },
      create: createReady
        ? {
            status: "attention",
            statusLabel: "In bozza",
            smartMessage: "Hai già iniziato a compilare il form. Completa i dati minimi e crea la startup.",
            ctaLabel: "Completa la nuova company",
            ctaIntent: "focus",
          }
        : {
            status: hasCompanies ? "complete" : "pending",
            statusLabel: hasCompanies ? "Opzionale" : "Utile",
            smartMessage: hasCompanies
              ? "Puoi usare questo blocco quando devi aggiungere una startup nuova senza uscire dal workflow."
              : "Se la startup non è ancora presente, questo è il punto corretto da cui creare il contesto operativo.",
            ctaLabel: "Apri il form company",
            ctaIntent: "focus",
          },
      select: hasCompanies
        ? {
            status: "complete",
            statusLabel: "Pronto",
            smartMessage: "La lista company è pronta. Qui scegli il contesto attivo e salti nel modulo giusto.",
            ctaLabel: hasActiveCompany ? "Apri la lista company" : "Seleziona una company",
            ctaIntent: "focus",
          }
        : {
            status: "pending",
            statusLabel: "In attesa",
            smartMessage: "La lista si popolerà dopo la prima creazione o importazione di una company.",
            ctaLabel: "Vai alla lista",
            ctaIntent: "focus",
          },
    };
  }, [activeCompanyId, companies, form.name]);
  const tutorial = useTutorial<CompaniesTutorialStep>({
    storageKey: companiesTutorialDefinition.storageKey,
    steps: companiesTutorialSteps.map((step) => step.id),
    initialStepId: "context",
  });
  const tutorialStep = tutorial.currentStepId;
  const currentTutorial = companiesTutorialContent[tutorialStep];
  const currentTutorialState = tutorialStates[tutorialStep];

  function focusSection(step: CompaniesTutorialStep) {
    const node = sectionRefs.current[step];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleTutorialStepSelect(step: CompaniesTutorialStep) {
    tutorial.goToStep(step);
    setTimeout(() => focusSection(step), 60);
  }

  function handleTutorialPrevious() {
    const previous = companiesTutorialSteps[tutorial.currentIndex - 1]?.id;
    tutorial.goToPreviousStep();
    if (previous) setTimeout(() => focusSection(previous), 60);
  }

  function handleTutorialNext() {
    const next = companiesTutorialSteps[tutorial.currentIndex + 1]?.id;
    tutorial.goToNextStep();
    if (next) setTimeout(() => focusSection(next), 60);
  }

  function handleTutorialAction() {
    tutorial.close(false);
    setTimeout(() => focusSection(tutorialStep), 120);
  }

  return (
    <>
      {tutorial.clientReady ? (
        <TutorialModal
          isOpen={tutorial.isOpen}
          ariaLabel={companiesTutorialDefinition.ariaLabel}
          eyebrow={companiesTutorialDefinition.eyebrow}
          steps={companiesTutorialSteps}
          currentStepId={tutorialStep}
          currentIndex={tutorial.currentIndex}
          content={currentTutorial}
          states={tutorialStates}
          smartState={currentTutorialState}
          onClose={() => tutorial.close(false)}
          onSkip={() => tutorial.close(true)}
          onStepSelect={handleTutorialStepSelect}
          onPrevious={handleTutorialPrevious}
          onNext={handleTutorialNext}
          onAction={handleTutorialAction}
        />
      ) : null}
      <header
        ref={(node) => {
          sectionRefs.current.context = node;
        }}
        className={`${styles["page-header"]} ${tutorial.isOpen && tutorialStep === "context" ? styles["tutorial-section-active"] : ""}`}
      >
          <h1 className={styles["page-title"]}>Companies</h1>
          <p className={styles["page-subtitle"]}>
            Seleziona la company attiva e gestisci investor e LOI.
          </p>
          <div className={styles["page-meta-row"]}>
            <button type="button" className={styles["tutorial-launcher"]} onClick={() => tutorial.reopen()}>
              Apri tutorial companies
            </button>
          </div>
          {activeCompanyId && (
            <div className={styles["page-meta-row"]}>
              <span className={styles["page-pill"]}>
                Company attiva: {companies.find(c => c.id === activeCompanyId)?.name || activeCompanyId}
              </span>
            </div>
          )}
        </header>

        {/* Error Message */}
        {error && (
          <div className={styles["error-message"]}>
            <p className={styles["error-text"]}>{error}</p>
          </div>
        )}

        {/* Actions Bar */}
        <div className={styles["actions-bar"]}>
          <Link
            href="/companies/import"
            className={styles["import-button"]}
          >
            <Upload size={16} />
            Importa CSV
          </Link>
        </div>

        {/* New Company Form */}
        <section
          ref={(node) => {
            sectionRefs.current.create = node;
          }}
          className={`${styles["form-card"]} ${tutorial.isOpen && tutorialStep === "create" ? styles["tutorial-section-active"] : ""}`}
        >
          <h2 className={styles["form-title"]}>Crea nuova company</h2>
          <p className={styles["form-subtitle"]}>
            Aggiungi una nuova azienda al sistema per iniziare a gestire investitori e LOI.
          </p>
          <form onSubmit={handleSubmit}>
            <div className={styles["form-grid"]}>
              <div className={styles["form-field"]}>
                <label className={styles["form-label"]} htmlFor="name">
                  Nome <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={styles["form-input"]}
                  placeholder="Nome azienda"
                />
              </div>
              <div className={styles["form-field"]}>
                <label className={styles["form-label"]} htmlFor="legal_name">
                  Ragione Sociale
                </label>
                <input
                  type="text"
                  id="legal_name"
                  name="legal_name"
                  value={form.legal_name}
                  onChange={handleChange}
                  className={styles["form-input"]}
                  placeholder="Ragione sociale"
                />
              </div>
              <div className={styles["form-field"]}>
                <label className={styles["form-label"]} htmlFor="vat_number">
                  Partita IVA
                </label>
                <input
                  type="text"
                  id="vat_number"
                  name="vat_number"
                  value={form.vat_number}
                  onChange={handleChange}
                  className={styles["form-input"]}
                  placeholder="Partita IVA"
                />
              </div>
              <div className={styles["form-field"]}>
                <label className={styles["form-label"]} htmlFor="address">
                  Indirizzo
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className={styles["form-input"]}
                  placeholder="Indirizzo"
                />
              </div>
            </div>
            <div className={styles["form-actions"]}>
              <button
                type="submit"
                disabled={submitting}
                className={styles["form-primary-button"]}
              >
                {submitting ? "Salvataggio..." : "Crea azienda"}
              </button>
            </div>
          </form>
        </section>

        {/* Companies List */}
        <section
          ref={(node) => {
            sectionRefs.current.select = node;
          }}
          className={tutorial.isOpen && tutorialStep === "select" ? styles["tutorial-section-active"] : undefined}
        >
          <div className={styles["list-header"]}>
            <h2 className={styles["form-title"]} style={{ marginBottom: 0 }}>Lista companies</h2>
            <div className={styles["list-controls"]}>
              {/* Search */}
              <div className={styles["search-wrapper"]}>
                <Search size={16} className={styles["search-icon"]} />
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles["search-input"]}
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name-asc" | "name-desc" | "created-desc")}
                className={styles["sort-select"]}
              >
                <option value="name-asc">Nome A-Z</option>
                <option value="name-desc">Nome Z-A</option>
                <option value="created-desc">Più recenti</option>
              </select>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`${styles["filter-toggle"]} ${showFilters ? styles["filter-toggle-active"] : ""}`}
              >
                <Filter size={16} />
                Filtri
                {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className={styles["filters-panel"]}>
              <div className={styles["filters-grid"]}>
                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]}>Email</label>
                  <select
                    value={hasEmailFilter}
                    onChange={(e) => setHasEmailFilter(e.target.value as "all" | "yes" | "no")}
                    className={styles["filter-select"]}
                  >
                    <option value="all">Tutte</option>
                    <option value="yes">Con email</option>
                    <option value="no">Senza email</option>
                  </select>
                </div>
                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]}>Partita IVA</label>
                  <select
                    value={hasVatFilter}
                    onChange={(e) => setHasVatFilter(e.target.value as "all" | "yes" | "no")}
                    className={styles["filter-select"]}
                  >
                    <option value="all">Tutte</option>
                    <option value="yes">Con P.IVA</option>
                    <option value="no">Senza P.IVA</option>
                  </select>
                </div>
                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]}>Website</label>
                  <select
                    value={hasWebsiteFilter}
                    onChange={(e) => setHasWebsiteFilter(e.target.value as "all" | "yes" | "no")}
                    className={styles["filter-select"]}
                  >
                    <option value="all">Tutte</option>
                    <option value="yes">Con website</option>
                    <option value="no">Senza website</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p className={styles["empty-text"]}>Caricamento aziende...</p>
          ) : filteredAndSortedCompanies.length === 0 ? (
            <p className={styles["empty-text"]}>
              {companies.length === 0
                ? "Nessuna azienda disponibile. Crea la prima company per iniziare."
                : "Nessuna azienda corrisponde ai filtri selezionati."}
            </p>
          ) : (
            <div className={styles["companies-list"]}>
              {filteredAndSortedCompanies.map((company) => {
                const isActive = activeCompanyId === company.id;
                return (
                  <div
                    key={company.id}
                    className={`${styles["company-card"]} ${isActive ? styles["company-card-active"] : ''}`}
                  >
                    <div className={styles["company-header"]}>
                      <h3 className={styles["company-name"]}>
                        {company.name}
                      </h3>
                      {isActive && (
                        <span className={styles["company-badge-active"]}>
                          Attiva
                        </span>
                      )}
                    </div>
                    <div className={styles["company-details"]}>
                      {company.legal_name ? (
                        <div className={styles["company-detail-item"]}>
                          <div className={styles["company-detail-label"]}>Ragione Sociale</div>
                          <div className={styles["company-detail-value"]}>{company.legal_name}</div>
                        </div>
                      ) : null}
                      {company.vat_number ? (
                        <div className={styles["company-detail-item"]}>
                          <div className={styles["company-detail-label"]}>Partita IVA</div>
                          <div className={`${styles["company-detail-value"]} ${styles["company-detail-value-mono"]}`}>
                            {company.vat_number}
                          </div>
                        </div>
                      ) : null}
                      {company.settore ? (
                        <div className={styles["company-detail-item"]}>
                          <div className={styles["company-detail-label"]}>Settore</div>
                          <div className={styles["company-detail-value"]}>{company.settore}</div>
                        </div>
                      ) : null}
                      {company.website ? (
                        <div className={styles["company-detail-item"]}>
                          <div className={styles["company-detail-label"]}>Website</div>
                          <div className={styles["company-detail-value"]}>
                            <a href={company.website} target="_blank" rel="noopener noreferrer" className={styles["company-link"]}>
                              {company.website}
                            </a>
                          </div>
                        </div>
                      ) : null}
                      {company.profilo_linkedin ? (
                        <div className={styles["company-detail-item"]}>
                          <div className={styles["company-detail-label"]}>Profilo Linkedin</div>
                          <div className={styles["company-detail-value"]}>
                            <a href={company.profilo_linkedin} target="_blank" rel="noopener noreferrer" className={styles["company-link"]}>
                              {company.profilo_linkedin}
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className={styles["company-actions"]}>
                      {!isActive && (
                        <button
                          onClick={() => handleSetActive(company.id)}
                          className={styles["company-action-primary"]}
                        >
                          Imposta come attiva
                        </button>
                      )}
                      <div className={styles["company-action-links"]}>
                        <Link
                          href="/dashboard"
                          className={styles["company-action-link"]}
                          onClick={() => {
                            setActiveCompanyId(company.id);
                          }}
                        >
                          Vai a Dashboard
                        </Link>
                        <Link
                          href="/investors"
                          className={styles["company-action-link"]}
                          onClick={() => {
                            setActiveCompanyId(company.id);
                          }}
                        >
                          Gestisci Investitori
                        </Link>
                        <Link
                          href="/lois"
                          className={styles["company-action-link"]}
                          onClick={() => {
                            setActiveCompanyId(company.id);
                          }}
                        >
                          Gestisci LOI
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
    </>
  );
}
