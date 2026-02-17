"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import { Upload, Link2, UserPlus } from "lucide-react";
import styles from "./investors.module.css";

interface Investor {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  phone?: string;
  category?: string;
  type?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  investor_type?: string;
  source_type?: string;
  source?: string;
  client_name?: string;
  linkedin?: string;
  client_company_id?: string;
  client_company_match_type?: "exact" | "normalized" | "manual";
  client_company_matched_at?: string;
}

interface LOI {
  id: string;
  investor_id: string;
  loi_number: string;
  title: string;
  ticket_amount: number;
  currency?: string;
  status?: string;
  created_at?: string;
}

interface Company {
  id: string;
  name?: string;
  legal_name?: string;
}

interface ApiResponse<T> {
  data?: T[];
  error?: string;
}

export default function InvestorsPage() {
  const searchParams = useSearchParams();
  const { activeCompanyId: companyId } = useCompany();
  const onlyMissingLoi = searchParams.get("only_missing_loi") === "1";

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [investorTypeFilter, setInvestorTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [clientNameFilter, setClientNameFilter] = useState("");
  const [hasLinkedinFilter, setHasLinkedinFilter] = useState<"all" | "yes" | "no">("all");
  const [hasEmailFilter, setHasEmailFilter] = useState<"all" | "yes" | "no">("all");
  const [hasPhoneFilter, setHasPhoneFilter] = useState<"all" | "yes" | "no">("all");
  const [showForm, setShowForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "loi-desc">("name-asc");
  const [loiCountByInvestorId, setLoiCountByInvestorId] = useState<Record<string, number>>({});
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [kpis, setKpis] = useState<{
    totalInvestors: number;
    activeLois: number;
    committedLois: number;
    pipelineCapital: number;
    committedCapital: number;
  } | null>(null);
  const [kpisLoading, setKpisLoading] = useState<boolean>(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    category: "",
    type: "",
    notes: "",
  });

  const fetchInvestors = useCallback(async () => {
    if (!companyId || companyId.trim() === "") {
      setInvestors([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `/api/fundops_investors?companyId=${companyId}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel caricamento degli investitori");
      }

      const result: ApiResponse<Investor> = await response.json();
      const investorsData = Array.isArray(result) ? result : result.data ?? [];
      setInvestors(investorsData as Investor[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchLois = useCallback(async () => {
    if (!companyId || companyId.trim() === '') return;

    try {
      const response = await fetch(`/api/fundops_lois?companyId=${companyId}`);

      if (!response.ok) {
        // Silent fail per le LOI, non è critico
        return;
      }

      const json: ApiResponse<LOI> | LOI[] = await response.json();
      const loisData = Array.isArray(json) ? json : json.data ?? [];

      const counts: Record<string, number> = {};
      loisData.forEach((loi) => {
        if (!loi.investor_id) return;
        counts[loi.investor_id] = (counts[loi.investor_id] ?? 0) + 1;
      });

      setLoiCountByInvestorId(counts);
    } catch (err) {
      // Silent fail per le LOI
      console.error("Errore nel caricamento delle LOI:", err);
    }
  }, [companyId]);

  const fetchKpis = useCallback(async () => {
    if (!companyId || companyId.trim() === '') {
      setKpis(null);
      return;
    }

    try {
      setKpisLoading(true);
      const response = await fetch(`/api/fundops_investors_kpi?companyId=${companyId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching KPIs:", errorData);
        setKpis(null);
        return;
      }

      const data = await response.json();
      console.log("KPI data loaded:", data);
      setKpis(data);
    } catch (err) {
      console.error("Errore nel caricamento delle KPI:", err);
      setKpis(null);
    } finally {
      setKpisLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchInvestors();
      fetchLois();
      fetchKpis();
      // Fetch company name
      fetch(`/api/fundops_companies`)
        .then((res) => res.json())
        .then((data: ApiResponse<Company> | Company[]) => {
          const companies = Array.isArray(data) ? data : data.data ?? [];
          const found = companies.find((c: Company) => c.id === companyId);
          if (found) {
            setCompanyName(found.name || found.legal_name || null);
          }
        })
        .catch(() => {});
    } else {
      setInvestors([]);
      setCompanyName(null);
      setKpis(null);
      setLoiCountByInvestorId({});
    }
  }, [companyId, fetchInvestors, fetchLois, fetchKpis]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteLink(null);
    setError(null);
    try {
      const res = await fetch("/api/invites/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), company_id: companyId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Errore invito");
        return;
      }
      setInviteLink(json.invite_url || json.invite_link || null);
      setInviteEmail("");
      await fetchInvestors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore invito");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.full_name || !form.email || !companyId) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/fundops_investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          category: form.category || null,
          type: form.type || null,
          notes: form.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Errore nella creazione dell'investitore");
        return;
      }

      setForm({
        full_name: "",
        email: "",
        phone: "",
        category: "",
        type: "",
        notes: "",
      });

      await fetchInvestors();
      await fetchLois();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  };

  // Estrai valori unici per i filtri dropdown
  const uniqueSources = Array.from(new Set(investors.map(i => i.source).filter(Boolean)));
  const uniqueClientNames = Array.from(new Set(investors.map(i => i.client_name).filter(Boolean)));

  // Filtro client-side
  const filteredInvestors = investors.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      inv.full_name.toLowerCase().includes(term) ||
      inv.email?.toLowerCase().includes(term) ||
      inv.phone?.toLowerCase().includes(term) ||
      inv.linkedin?.toLowerCase().includes(term) ||
      inv.source?.toLowerCase().includes(term) ||
      inv.client_name?.toLowerCase().includes(term);

    const matchesCategory =
      !categoryFilter || inv.category === categoryFilter;

    const matchesInvestorType =
      !investorTypeFilter || inv.investor_type === investorTypeFilter;

    const matchesSource =
      !sourceFilter || inv.source === sourceFilter;

    const matchesClientName =
      !clientNameFilter || inv.client_name === clientNameFilter;

    const matchesLinkedin =
      hasLinkedinFilter === "all" ||
      (hasLinkedinFilter === "yes" && inv.linkedin && inv.linkedin.trim() !== "") ||
      (hasLinkedinFilter === "no" && (!inv.linkedin || inv.linkedin.trim() === ""));

    const matchesEmail =
      hasEmailFilter === "all" ||
      (hasEmailFilter === "yes" && inv.email && inv.email.trim() !== "") ||
      (hasEmailFilter === "no" && (!inv.email || inv.email.trim() === ""));

    const matchesPhone =
      hasPhoneFilter === "all" ||
      (hasPhoneFilter === "yes" && inv.phone && inv.phone.trim() !== "") ||
      (hasPhoneFilter === "no" && (!inv.phone || inv.phone.trim() === ""));

    // Filtro per investitori senza LOI (se only_missing_loi=1)
    const matchesMissingLoi =
      !onlyMissingLoi || !loiCountByInvestorId[inv.id] || loiCountByInvestorId[inv.id] === 0;

    return matchesSearch && matchesCategory && matchesInvestorType && 
           matchesSource && matchesClientName && matchesLinkedin && 
           matchesEmail && matchesPhone && matchesMissingLoi;
  });

  // Ordinamento
  const sortedInvestors = [...filteredInvestors].sort((a, b) => {
    if (sortBy === "name-asc") {
      return a.full_name.localeCompare(b.full_name);
    }
    if (sortBy === "name-desc") {
      return b.full_name.localeCompare(a.full_name);
    }
    if (sortBy === "loi-desc") {
      const countA = loiCountByInvestorId[a.id] ?? 0;
      const countB = loiCountByInvestorId[b.id] ?? 0;
      return countB - countA;
    }
    return 0;
  });

  // Formatta data per matched_at
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("it-IT", { 
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric" 
      });
    } catch {
      return "";
    }
  };

  // Formatta valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };


  return (
    <>
      <header className={styles["page-header"]}>
          <h1 className={styles["page-title"]}>Investitori</h1>
          <p className={styles["page-subtitle"]}>
            Gestisci i contatti e le relazioni della raccolta per la company attiva.
          </p>
          <div className={styles["page-meta-row"]}>
            {companyId && (
              <span className={styles["page-pill"]}>
                {companyName || `ID: ${companyId}`}
              </span>
            )}
            <span className={styles["page-pill"]}>
              Totale investitori: {filteredInvestors.length}
            </span>
          {!companyId && (
            <span className={styles["page-pill-warning"]}>
              ⚠️ Seleziona una company per filtrare gli investitori riconciliati
            </span>
          )}
          {onlyMissingLoi && companyId && (
            <span className={styles["page-pill-info"]}>
              🔍 Solo investitori senza LOI
            </span>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      {companyId && (
        <section className={styles["kpi-section"]}>
          {kpisLoading ? (
            <div className={styles["kpi-loading"]}>Caricamento KPI...</div>
          ) : kpis ? (
            <div className={styles["kpi-grid"]}>
              {/* Total Investors */}
              <div className={styles["kpi-card"]}>
                <div className={`${styles["kpi-icon"]} ${styles["kpi-icon-investors"]}`}>
                  👥
                </div>
                <div className={styles["kpi-content"]}>
                  <div className={styles["kpi-value"]}>{kpis.totalInvestors}</div>
                  <div className={styles["kpi-label"]}>Investitori Totali</div>
                  <div className={styles["kpi-sub"]}>Riconciliati</div>
                </div>
              </div>

              {/* Active LOIs */}
              <div className={styles["kpi-card"]}>
                <div className={`${styles["kpi-icon"]} ${styles["kpi-icon-active"]}`}>
                  📄
                </div>
                <div className={styles["kpi-content"]}>
                  <div className={styles["kpi-value"]}>{kpis.activeLois}</div>
                  <div className={styles["kpi-label"]}>LOI Attive</div>
                  <div className={styles["kpi-sub"]}>Draft/Sent</div>
                </div>
              </div>

              {/* Committed LOIs */}
              <div className={styles["kpi-card"]}>
                <div className={`${styles["kpi-icon"]} ${styles["kpi-icon-committed"]}`}>
                  ✅
                </div>
                <div className={styles["kpi-content"]}>
                  <div className={styles["kpi-value"]}>{kpis.committedLois}</div>
                  <div className={styles["kpi-label"]}>LOI Committed</div>
                  <div className={styles["kpi-sub"]}>Firmate</div>
                </div>
              </div>

              {/* Capital */}
              <div className={styles["kpi-card"]}>
                <div className={`${styles["kpi-icon"]} ${styles["kpi-icon-capital"]}`}>
                  💰
                </div>
                <div className={styles["kpi-content"]}>
                  <div className={styles["kpi-value"]}>{formatCurrency(kpis.pipelineCapital)}</div>
                  <div className={styles["kpi-label"]}>Pipeline Capital</div>
                  <div className={styles["kpi-sub"]}>
                    Committed: {formatCurrency(kpis.committedCapital)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles["kpi-empty"]}>
              Seleziona una company per visualizzare le KPI
            </div>
          )}
        </section>
      )}

          {/* Error Message */}
          {error && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Barra filtri / azioni */}
          <div className={styles["filters-bar"]}>
            <div className={styles["filters-left"]}>
              <input
                type="text"
                className={styles["search-input"]}
                placeholder="Cerca per nome, email, telefono, LinkedIn..."
                aria-label="Cerca investitori per nome, email, telefono, LinkedIn"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className={styles["filter-select"]}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtra per categoria"
              >
                <option value="">Tutte le categorie</option>
                <option value="angel">Angel</option>
                <option value="vc">VC</option>
                <option value="institutional">Istituzionali</option>
                <option value="individual">Individual</option>
              </select>
              <select
                className={styles["filter-select"]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name-asc" | "name-desc" | "loi-desc")}
                aria-label="Ordina per"
              >
                <option value="name-asc">Nome A → Z</option>
                <option value="name-desc">Nome Z → A</option>
                <option value="loi-desc">Più LOI</option>
              </select>
              <button
                type="button"
                className={styles["filter-toggle-button"]}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Nascondi filtri" : "Filtri avanzati"}
              </button>
            </div>

            <div className={styles["filters-right"]}>
              {companyId && (
                <button
                  type="button"
                  className={styles["import-button"]}
                  onClick={() => {
                    setShowInviteForm((prev) => !prev);
                    setInviteLink(null);
                  }}
                >
                  <UserPlus size={16} />
                  Invita
                </button>
              )}
              <Link
                href="/investors/import"
                className={styles["import-button"]}
              >
                <Upload size={16} />
                Importa CSV
              </Link>
              <Link
                href="/investors/reconcile"
                className={styles["import-button"]}
              >
                <Link2 size={16} />
                Riconcilia
              </Link>
              <button
                type="button"
                className={styles["form-primary-button"]}
                onClick={() => setShowForm((prev) => !prev)}
              >
                {showForm ? "Chiudi form" : "+ Nuovo investitore"}
              </button>
            </div>
          </div>

          {/* Invita form */}
          {showInviteForm && companyId && (
            <section className={styles["form-card"]}>
              <h2 className={styles["form-title"]}>Invita investitore</h2>
              <p className={styles["form-subtitle"]}>
                Inserisci l&apos;email per inviare il link di registrazione al portal.
              </p>
              <form onSubmit={handleInvite}>
                <div className={styles["form-grid"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="invite_email">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="invite_email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="email@example.com"
                      className={styles["form-input"]}
                      disabled={inviteLoading}
                    />
                  </div>
                </div>
                {inviteLink && (
                  <div className={styles["invite-link-box"]}>
                    <p className={styles["invite-link-label"]}>Link invito (valido 7 giorni):</p>
                    <div className={styles["invite-link-row"]}>
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== "undefined" ? `${window.location.origin}${inviteLink}` : inviteLink}
                        className={styles["invite-link-input"]}
                        aria-label="Link invito (valido 7 giorni)"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        className={styles["form-secondary-button"]}
                        onClick={() => {
                          const url = typeof window !== "undefined" ? `${window.location.origin}${inviteLink}` : inviteLink;
                          navigator.clipboard?.writeText(url);
                        }}
                      >
                        Copia
                      </button>
                    </div>
                  </div>
                )}
                <div className={styles["form-actions"]}>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className={styles["form-primary-button"]}
                  >
                    {inviteLoading ? "Invio in corso..." : "Genera link invito"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Filtri avanzati */}
          {showFilters && (
            <div className={styles["advanced-filters"]}>
              <div className={styles["filters-grid"]}>
                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="investor-type-filter">Tipo Investitore</label>
                  <select
                    id="investor-type-filter"
                    className={styles["filter-select"]}
                    value={investorTypeFilter}
                    onChange={(e) => setInvestorTypeFilter(e.target.value)}
                    aria-label="Tipo investitore"
                  >
                    <option value="">Tutti i tipi</option>
                    <option value="customer">Customer</option>
                    <option value="exit">Exit</option>
                    <option value="business_development">Business Development</option>
                    <option value="influencer">Influencer</option>
                    <option value="professionals">Professionals</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="source-filter">Segnalatore</label>
                  <select
                    id="source-filter"
                    className={styles["filter-select"]}
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    aria-label="Segnalatore"
                  >
                    <option value="">Tutti i segnalatori</option>
                    {uniqueSources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="client-name-filter">Company</label>
                  <select
                    id="client-name-filter"
                    className={styles["filter-select"]}
                    value={clientNameFilter}
                    onChange={(e) => setClientNameFilter(e.target.value)}
                    aria-label="Company"
                  >
                    <option value="">Tutte le company</option>
                    {uniqueClientNames.map((client) => (
                      <option key={client} value={client}>
                        {client}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="linkedin-filter">LinkedIn</label>
                  <select
                    id="linkedin-filter"
                    className={styles["filter-select"]}
                    value={hasLinkedinFilter}
                    onChange={(e) => setHasLinkedinFilter(e.target.value as "all" | "yes" | "no")}
                    aria-label="Filtra per presenza LinkedIn"
                  >
                    <option value="all">Tutti</option>
                    <option value="yes">Con LinkedIn</option>
                    <option value="no">Senza LinkedIn</option>
                  </select>
                </div>

                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="email-filter">Email</label>
                  <select
                    id="email-filter"
                    className={styles["filter-select"]}
                    value={hasEmailFilter}
                    onChange={(e) => setHasEmailFilter(e.target.value as "all" | "yes" | "no")}
                    aria-label="Filtra per presenza email"
                  >
                    <option value="all">Tutti</option>
                    <option value="yes">Con Email</option>
                    <option value="no">Senza Email</option>
                  </select>
                </div>

                <div className={styles["filter-group"]}>
                  <label className={styles["filter-label"]} htmlFor="phone-filter">Telefono</label>
                  <select
                    id="phone-filter"
                    className={styles["filter-select"]}
                    value={hasPhoneFilter}
                    onChange={(e) => setHasPhoneFilter(e.target.value as "all" | "yes" | "no")}
                    aria-label="Filtra per presenza telefono"
                  >
                    <option value="all">Tutti</option>
                    <option value="yes">Con Telefono</option>
                    <option value="no">Senza Telefono</option>
                  </select>
                </div>
              </div>

              <div className={styles["filters-actions"]}>
                <button
                  type="button"
                  className={styles["filter-reset-button"]}
                  onClick={() => {
                    setInvestorTypeFilter("");
                    setSourceFilter("");
                    setClientNameFilter("");
                    setHasLinkedinFilter("all");
                    setHasEmailFilter("all");
                    setHasPhoneFilter("all");
                  }}
                >
                  Reset filtri
                </button>
              </div>
            </div>
          )}

          {/* New Investor Form */}
          {showForm && (
            <section className={styles["form-card"]}>
              <h2 className={styles["form-title"]}>Nuovo investitore</h2>
              <p className={styles["form-subtitle"]}>
                Compila i dati principali per aggiungere un nuovo contatto investitore in FundOps.
              </p>

              <form onSubmit={handleSubmit}>
                <div className={styles["form-grid"]}>
                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="full_name">
                      Nome e cognome <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      required
                      className={styles["form-input"]}
                      placeholder="Nome completo"
                    />
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="email">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      className={styles["form-input"]}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="phone">
                      Telefono
                    </label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className={styles["form-input"]}
                      placeholder="+39 333 1234567"
                    />
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="category">
                      Categoria
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className={styles["form-select"]}
                    >
                      <option value="">Seleziona</option>
                      <option value="angel">Angel</option>
                      <option value="vc">VC</option>
                      <option value="institutional">Istituzionale</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>

                  <div className={styles["form-field"]}>
                    <label className={styles["form-label"]} htmlFor="type">
                      Tipo
                    </label>
                    <input
                      type="text"
                      id="type"
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className={styles["form-input"]}
                      placeholder="es. smart, strategic, etc."
                    />
                  </div>
                </div>

                <div className={styles["form-field-full"]}>
                  <label className={styles["form-label"]} htmlFor="notes">
                    Note
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    className={styles["form-textarea"]}
                    placeholder="Note aggiuntive sull'investitore"
                  />
                </div>

                <div className={styles["form-actions"]}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={styles["form-primary-button"]}
                  >
                    {submitting ? "Salvataggio..." : "Salva investitore"}
                  </button>
                </div>
              </form>
            </section>
          )}

        {/* Lista investitori */}
        <div className={styles["investors-list"]}>
          {loading ? (
            <p className={styles["investor-meta"]}>Caricamento investitori...</p>
          ) : sortedInvestors.length === 0 ? (
            <p className={styles["investor-meta"]}>
              Nessun investitore trovato con questi filtri.
            </p>
          ) : (
            sortedInvestors.map((inv) => {
              const loiCount = loiCountByInvestorId[inv.id] ?? 0;
              return (
                <div key={inv.id} className={styles["investor-card"]}>
                  <div className={styles["investor-main"]}>
                    <div className={styles["investor-name"]}>{inv.full_name}</div>
                    <div className={styles["investor-email"]}>{inv.email}</div>
                    <div className={styles["investor-meta"]}>
                      {inv.category && <>Categoria: {inv.category}</>}
                    </div>
                    {(inv.type || inv.category) && (
                      <div className={styles["tag-row"]}>
                        {inv.type && (
                          <span className={styles["tag-pill"]}>{inv.type}</span>
                        )}
                        {inv.category && !inv.type && (
                          <span className={styles["tag-pill"]}>{inv.category}</span>
                        )}
                      </div>
                    )}
                    {/* Match type badge e matched_at */}
                    {(inv.client_company_match_type || inv.client_company_matched_at) && (
                      <div className={styles["reconciliation-info"]}>
                        {inv.client_company_match_type && (
                          <span className={`${styles["match-badge"]} ${styles[`match-badge-${inv.client_company_match_type}`]}`}>
                            {inv.client_company_match_type === "exact" && "Esatto"}
                            {inv.client_company_match_type === "normalized" && "Normalizzato"}
                            {inv.client_company_match_type === "manual" && "Manuale"}
                          </span>
                        )}
                        {inv.client_company_matched_at && (
                          <span className={styles["matched-date"]}>
                            Riconciliato: {formatDate(inv.client_company_matched_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles["investor-right"]}>
                    <span className={styles["badge"]}>
                      {loiCount > 0 ? `${loiCount} LOI` : "Nessuna LOI"}
                    </span>
                    <div className={styles["investor-actions"]}>
                      <Link
                        href={`/investors/${inv.id}`}
                        className={styles["small-button-link"]}
                      >
                        Dettagli
                      </Link>
                      <button className={styles["small-button"]}>Nuova LOI</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </>
  );
}

