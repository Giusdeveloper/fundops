"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import { useToast } from "@/components/ToastProvider";
import { ArrowLeft, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import styles from "./reconcile.module.css";

interface Company {
  id: string;
  name: string;
}

interface ReconcileResult {
  investor_id: string;
  investor_name: string;
  client_name: string;
  status: "already_set" | "matched" | "not_found" | "ambiguous";
  match_type?: "exact" | "normalized" | "manual";
  matched_company_id?: string;
  matched_company_name?: string;
  candidates?: Company[];
}

interface PreviewResponse {
  total: number;
  already_set: number;
  matched: number;
  not_found: number;
  ambiguous: number;
  results: ReconcileResult[];
}

type StatusFilter = "all" | "matched" | "not_found" | "ambiguous" | "already_set";

export default function ReconcileInvestorsPage() {
  const { activeCompanyId: companyId, isLoading: isLoadingCompany } = useCompany();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);
  const [applyProgress, setApplyProgress] = useState({ current: 0, total: 0 });
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [manualSelections, setManualSelections] = useState<Map<string, string>>(new Map());
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);

  // Carica tutte le companies per dropdown
  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch("/api/fundops_companies");
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle companies");
      }
      const result = await response.json();
      setAllCompanies(result.data || []);
    } catch (error: unknown) {
      console.error("Error loading companies:", error);
    }
  }, []);

  // Carica preview
  const loadPreview = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/fundops_investors_reconcile/preview?companyId=${companyId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel caricamento preview");
      }
      const data: PreviewResponse = await response.json();
      setPreview(data);
      // Reset manual selections quando ricarichi
      setManualSelections(new Map());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore nel caricamento preview";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (!isLoadingCompany && companyId) {
      loadPreview();
    }
  }, [isLoadingCompany, companyId, loadPreview]);

  // Applica aggiornamenti
  const handleApply = useCallback(async () => {
    if (!preview || !companyId) return;

    // Costruisci array di updates
    const updates: Array<{ investor_id: string; company_id: string; match_type: "manual" | "exact" | "normalized" }> = [];

    preview.results.forEach((result) => {
      // Se ha selezione manuale, usa quella
      if (manualSelections.has(result.investor_id)) {
        const companyId = manualSelections.get(result.investor_id)!;
        updates.push({
          investor_id: result.investor_id,
          company_id: companyId,
          match_type: "manual",
        });
      }
      // Altrimenti, se è matched (e non è already_set), usa il match proposto
      else if (result.status === "matched" && result.matched_company_id) {
        updates.push({
          investor_id: result.investor_id,
          company_id: result.matched_company_id,
          match_type: result.match_type || "exact",
        });
      }
    });

    if (updates.length === 0) {
      showToast("Nessun aggiornamento da applicare", "warning");
      return;
    }

    setApplying(true);
    setApplyProgress({ current: 0, total: updates.length });

    try {
      // Processa in batch per mostrare il progresso
      const BATCH_SIZE = 50; // Processa 50 aggiornamenti alla volta
      const batches: typeof updates[] = [];
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        batches.push(updates.slice(i, i + BATCH_SIZE));
      }

      let totalUpdated = 0;
      let totalSkipped = 0;
      const errors: Array<{ investor_id: string; reason: string }> = [];

      // Processa ogni batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const response = await fetch("/api/fundops_investors_reconcile/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            updates: batch,
            force: false,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Errore nell'applicazione degli aggiornamenti");
        }

        const result = await response.json();
        totalUpdated += result.updated || 0;
        totalSkipped += result.skipped || 0;
        if (result.errors) {
          errors.push(...result.errors);
        }

        // Aggiorna progresso
        const processed = Math.min((batchIndex + 1) * BATCH_SIZE, updates.length);
        setApplyProgress({ current: processed, total: updates.length });
        
        // Piccola pausa per permettere al UI di aggiornarsi
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      showToast(`Aggiornati ${totalUpdated} investitori${totalSkipped > 0 ? `, ${totalSkipped} saltati` : ""}`, "success");
      
      // Ricarica preview
      await loadPreview();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore nell'applicazione degli aggiornamenti";
      showToast(message, "error");
    } finally {
      setApplying(false);
      setApplyProgress({ current: 0, total: 0 });
    }
  }, [preview, manualSelections, companyId, showToast, loadPreview]);

  // Filtra risultati
  const filteredResults = preview?.results.filter((result) => {
    if (statusFilter === "all") return true;
    return result.status === statusFilter;
  }) || [];

  // Conta pending updates
  const pendingUpdates = preview?.results.filter((result) => {
    // Skip already_set
    if (result.status === "already_set") return false;
    // Manual selection
    if (manualSelections.has(result.investor_id)) return true;
    // Matched con company proposta
    if (result.status === "matched" && result.matched_company_id) return true;
    return false;
  }).length || 0;

  if (isLoadingCompany) {
    return <RequireCompany />;
  }

  return (
    <RequireCompany>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/investors" className={styles.backButton}>
            <ArrowLeft size={16} />
            Torna agli Investitori
          </Link>
          <h1 className={styles.title}>Riconciliazione Investitori</h1>
        </div>

        {loading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : preview ? (
          <>
            {/* Contatori */}
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{preview.total}</div>
                <div className={styles.statLabel}>Totale</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{preview.already_set}</div>
                <div className={styles.statLabel}>Già Impostati</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.statValueSuccess}`}>{preview.matched}</div>
                <div className={styles.statLabel}>Trovati</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.statValueWarning}`}>{preview.not_found}</div>
                <div className={styles.statLabel}>Non Trovati</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.statValueDanger}`}>{preview.ambiguous}</div>
                <div className={styles.statLabel}>Ambigui</div>
              </div>
            </div>

            {/* Filtri */}
            <div className={styles.filters}>
              <button
                onClick={() => setStatusFilter("all")}
                className={`${styles.filterButton} ${statusFilter === "all" ? styles.filterButtonActive : ""}`}
              >
                Tutti ({preview.total})
              </button>
              <button
                onClick={() => setStatusFilter("matched")}
                className={`${styles.filterButton} ${statusFilter === "matched" ? styles.filterButtonActive : ""}`}
              >
                Trovati ({preview.matched})
              </button>
              <button
                onClick={() => setStatusFilter("not_found")}
                className={`${styles.filterButton} ${statusFilter === "not_found" ? styles.filterButtonActive : ""}`}
              >
                Non Trovati ({preview.not_found})
              </button>
              <button
                onClick={() => setStatusFilter("ambiguous")}
                className={`${styles.filterButton} ${statusFilter === "ambiguous" ? styles.filterButtonActive : ""}`}
              >
                Ambigui ({preview.ambiguous})
              </button>
              <button
                onClick={() => setStatusFilter("already_set")}
                className={`${styles.filterButton} ${statusFilter === "already_set" ? styles.filterButtonActive : ""}`}
              >
                Già Impostati ({preview.already_set})
              </button>
            </div>

            {/* Tabella */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Investitore</th>
                    <th>Cliente (raw)</th>
                    <th>Stato</th>
                    <th>Tipo Match</th>
                    <th>Company Proposta</th>
                    <th>Selezione Manuale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyCell}>
                        Nessun risultato trovato
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((result) => (
                      <tr key={result.investor_id}>
                        <td className={styles.investorName}>{result.investor_name}</td>
                        <td className={styles.clientName}>{result.client_name}</td>
                        <td>
                          {result.status === "already_set" && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                              <CheckCircle2 size={12} /> Già Impostato
                            </span>
                          )}
                          {result.status === "matched" && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                              <CheckCircle2 size={12} /> Trovato
                            </span>
                          )}
                          {result.status === "not_found" && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <AlertCircle size={12} /> Non Trovato
                            </span>
                          )}
                          {result.status === "ambiguous" && (
                            <span className={`${styles.badge} ${styles.badgeDanger}`}>
                              <HelpCircle size={12} /> Ambiguo
                            </span>
                          )}
                        </td>
                        <td>
                          {result.match_type && (
                            <span className={styles.matchTypeBadge}>
                              {result.match_type === "exact" && "Esatto"}
                              {result.match_type === "normalized" && "Normalizzato"}
                              {result.match_type === "manual" && "Manuale"}
                            </span>
                          )}
                        </td>
                        <td>
                          {result.matched_company_name ? (
                            <span className={styles.companyName}>{result.matched_company_name}</span>
                          ) : result.candidates && result.candidates.length > 0 ? (
                            <span className={styles.candidatesCount}>
                              {result.candidates.length} candidati
                            </span>
                          ) : (
                            <span className={styles.missing}>—</span>
                          )}
                        </td>
                        <td>
                          {(result.status === "not_found" || result.status === "ambiguous") && (
                            <select
                              value={manualSelections.get(result.investor_id) || ""}
                              onChange={(e) => {
                                const newSelections = new Map(manualSelections);
                                if (e.target.value) {
                                  newSelections.set(result.investor_id, e.target.value);
                                } else {
                                  newSelections.delete(result.investor_id);
                                }
                                setManualSelections(newSelections);
                              }}
                              className={styles.select}
                            >
                              <option value="">— Seleziona —</option>
                              {result.candidates && result.candidates.length > 0 ? (
                                result.candidates.map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name}
                                  </option>
                                ))
                              ) : (
                                allCompanies.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                          {result.status === "matched" && (
                            <span className={styles.autoMatch}>Auto-match disponibile</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Progress Bar durante applicazione */}
            {applying && applyProgress.total > 0 && (
              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>
                    Applicazione aggiornamenti in corso...
                  </span>
                  <span className={styles.progressPercentage}>
                    {Math.round((applyProgress.current / applyProgress.total) * 100)}%
                  </span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${(applyProgress.current / applyProgress.total) * 100}%` }}
                  />
                </div>
                <div className={styles.progressDetails}>
                  {applyProgress.current} di {applyProgress.total} aggiornamenti applicati
                </div>
              </div>
            )}

            {/* Azioni */}
            <div className={styles.actions}>
              <button
                onClick={handleApply}
                disabled={pendingUpdates === 0 || applying}
                className={`${styles.applyButton} ${pendingUpdates === 0 ? styles.applyButtonDisabled : ""}`}
              >
                {applying ? "Applicazione in corso..." : `Applica ${pendingUpdates} Aggiornamenti`}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.error}>Errore nel caricamento dei dati</div>
        )}
      </div>
    </RequireCompany>
  );
}
