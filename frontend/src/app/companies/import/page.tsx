"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import Papa from "papaparse";
import { Upload, FileText, ArrowRight, AlertCircle, X, CheckCircle, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import CsvPreviewTable from "@/components/investors/CsvPreviewTable";
import styles from "./import.module.css";

interface CsvRow {
  [key: string]: string;
}

interface FieldMapping {
  name: string; // Required: Ragione Sociale / Società
  legal_name?: string; // Opzionale: se diverso da name
  vat_number?: string;
  email?: string;
  pec?: string;
  settore?: string;
  website?: string;
  profilo_linkedin?: string;
  notes?: string;
}

interface NormalizedRow {
  name: string; // Required
  legal_name?: string; // Opzionale: se diverso da name
  vat_number?: string;
  email?: string;
  pec?: string;
  settore?: string;
  website?: string;
  profilo_linkedin?: string;
  notes?: string;
  _originalIndex: number;
  _status: "ok" | "warning" | "error" | "skip";
  _messages: string[];
}

type Step = 1 | 2 | 3 | 4;

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: Array<{ index: number; reason: string }>;
  errors: Array<{ index: number; reason: string }>;
  results?: Array<{
    index: number;
    action: 'inserted' | 'updated' | 'skipped';
    match_strategy?: string;
    company_id?: string;
    warnings?: string[];
    errors?: string[];
  }>;
  details?: Array<{
    company_name: string;
    vat_number?: string;
    email?: string;
    action: 'inserted' | 'updated' | 'skipped';
    match_strategy?: string;
    warnings?: string[];
    errors?: string[];
  }>;
}

export default function ImportCompaniesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({} as FieldMapping);
  const [normalizedRows, setNormalizedRows] = useState<NormalizedRow[]>([]);
  const [readyRows, setReadyRows] = useState<NormalizedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<NormalizedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "warnings" | "ok">("all");

  // Formatta dimensione file
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Auto-detect mapping per formato specifico
  const autoDetectMapping = useCallback((headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {} as FieldMapping;
    
    headers.forEach((header) => {
      const normalized = header.toLowerCase().trim();
      
      // name ← "Ragione Sociale" o "Società" (required)
      if (normalized === 'ragione sociale' || normalized === 'ragione_sociale' || 
          normalized === 'società' || normalized === 'societa' || 
          normalized === 'company' || normalized === 'azienda' ||
          normalized.includes('ragione') || normalized.includes('società')) {
        if (!mapping.name) mapping.name = header;
      }
      
      // legal_name ← solo se colonna esplicita diversa da name (opzionale)
      if ((normalized === 'legal_name' || normalized === 'ragione sociale legale') && !mapping.name) {
        mapping.legal_name = header;
      }
      
      // email ← "Email"
      if (normalized === 'email' || normalized === 'e-mail' || normalized === 'mail') {
        mapping.email = header;
      }
      
      // vat_number ← "Partita Iva"
      if (normalized === 'partita iva' || normalized === 'partita_iva' || normalized === 'piva' || normalized === 'p.iva' || normalized.includes('partita')) {
        mapping.vat_number = header;
      }
      
      // pec ← "PEC"
      if (normalized === 'pec') {
        mapping.pec = header;
      }
      
      // settore ← "Settore"
      if (normalized === 'settore' || normalized === 'sector') {
        mapping.settore = header;
      }
      
      // website ← "Website"
      if (normalized === 'website' || normalized === 'sito' || normalized === 'sito web') {
        mapping.website = header;
      }
      
      // profilo_linkedin ← "Profilo Linkedin"
      if (normalized === 'profilo linkedin' || normalized === 'profilo_linkedin' || normalized === 'linkedin' || normalized.includes('linkedin')) {
        mapping.profilo_linkedin = header;
      }
      
      // notes ← "Note" e "Codice SDI"
      if (normalized === 'note' || normalized === 'notes' || normalized === 'codice sdi' || normalized === 'codice_sdi') {
        mapping.notes = header;
      }
    });
    
    return mapping;
  }, []);

  // Parsing CSV
  const parseCsvFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        showToast("Seleziona un file CSV", "error");
        return;
      }

      setParsing(true);
      setParseError(null);
      setCsvFile(file);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";", // Delimiter fisso per questo formato
        transformHeader: (header: string) => {
          // Rimuovi BOM e mantieni il nome originale per il mapping esplicito
          return header.replace(/^\uFEFF/, "").trim();
        },
        transform: (value: string) => {
          return value.trim();
        },
        complete: (results) => {
          setParsing(false);

          if (results.errors.length > 0) {
            const errorMessages = results.errors
              .map((e) => `Riga ${e.row}: ${e.message}`)
              .join(", ");
            const errorMsg = `Errori nel parsing: ${errorMessages}`;
            setParseError(errorMsg);
            showToast(errorMsg, "error");
            console.warn("CSV parsing errors:", results.errors);
          }

          if (results.data && results.data.length > 0) {
            const headers = Object.keys(results.data[0] as CsvRow);
            const rows = results.data as CsvRow[];

            setCsvHeaders(headers);
            setCsvRows(rows);
            
            // Auto-detect mapping
            const autoMapping = autoDetectMapping(headers);
            setFieldMapping(autoMapping);
            
            showToast(`CSV caricato: ${rows.length} righe trovate`, "success");
            setStep(2); // Vai allo step 2 (mapping)
          } else {
            setParseError("Il CSV è vuoto o non contiene dati validi");
            showToast("Il CSV è vuoto", "error");
          }
        },
        error: (error) => {
          setParsing(false);
          const errorMsg = `Errore nel parsing CSV: ${error.message}`;
          setParseError(errorMsg);
          showToast(errorMsg, "error");
        },
      });
    },
    [showToast, autoDetectMapping]
  );

  // Gestione file select
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        parseCsvFile(file);
      }
    },
    [parseCsvFile]
  );

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        parseCsvFile(file);
      }
    },
    [parseCsvFile]
  );

  // Reset
  const handleReset = useCallback(() => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setParseError(null);
    setFieldMapping({} as FieldMapping);
    setNormalizedRows([]);
    setReadyRows([]);
    setSkippedRows([]);
    setImportResult(null);
    setStep(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Normalizza VAT number
  const normalizeVatNumber = useCallback((vat?: string): string | undefined => {
    if (!vat || !vat.trim()) return undefined;
    
    // Rimuovi spazi e caratteri speciali, mantieni solo numeri e lettere
    let normalized = vat.trim().replace(/[\s\-\.]/g, '');
    
    // Se inizia con "IT" o "it", mantieni uppercase
    if (normalized.toLowerCase().startsWith('it')) {
      normalized = 'IT' + normalized.substring(2);
    }
    
    return normalized || undefined;
  }, []);

  // Valida VAT number (deve essere esattamente 11 cifre dopo normalizzazione)
  const isValidVatNumber = useCallback((vat?: string | null): boolean => {
    if (!vat) return false;
    return vat.length === 11 && /^\d+$/.test(vat);
  }, []);

  // Valida email
  const isValidEmail = useCallback((email?: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, []);

  // Normalizza e valida righe
  const normalizeAndValidate = useCallback((rows: CsvRow[], mapping: FieldMapping): NormalizedRow[] => {
    return rows.map((row, index) => {
      const normalized: NormalizedRow = {
        name: '',
        _originalIndex: index,
        _status: 'ok',
        _messages: [],
      };

      // name (required) ← "Ragione Sociale" / "Società"
      if (mapping.name && row[mapping.name]) {
        const nameValue = row[mapping.name].trim();
        // Collapse spaces
        normalized.name = nameValue.replace(/\s+/g, ' ');
      }

      // legal_name (opzionale) ← solo se colonna esplicita diversa
      // Altrimenti duplica da name se non presente
      if (mapping.legal_name && row[mapping.legal_name]) {
        normalized.legal_name = row[mapping.legal_name].trim().replace(/\s+/g, ' ');
      } else if (normalized.name) {
        // Duplica name in legal_name se non abbiamo una colonna dedicata
        normalized.legal_name = normalized.name;
      }

      // vat_number (normalizzato) ← "Partita Iva"
      if (mapping.vat_number && row[mapping.vat_number]) {
        normalized.vat_number = normalizeVatNumber(row[mapping.vat_number]);
      }

      // email ← "Email"
      if (mapping.email && row[mapping.email]) {
        const emailValue = row[mapping.email].trim().toLowerCase();
        if (emailValue) {
          normalized.email = emailValue;
        }
      }

      // pec ← "PEC"
      if (mapping.pec && row[mapping.pec]) {
        const pecValue = row[mapping.pec].trim().toLowerCase();
        if (pecValue) {
          normalized.pec = pecValue;
        }
      }

      // settore ← "Settore"
      if (mapping.settore && row[mapping.settore]) {
        normalized.settore = row[mapping.settore].trim();
      }

      // website ← "Website"
      if (mapping.website && row[mapping.website]) {
        normalized.website = row[mapping.website].trim();
      }

      // profilo_linkedin ← "Profilo Linkedin"
      if (mapping.profilo_linkedin && row[mapping.profilo_linkedin]) {
        normalized.profilo_linkedin = row[mapping.profilo_linkedin].trim();
      }

      // notes ← concat di Note e Codice SDI (solo testo extra, non i campi strutturati)
      const notesParts: string[] = [];
      
      // Note
      if (mapping.notes && row[mapping.notes]) {
        notesParts.push(`Note: ${row[mapping.notes].trim()}`);
      }
      
      // Codice SDI (cerca colonna esplicita)
      if (row['Codice SDI'] && row['Codice SDI'].trim()) {
        notesParts.push(`Codice SDI: ${row['Codice SDI'].trim()}`);
      }
      
      // NOTA: Website, LinkedIn, Settore sono campi separati, NON in notes
      // (già gestiti sopra come settore, website, profilo_linkedin)
      
      if (notesParts.length > 0) {
        normalized.notes = notesParts.join('\n');
      }

      // Validazioni
      // ERROR: name mancante
      if (!normalized.name || normalized.name.length === 0) {
        normalized._status = 'error';
        normalized._messages.push('missing_name');
      }

      // WARNING: VAT number non conforme (deve essere 11 cifre)
      if (normalized.vat_number && !isValidVatNumber(normalized.vat_number)) {
        normalized._messages.push('invalid_vat');
        normalized.vat_number = undefined; // Imposta a undefined se non valido
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // WARNING: email non valida
      if (normalized.email && !isValidEmail(normalized.email)) {
        normalized._messages.push('Email forse invalida');
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // SKIP: riga completamente vuota
      if (!normalized.name && !normalized.vat_number && !normalized.email) {
        normalized._status = 'skip';
        normalized._messages.push('Riga completamente vuota');
      }

      return normalized;
    });
  }, [normalizeVatNumber, isValidVatNumber, isValidEmail]);

  // Normalizza nome per deduplica (rimuovi punteggiatura, suffissi aziendali, etc.)
  const normalizeNameForDedupe = useCallback((name: string): string => {
    if (!name) return '';
    
    let normalized = name.toLowerCase().trim();
    
    // Rimuovi punteggiatura: . , ; : - _ /
    normalized = normalized.replace(/[.,;:\-_\/]/g, '');
    
    // Collapse spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Rimuovi suffissi aziendali italiani
    const suffixes = ['srl', 's.r.l', 'srls', 'spa', 's.p.a', 'snc', 'sas'];
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'i');
      normalized = normalized.replace(regex, '').trim();
    }
    
    return normalized.trim();
  }, []);

  // Deduplica CSV con priorità: vat_number → name normalized
  const deduplicateRows = useCallback((rows: NormalizedRow[]): { ready: NormalizedRow[]; skipped: NormalizedRow[] } => {
    const ready: NormalizedRow[] = [];
    const skipped: NormalizedRow[] = [];
    const seenVat = new Map<string, number>();
    const seenName = new Map<string, number>();

    rows.forEach((row) => {
      // Skip se già marcato come skip o error
      if (row._status === 'skip' || row._status === 'error') {
        skipped.push({ ...row, _messages: [...row._messages, 'Riga scartata per validazione'] });
        return;
      }

      let duplicateReadyIndex: number | null = null;
      let matchType = '';

      // 1. vat_number (se valido)
      if (row.vat_number && isValidVatNumber(row.vat_number)) {
        const key = `vat:${row.vat_number}`;
        if (seenVat.has(key)) {
          duplicateReadyIndex = seenVat.get(key)!;
          matchType = 'vat_number';
        } else {
          seenVat.set(key, ready.length);
        }
      }

      // 2. name normalized
      if (duplicateReadyIndex === null && row.name && row.name.trim()) {
        const normalizedName = normalizeNameForDedupe(row.name);
        if (normalizedName) {
          const key = `name:${normalizedName}`;
          if (seenName.has(key)) {
            duplicateReadyIndex = seenName.get(key)!;
            matchType = 'name_normalized';
          } else {
            seenName.set(key, ready.length);
          }
        }
      }

      if (duplicateReadyIndex !== null) {
        // Duplicato trovato: tieni la prima (keep first)
        skipped.push({ ...row, _messages: [...row._messages, `duplicate_in_file (match: ${matchType})`] });
      } else {
        ready.push(row);
      }
    });

    return { ready, skipped };
  }, [isValidVatNumber, normalizeNameForDedupe]);

  // Applica mapping e normalizzazione
  const applyMapping = useCallback(() => {
    const normalized = normalizeAndValidate(csvRows, fieldMapping);
    const { ready, skipped } = deduplicateRows(normalized);
    
    setNormalizedRows(normalized);
    setReadyRows(ready);
    setSkippedRows(skipped);
  }, [csvRows, fieldMapping, normalizeAndValidate, deduplicateRows]);

  // Calcola statistiche
  const stats = useMemo(() => {
    const ok = normalizedRows.filter(r => r._status === 'ok').length;
    const warning = normalizedRows.filter(r => r._status === 'warning').length;
    const error = normalizedRows.filter(r => r._status === 'error').length;
    const skip = normalizedRows.filter(r => r._status === 'skip').length + skippedRows.length;
    
    return { ok, warning, error, skip, total: normalizedRows.length };
  }, [normalizedRows, skippedRows]);

  // Applica mapping quando cambia fieldMapping o csvRows
  useMemo(() => {
    if (step === 2 && csvRows.length > 0 && Object.keys(fieldMapping).length > 0) {
      applyMapping();
    }
  }, [step, csvRows, fieldMapping, applyMapping]);

  const hasData = csvRows.length > 0 && csvHeaders.length > 0;
  const canProceed = stats.error === 0 && (stats.ok + stats.warning) > 0;

  // Handle Import
  const handleImport = useCallback(async () => {
    if (readyRows.length === 0) {
      showToast("Errore: nessuna riga pronta per l'import", "error");
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: readyRows.length });

    try {
      // Prepara dati per API (rimuovi metadati)
      const rowsToImport = readyRows.map((row) => ({
        name: row.name,
        legal_name: row.legal_name, // Opzionale, può essere duplicato da name
        vat_number: row.vat_number,
        email: row.email,
        pec: row.pec,
        settore: row.settore,
        website: row.website,
        profilo_linkedin: row.profilo_linkedin,
        notes: row.notes,
      }));

      // Processa in batch per mostrare il progresso
      const BATCH_SIZE = 50;
      const batches: typeof rowsToImport[] = [];
      
      for (let i = 0; i < rowsToImport.length; i += BATCH_SIZE) {
        batches.push(rowsToImport.slice(i, i + BATCH_SIZE));
      }

      const finalResult: ImportResult = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        warnings: [],
        errors: [],
        details: [],
      };

      // Processa ogni batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const response = await fetch("/api/fundops_companies_import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rows: batch,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Errore durante l'import");
        }

        const batchResult: ImportResult = await response.json();
        
        // Aggrega risultati
        finalResult.inserted += batchResult.inserted;
        finalResult.updated += batchResult.updated;
        finalResult.skipped += batchResult.skipped;
        finalResult.warnings.push(...batchResult.warnings);
        finalResult.errors.push(...batchResult.errors);
        
        // Aggrega dettagli dai results dell'API (ground truth)
        if (batchResult.results && batchResult.results.length > 0) {
          batchResult.results.forEach((apiResult) => {
            // Trova la riga corrispondente per ottenere i dati della company
            const rowIndex = apiResult.index - 1; // API usa 1-based, array è 0-based
            const row = batch[rowIndex];
            
            if (row) {
              finalResult.details!.push({
                company_name: row.name,
                vat_number: row.vat_number || undefined,
                email: row.email || undefined,
                action: apiResult.action,
                match_strategy: apiResult.match_strategy,
                warnings: apiResult.warnings,
                errors: apiResult.errors,
              });
            }
          });
        } else if (batchResult.details) {
          // Fallback: usa details se results non disponibile
          finalResult.details!.push(...batchResult.details);
        }

        // Aggiorna progresso
        const processed = Math.min((batchIndex + 1) * BATCH_SIZE, readyRows.length);
        setImportProgress({ current: processed, total: readyRows.length });
        
        // Piccola pausa per permettere al UI di aggiornarsi
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setImportResult(finalResult);
      setStep(4); // Vai al report finale

      if (finalResult.inserted + finalResult.updated > 0) {
        showToast(
          `Import completato: ${finalResult.inserted} inserite, ${finalResult.updated} aggiornate`,
          "success"
        );
      } else {
        showToast("Nessuna azienda importata", "warning");
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Errore sconosciuto";
      showToast(`Errore durante l'import: ${errorMsg}`, "error");
      console.error("Import error:", error);
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  }, [readyRows, showToast]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Indietro
        </button>
        <h1 className={styles.title}>Importa aziende da CSV</h1>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        <div className={`${styles.step} ${step >= 1 ? styles.active : ""}`}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepLabel}>Upload</div>
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.step} ${step >= 2 ? styles.active : ""}`}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepLabel}>Mapping & Pulizia</div>
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.step} ${step >= 3 ? styles.active : ""}`}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepLabel}>Import</div>
        </div>
      </div>

      {/* Step 1: Upload CSV */}
      {step === 1 && (
        <>
          <div className={styles.uploadSection}>
            {!csvFile ? (
              <div
                className={`${styles.uploadArea} ${dragActive ? styles.dragActive : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className={styles.uploadLabel}>
                  <Upload size={48} className={styles.uploadIcon} />
                  <span className={styles.uploadText}>
                    Clicca per selezionare un file CSV
                  </span>
                  <span className={styles.uploadHint}>o trascina il file qui</span>
                </label>
              </div>
            ) : (
              <div className={styles.fileSelected}>
                <div className={styles.fileInfo}>
                  <FileText size={24} className={styles.fileIcon} />
                  <div className={styles.fileDetails}>
                    <div className={styles.fileName}>{csvFile.name}</div>
                    <div className={styles.fileSize}>
                      {formatFileSize(csvFile.size)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className={styles.removeButton}
                  title="Rimuovi file"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {parsing && (
              <div className={styles.parsingStatus}>
                <div className={styles.spinner} />
                <span>Analisi CSV in corso...</span>
              </div>
            )}

            {parseError && (
              <div className={styles.errorBox}>
                <AlertCircle size={20} className={styles.errorIcon} />
                <div className={styles.errorContent}>
                  <div className={styles.errorTitle}>Errore nel parsing</div>
                  <div className={styles.errorMessage}>{parseError}</div>
                </div>
              </div>
            )}
          </div>

          {/* Preview Table Step 1 */}
          {hasData && (
            <div className={styles.previewSection}>
              <CsvPreviewTable headers={csvHeaders} rows={csvRows} maxRows={20} />
            </div>
          )}

          {/* Actions Step 1 */}
          {hasData && (
            <div className={styles.actions}>
              <button
                onClick={handleReset}
                className={styles.buttonSecondary}
              >
                Carica altro file
              </button>
              <button
                onClick={() => setStep(2)}
                className={styles.buttonPrimary}
              >
                Prosegui al mapping
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Step 2: Mapping & Pulizia */}
      {step === 2 && hasData && (
        <>
          <div className={styles.mappingSection}>
            <h2 className={styles.sectionTitle}>Mapping Colonne</h2>
            <p className={styles.sectionSubtitle}>
              Associa le colonne del CSV ai campi del database
            </p>

            <div className={styles.mappingGrid}>
              {/* REQUIRED: name */}
              <div className={styles.mappingField}>
                <label className={styles.mappingLabel}>
                  Nome (Ragione Sociale / Società) <span className={styles.required}>*</span>
                </label>
                <select
                  value={fieldMapping.name || ""}
                  onChange={(e) => setFieldMapping({ ...fieldMapping, name: e.target.value })}
                  className={styles.mappingSelect}
                >
                  <option value="">— Seleziona —</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* OPTIONAL fields */}
              {[
                { key: 'vat_number', label: 'Partita IVA' },
                { key: 'email', label: 'Email' },
                { key: 'pec', label: 'PEC' },
                { key: 'settore', label: 'Settore' },
                { key: 'website', label: 'Website' },
                { key: 'profilo_linkedin', label: 'Profilo Linkedin' },
                { key: 'notes', label: 'Note' },
              ].map(({ key, label }) => (
                <div key={key} className={styles.mappingField}>
                  <label className={styles.mappingLabel}>{label}</label>
                  <select
                    value={fieldMapping[key as keyof FieldMapping] || ""}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [key]: e.target.value || undefined })}
                    className={styles.mappingSelect}
                  >
                    <option value="">— Nessuna colonna —</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Statistiche */}
          {normalizedRows.length > 0 && (
            <div className={styles.statsSection}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <CheckCircle size={24} className={styles.statIconOk} />
                  <div className={styles.statValue}>{stats.ok}</div>
                  <div className={styles.statLabel}>OK</div>
                </div>
                <div className={styles.statCard}>
                  <AlertTriangle size={24} className={styles.statIconWarning} />
                  <div className={styles.statValue}>{stats.warning}</div>
                  <div className={styles.statLabel}>Warning</div>
                </div>
                <div className={styles.statCard}>
                  <XCircle size={24} className={styles.statIconError} />
                  <div className={styles.statValue}>{stats.error}</div>
                  <div className={styles.statLabel}>Errori</div>
                </div>
                <div className={styles.statCard}>
                  <X size={24} className={styles.statIconSkip} />
                  <div className={styles.statValue}>{stats.skip}</div>
                  <div className={styles.statLabel}>Scartati</div>
                </div>
              </div>
            </div>
          )}

          {/* Preview con stati */}
          {normalizedRows.length > 0 && (
            <div className={styles.previewSection}>
              <div className={styles.previewHeader}>
                <h3 className={styles.previewTitle}>Preview Validazione</h3>
                <div className={styles.previewFilters}>
                  <button
                    onClick={() => setPreviewFilter("all")}
                    className={`${styles.filterButton} ${previewFilter === "all" ? styles.filterButtonActive : ""}`}
                  >
                    Tutte ({normalizedRows.length})
                  </button>
                  <button
                    onClick={() => setPreviewFilter("errors")}
                    className={`${styles.filterButton} ${previewFilter === "errors" ? styles.filterButtonActive : ""}`}
                  >
                    Errori ({stats.error})
                  </button>
                  <button
                    onClick={() => setPreviewFilter("warnings")}
                    className={`${styles.filterButton} ${previewFilter === "warnings" ? styles.filterButtonActive : ""}`}
                  >
                    Warning ({stats.warning})
                  </button>
                  <button
                    onClick={() => setPreviewFilter("ok")}
                    className={`${styles.filterButton} ${previewFilter === "ok" ? styles.filterButtonActive : ""}`}
                  >
                    OK ({stats.ok})
                  </button>
                </div>
              </div>
              <div className={styles.previewTableWrapper}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Riga CSV</th>
                      <th>Ragione Sociale</th>
                      <th>P.IVA</th>
                      <th>Email</th>
                      <th>Stato</th>
                      <th>Messaggi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows
                      .filter((row) => {
                        if (previewFilter === "all") return true;
                        if (previewFilter === "errors") return row._status === "error";
                        if (previewFilter === "warnings") return row._status === "warning";
                        if (previewFilter === "ok") return row._status === "ok";
                        return true;
                      })
                      .slice(0, 50)
                      .map((row, idx) => (
                        <tr key={idx} className={styles[`row${row._status.charAt(0).toUpperCase() + row._status.slice(1)}`]}>
                          <td className={styles.rowNumber}>{row._originalIndex + 2}</td>
                          <td>
                            {row.name ? (
                              row.name
                            ) : (
                              <span className={styles.missing} title="Nome mancante - verifica il mapping">
                                — Nome mancante
                              </span>
                            )}
                          </td>
                          <td>{row.vat_number || <span className={styles.missing}>—</span>}</td>
                          <td>{row.email || <span className={styles.missing}>—</span>}</td>
                          <td>
                            <span className={styles[`statusBadge${row._status.charAt(0).toUpperCase() + row._status.slice(1)}`]}>
                              {row._status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {row._messages.length > 0 ? (
                              <div className={styles.messages}>
                                {row._messages.map((msg, i) => (
                                  <span 
                                    key={i} 
                                    className={`${styles.messageBadge} ${
                                      row._status === "error" ? styles.messageBadgeError : 
                                      row._status === "warning" ? styles.messageBadgeWarning : 
                                      ""
                                    }`}
                                  >
                                    {msg}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.noMessages}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {normalizedRows.filter((row) => {
                  if (previewFilter === "all") return true;
                  if (previewFilter === "errors") return row._status === "error";
                  if (previewFilter === "warnings") return row._status === "warning";
                  if (previewFilter === "ok") return row._status === "ok";
                  return true;
                }).length === 0 && (
                  <div className={styles.emptyFilter}>
                    Nessuna riga trovata con questo filtro
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions Step 2 */}
          <div className={styles.actions}>
            <button
              onClick={() => setStep(1)}
              className={styles.buttonSecondary}
            >
              <ArrowLeft size={16} />
              Indietro
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              {!fieldMapping.name && (
                <div className={styles.errorBox} style={{ marginBottom: 0 }}>
                  <AlertCircle size={16} className={styles.errorIcon} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage}>
                      Seleziona almeno il mapping per &quot;Nome&quot; per procedere
                    </div>
                  </div>
                </div>
              )}
              {fieldMapping.name && stats.error > 0 && (
                <div className={styles.errorBox} style={{ marginBottom: 0 }}>
                  <AlertCircle size={16} className={styles.errorIcon} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage}>
                      Ci sono {stats.error} errori da correggere prima di procedere
                    </div>
                  </div>
                </div>
              )}
              {fieldMapping.name && stats.error === 0 && (stats.ok + stats.warning) === 0 && (
                <div className={styles.errorBox} style={{ marginBottom: 0 }}>
                  <AlertCircle size={16} className={styles.errorIcon} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage}>
                      Nessuna riga valida trovata. Verifica il mapping delle colonne.
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={!canProceed}
                className={styles.buttonPrimary}
                style={{ alignSelf: 'flex-end' }}
              >
                Continua
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Import */}
      {step === 3 && (
        <>
          <div className={styles.summarySection}>
            <h2 className={styles.sectionTitle}>Riepilogo Import</h2>
            <div className={styles.summaryStats}>
              <div className={styles.summaryStat}>
                <div className={styles.summaryValue}>{readyRows.length}</div>
                  <div className={styles.summaryLabel}>Aziende pronte per l&apos;import</div>
              </div>
              <div className={styles.summaryStat}>
                <div className={styles.summaryValue}>{skippedRows.length}</div>
                <div className={styles.summaryLabel}>Aziende scartate</div>
              </div>
            </div>
            {skippedRows.length > 0 && (
              <div className={styles.skippedDetails}>
                <h3 className={styles.subtitle}>Dettaglio aziende scartate:</h3>
                <ul className={styles.skippedList}>
                  {skippedRows.filter(r => r._status === 'error').length > 0 && (
                    <li>
                      <strong>{skippedRows.filter(r => r._status === 'error').length}</strong> righe con errori (nome mancante)
                    </li>
                  )}
                  {skippedRows.filter(r => r._status === 'skip').length > 0 && (
                    <li>
                      <strong>{skippedRows.filter(r => r._status === 'skip').length}</strong> righe completamente vuote o duplicate
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Progress Bar durante importazione */}
          {importing && importProgress.total > 0 && (
            <div className={styles.progressSection}>
              <div className={styles.progressHeader}>
                <span className={styles.progressLabel}>
                  Importazione in corso...
                </span>
                <span className={styles.progressPercentage}>
                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                </span>
              </div>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBar}
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <div className={styles.progressDetails}>
                <span>
                  {importProgress.current} di {importProgress.total} righe processate
                </span>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              onClick={() => setStep(2)}
              className={styles.buttonSecondary}
              disabled={importing}
            >
              <ArrowLeft size={16} />
              Indietro
            </button>
            <button
              onClick={handleImport}
              disabled={importing || readyRows.length === 0}
              className={styles.buttonPrimary}
            >
              {importing ? (
                <>
                  <div className={styles.spinner} />
                  Importazione in corso...
                </>
              ) : (
                <>
                  Importa
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Step 4: Report Finale */}
      {step === 4 && importResult && (
        <>
          <div className={styles.reportSection}>
            <h2 className={styles.sectionTitle}>Report Import</h2>
            
            <div className={styles.reportStats}>
              <div className={styles.reportStat}>
                <CheckCircle size={32} className={styles.statIconOk} />
                <div className={styles.reportValue}>{importResult.inserted}</div>
                <div className={styles.reportLabel}>Inserite</div>
              </div>
              <div className={styles.reportStat}>
                <CheckCircle size={32} className={styles.statIconOk} />
                <div className={styles.reportValue}>{importResult.updated}</div>
                <div className={styles.reportLabel}>Aggiornate</div>
              </div>
              <div className={styles.reportStat}>
                <X size={32} className={styles.statIconSkip} />
                <div className={styles.reportValue}>{importResult.skipped}</div>
                <div className={styles.reportLabel}>Scartate</div>
              </div>
            </div>

            {importResult.warnings.length > 0 && (
              <div className={styles.warningsList}>
                <h3 className={styles.listTitle}>
                  <AlertTriangle size={20} className={styles.statIconWarning} />
                  Warning ({importResult.warnings.length})
                </h3>
                <ul>
                  {importResult.warnings.map((w, idx) => (
                    <li key={idx}>
                      Riga {w.index}: {w.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className={styles.errorsList}>
                <h3 className={styles.listTitle}>
                  <XCircle size={20} className={styles.statIconError} />
                  Errori ({importResult.errors.length})
                </h3>
                <ul>
                  {importResult.errors.map((e, idx) => (
                    <li key={idx}>
                      Riga {e.index}: {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button
              onClick={() => {
                handleReset();
                setStep(1);
              }}
              className={styles.buttonSecondary}
            >
              Nuovo Import
            </button>
            <button
              onClick={() => {
                router.push(`/companies`);
              }}
              className={styles.buttonPrimary}
            >
              Vai alle aziende
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
