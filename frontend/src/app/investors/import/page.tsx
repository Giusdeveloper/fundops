"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import RequireCompany from "@/components/RequireCompany";
import { useToast } from "@/components/ToastProvider";
import Papa from "papaparse";
import { Upload, FileText, ArrowRight, AlertCircle, X, CheckCircle, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import CsvPreviewTable from "@/components/investors/CsvPreviewTable";
import styles from "./import.module.css";

interface CsvRow {
  [key: string]: string;
}

interface FieldMapping {
  full_name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  investor_type_raw?: string;
  source_type_raw?: string;
  motivation?: string;
  activity?: string;
  notes?: string;
  client_company_raw?: string;
  investor_company_name_raw?: string;
  // Per full_name: può essere una colonna o "nome" + "cognome"
  nome?: string;
  cognome?: string;
}

interface NormalizedRow {
  full_name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  investor_type_raw?: string;
  source_type_raw?: string;
  notes_final?: string;
  client_company_raw?: string;
  investor_company_name_raw?: string;
  is_company_investor: boolean;
  _originalIndex: number;
  _status: "ok" | "warning" | "error" | "error_critical" | "skip";
  _messages: string[];
  _editable?: boolean; // Se true, può essere editato inline
}

type Step = 1 | 2 | 3 | 4;

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: Array<{ index: number; reason: string }>;
  errors: Array<{ index: number; reason: string }>;
}

export default function ImportInvestorsPage() {
  const router = useRouter();
  const { activeCompanyId: companyId } = useCompany();
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
  const [editingRow, setEditingRow] = useState<number | null>(null); // Usa _originalIndex invece di idx
  const [editingField, setEditingField] = useState<string | null>(null);
  // Salva le modifiche manuali: mappa _originalIndex -> { field: value }
  const [manualEdits, setManualEdits] = useState<Map<number, Partial<Pick<NormalizedRow, 'full_name' | 'email'>>>>(new Map());
  // Modifiche pendenti (non ancora confermate): mappa _originalIndex -> { field: value }
  const [pendingEdits, setPendingEdits] = useState<Map<number, Partial<Pick<NormalizedRow, 'full_name' | 'email'>>>>(new Map());
  // Stato per mostrare il popup di conferma
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ rowIndex: number; field: string; value: string } | null>(null);

  // Formatta dimensione file
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Auto-detect mapping
  const autoDetectMapping = useCallback((headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {} as FieldMapping;
    
    headers.forEach((header) => {
      const normalized = header.toLowerCase().trim();
      
      // full_name
      if (normalized === 'full_name' || normalized.includes('nome_cognome') || normalized.includes('nome e cognome')) {
        mapping.full_name = header;
      }
      
      // nome e cognome separati
      if (normalized === 'nome' || (normalized.includes('nome') && !normalized.includes('cognome'))) {
        mapping.nome = header;
      }
      if (normalized === 'cognome' || normalized.includes('cognome')) {
        mapping.cognome = header;
      }
      
      // email
      if (normalized === 'email' || normalized === 'e-mail' || normalized === 'mail' || normalized === 'e_mail') {
        mapping.email = header;
      }
      
      // phone
      if (normalized === 'telefono' || normalized === 'phone' || normalized === 'tel' || normalized === 'mobile' || normalized === 'cellulare') {
        mapping.phone = header;
      }
      
      // linkedin
      if (normalized === 'linkedin' || normalized === 'linked_in' || normalized === 'linkedin url') {
        mapping.linkedin = header;
      }
      
      // investor_type_raw
      if (normalized === 'investor_type_raw' || normalized === 'tipo_investitore' || normalized === 'tipo investitore' || normalized === 'investor_type') {
        mapping.investor_type_raw = header;
      }
      
      // source_type_raw
      if (normalized === 'source_type_raw' || normalized === 'tipo_sorgente' || normalized === 'tipo sorgente' || normalized === 'source_type') {
        mapping.source_type_raw = header;
      }
      
      // motivation
      if (normalized === 'motivazione') {
        mapping.motivation = header;
      }
      
      // activity
      if (normalized === 'attività' || normalized === 'attivita') {
        mapping.activity = header;
      }
      
      // notes
      if (normalized === 'note' || normalized === 'note_aggiuntive' || normalized === 'note aggiuntive') {
        mapping.notes = header;
      }
      
      // client_company_raw (Company / Cliente Imment)
      if (normalized === 'company' || normalized === 'cliente' || normalized === 'cliente_imment' || normalized === 'cliente imment' || normalized.includes('cliente imment')) {
        mapping.client_company_raw = header;
      }
      
      // investor_company_name_raw (Ragione Sociale)
      if (normalized === 'ragione_sociale' || normalized === 'ragione sociale' || normalized === 'azienda' || normalized === 'company_name') {
        mapping.investor_company_name_raw = header;
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
        delimiter: "", // auto-detect
        transformHeader: (header: string) => {
          // Normalizza header: lowercase + underscore
          return header.toLowerCase().trim().replace(/\s+/g, "_");
        },
        transform: (value: string) => {
          // Trim values
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
    setManualEdits(new Map());
    setPendingEdits(new Map());
    setShowConfirmDialog(null);
    setStep(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Determina se investor è azienda
  const isCompanyInvestor = useCallback((investorTypeRaw?: string): boolean => {
    if (!investorTypeRaw) return false;
    const normalized = investorTypeRaw.toLowerCase().trim();
    return normalized.includes('azienda') || 
           normalized.includes('company') || 
           normalized.includes('corporate') || 
           normalized.includes('institutional');
  }, []);

  // Valida email
  const isValidEmail = useCallback((email?: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, []);

  // Normalizza e valida righe
  const normalizeAndValidate = useCallback((rows: CsvRow[], mapping: FieldMapping, manualEditsMap?: Map<number, Partial<Pick<NormalizedRow, 'full_name' | 'email'>>>): NormalizedRow[] => {
    return rows.map((row, index) => {
      const normalized: NormalizedRow = {
        full_name: '',
        is_company_investor: false,
        _originalIndex: index,
        _status: 'ok',
        _messages: [],
      };

      // Applica modifiche manuali se presenti (priorità sulle modifiche dal CSV)
      const manualEdit = manualEditsMap?.get(index);

      // full_name
      if (manualEdit?.full_name !== undefined) {
        // Usa la modifica manuale se presente
        normalized.full_name = manualEdit.full_name;
      } else if (mapping.full_name && row[mapping.full_name]) {
        normalized.full_name = row[mapping.full_name].trim();
      } else if (mapping.nome && mapping.cognome) {
        const nome = (row[mapping.nome] || '').trim();
        const cognome = (row[mapping.cognome] || '').trim();
        normalized.full_name = `${nome} ${cognome}`.trim();
      }

      // email
      if (manualEdit?.email !== undefined) {
        // Usa la modifica manuale se presente
        normalized.email = manualEdit.email;
      } else if (mapping.email && row[mapping.email]) {
        normalized.email = row[mapping.email].trim().toLowerCase();
      }

      // phone
      if (mapping.phone && row[mapping.phone]) {
        normalized.phone = row[mapping.phone].trim();
      }

      // linkedin
      if (mapping.linkedin && row[mapping.linkedin]) {
        normalized.linkedin = row[mapping.linkedin].trim();
      }

      // investor_type_raw
      if (mapping.investor_type_raw && row[mapping.investor_type_raw]) {
        normalized.investor_type_raw = row[mapping.investor_type_raw].trim();
      }

      // source_type_raw
      if (mapping.source_type_raw && row[mapping.source_type_raw]) {
        normalized.source_type_raw = row[mapping.source_type_raw].trim();
      }

      // notes_final: merge di Motivazione + Attività + Note
      const notesParts: string[] = [];
      if (mapping.motivation && row[mapping.motivation]) {
        notesParts.push(`Motivazione: ${row[mapping.motivation]}`);
      }
      if (mapping.activity && row[mapping.activity]) {
        notesParts.push(`Attività: ${row[mapping.activity]}`);
      }
      if (mapping.notes && row[mapping.notes]) {
        notesParts.push(row[mapping.notes]);
      }
      if (notesParts.length > 0) {
        normalized.notes_final = notesParts.join('\n\n');
      }

      // client_company_raw
      if (mapping.client_company_raw && row[mapping.client_company_raw]) {
        normalized.client_company_raw = row[mapping.client_company_raw].trim();
      }

      // investor_company_name_raw
      if (mapping.investor_company_name_raw && row[mapping.investor_company_name_raw]) {
        normalized.investor_company_name_raw = row[mapping.investor_company_name_raw].trim();
      }

      // Determina se è azienda
      normalized.is_company_investor = isCompanyInvestor(normalized.investor_type_raw);

      // Validazioni
      // ERROR CRITICO: full_name mancante (bloccante)
      if (!normalized.full_name || normalized.full_name.length === 0) {
        normalized._status = 'error_critical';
        normalized._messages.push('Nome mancante (obbligatorio)');
      }

      // ERROR NON CRITICO: email presente ma non valida (può essere importata comunque)
      if (normalized.email && !isValidEmail(normalized.email)) {
        if (normalized._status === 'ok' || normalized._status === 'warning') {
          normalized._status = 'error';
        }
        normalized._messages.push('Email non valida (verrà importata comunque)');
        normalized._editable = true; // Può essere corretta inline
      }

      // WARNING: email mancante
      if (!normalized.email || normalized.email.length === 0) {
        normalized._messages.push('Email mancante (dedupe debole)');
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // WARNING: nome troppo corto
      if (normalized.full_name && normalized.full_name.length < 3) {
        normalized._messages.push('Nome troppo corto (<3 caratteri)');
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // WARNING: ragione sociale presente ma investor non azienda
      if (normalized.investor_company_name_raw && !normalized.is_company_investor) {
        normalized._messages.push('Ragione sociale ignorata (investor persona fisica)');
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // WARNING: client_company_raw presente
      if (normalized.client_company_raw) {
        normalized._messages.push('Cliente Imment presente (verrà risolto in import)');
        if (normalized._status === 'ok') {
          normalized._status = 'warning';
        }
      }

      // SKIP: riga completamente vuota
      if (!normalized.full_name && !normalized.email && !normalized.phone && !normalized.linkedin) {
        normalized._status = 'skip';
        normalized._messages.push('Riga completamente vuota');
      }

      return normalized;
    });
  }, [isCompanyInvestor, isValidEmail]);

  // Deduplica CSV
  const deduplicateRows = useCallback((rows: NormalizedRow[]): { ready: NormalizedRow[]; skipped: NormalizedRow[] } => {
    const ready: NormalizedRow[] = [];
    const skipped: NormalizedRow[] = [];
    const seen = new Map<string, number>(); // key -> index in ready array

    rows.forEach((row) => {
      // Skip se già marcato come skip o error CRITICO (nome mancante)
      if (row._status === 'skip' || row._status === 'error_critical') {
        skipped.push({ ...row, _messages: [...row._messages, 'Riga scartata per validazione'] });
        return;
      }
      // Errori non critici (es. email non valida) vengono importati comunque con warning
      if (row._status === 'error') {
        // Converti error non critico in warning per permettere l'import
        row._status = 'warning';
      }

      // Crea chiavi per deduplica (priorità)
      let duplicateReadyIndex: number | null = null;
      let matchType = '';

      // 1. email
      if (row.email && row.email.length > 0) {
        const key = `email:${row.email}`;
        if (seen.has(key)) {
          duplicateReadyIndex = seen.get(key)!;
          matchType = 'email';
        } else {
          seen.set(key, ready.length); // Salva l'indice che avrà in ready
        }
      }

      // 2. full_name + linkedin
      if (duplicateReadyIndex === null && row.full_name && row.linkedin) {
        const key = `name+linkedin:${row.full_name.toLowerCase()}:${row.linkedin.toLowerCase()}`;
        if (seen.has(key)) {
          duplicateReadyIndex = seen.get(key)!;
          matchType = 'name+linkedin';
        } else {
          seen.set(key, ready.length);
        }
      }

      // 3. full_name + phone
      if (duplicateReadyIndex === null && row.full_name && row.phone) {
        const key = `name+phone:${row.full_name.toLowerCase()}:${row.phone}`;
        if (seen.has(key)) {
          duplicateReadyIndex = seen.get(key)!;
          matchType = 'name+phone';
        } else {
          seen.set(key, ready.length);
        }
      }

      // 4. full_name (LOW CONFIDENCE)
      if (duplicateReadyIndex === null && row.full_name) {
        const key = `name:${row.full_name.toLowerCase()}`;
        if (seen.has(key)) {
          duplicateReadyIndex = seen.get(key)!;
          matchType = 'name_only';
          // Aggiungi warning
          row._messages.push(`Match solo per nome (bassa confidenza)`);
          if (row._status === 'ok') {
            row._status = 'warning';
          }
        } else {
          seen.set(key, ready.length);
        }
      }

      if (duplicateReadyIndex !== null) {
        // Duplicato trovato: confronta e tieni la riga più completa
        const existingRow = ready[duplicateReadyIndex];
        if (existingRow) {
          // Conta campi valorizzati (escludendo metadati)
          const excludeFields = ['_originalIndex', '_status', '_messages', 'is_company_investor'];
          const existingFields = Object.entries(existingRow)
            .filter(([k]) => !excludeFields.includes(k))
            .filter(([, v]) => v && typeof v === 'string' && v.length > 0).length;
          const currentFields = Object.entries(row)
            .filter(([k]) => !excludeFields.includes(k))
            .filter(([, v]) => v && typeof v === 'string' && v.length > 0).length;
          
          if (currentFields > existingFields) {
            // Sostituisci la riga esistente
            skipped.push({ ...existingRow, _messages: [...existingRow._messages, `Duplicato nel file (match: ${matchType})`] });
            ready[duplicateReadyIndex] = row;
            // Aggiorna tutte le chiavi che puntavano a questo indice
            for (const [key, idx] of seen.entries()) {
              if (idx === duplicateReadyIndex) {
                seen.set(key, duplicateReadyIndex);
              }
            }
          } else {
            skipped.push({ ...row, _messages: [...row._messages, `Duplicato nel file (match: ${matchType})`] });
          }
        } else {
          skipped.push({ ...row, _messages: [...row._messages, `Duplicato nel file (match: ${matchType})`] });
        }
      } else {
        // Nessun duplicato: aggiungi a ready
        ready.push(row);
      }
    });

    return { ready, skipped };
  }, []);

  // Applica mapping e normalizzazione
  const applyMapping = useCallback(() => {
    const normalized = normalizeAndValidate(csvRows, fieldMapping, manualEdits);
    const { ready, skipped } = deduplicateRows(normalized);
    
    setNormalizedRows(normalized);
    setReadyRows(ready);
    setSkippedRows(skipped);
  }, [csvRows, fieldMapping, normalizeAndValidate, deduplicateRows, manualEdits]);

  // Calcola statistiche
  const stats = useMemo(() => {
    const ok = normalizedRows.filter(r => r._status === 'ok').length;
    const warning = normalizedRows.filter(r => r._status === 'warning').length;
    const error = normalizedRows.filter(r => r._status === 'error').length; // Errori non critici
    const errorCritical = normalizedRows.filter(r => r._status === 'error_critical').length; // Errori critici (bloccanti)
    const skip = normalizedRows.filter(r => r._status === 'skip').length + skippedRows.length;
    
    return { ok, warning, error, errorCritical, skip, total: normalizedRows.length };
  }, [normalizedRows, skippedRows]);

  // Applica mapping quando cambia fieldMapping o csvRows
  useEffect(() => {
    if (step === 2 && csvRows.length > 0) {
      // Verifica che almeno il mapping per name sia presente (full_name o nome+cognome)
      const hasNameMapping = fieldMapping.full_name || (fieldMapping.nome && fieldMapping.cognome);
      if (hasNameMapping) {
        applyMapping();
      } else {
        // Reset se il mapping name non è ancora impostato
        setNormalizedRows([]);
        setReadyRows([]);
        setSkippedRows([]);
      }
    }
  }, [step, csvRows, fieldMapping, applyMapping]);

  const hasData = csvRows.length > 0 && csvHeaders.length > 0;
  
  // Verifica che ci sia almeno un mapping per il nome
  const hasNameMapping = fieldMapping.full_name || (fieldMapping.nome && fieldMapping.cognome);
  
  // Verifica se ci sono modifiche pendenti
  const hasPendingEdits = pendingEdits.size > 0;
  
  // canProceed: nessun errore CRITICO E almeno una riga OK/warning/error (non critico) E mapping nome presente
  // E nessuna modifica pendente (tutte devono essere confermate)
  // Permettiamo di procedere anche con errori non critici (es. email non valida)
  const canProceed = hasNameMapping && stats.errorCritical === 0 && (stats.ok + stats.warning + stats.error) > 0 && !hasPendingEdits;
  
  // Debug (rimuovere in produzione)
  useEffect(() => {
    if (step === 2) {
      console.log('Debug import:', {
        hasNameMapping,
        stats,
        canProceed,
        normalizedRowsLength: normalizedRows.length,
        readyRowsLength: readyRows.length,
      });
    }
  }, [step, hasNameMapping, stats, canProceed, normalizedRows.length, readyRows.length]);

  // Handle Import
  const handleImport = useCallback(async () => {
    if (!companyId || readyRows.length === 0) {
      showToast("Errore: companyId o righe pronte mancanti", "error");
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: readyRows.length });

    try {
      // Prepara dati per API (rimuovi metadati)
      const rowsToImport = readyRows.map((row) => ({
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        linkedin: row.linkedin,
        investor_type_raw: row.investor_type_raw,
        source_type_raw: row.source_type_raw,
        client_company_raw: row.client_company_raw,
        investor_company_name_raw: row.investor_company_name_raw,
        notes_final: row.notes_final,
      }));

      // Processa in batch per mostrare il progresso
      const BATCH_SIZE = 50; // Processa 50 righe alla volta
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
      };

      // Processa ogni batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const response = await fetch("/api/fundops_investors_import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId,
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
          `Import completato: ${finalResult.inserted} inseriti, ${finalResult.updated} aggiornati`,
          "success"
        );
      } else {
        showToast("Nessun record importato", "warning");
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
  }, [companyId, readyRows, showToast]);

  return (
    <RequireCompany>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Indietro
          </button>
          <h1 className={styles.title}>Importa investitori da CSV</h1>
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
                {/* REQUIRED: full_name */}
                <div className={styles.mappingField}>
                  <label className={styles.mappingLabel}>
                    Nome completo <span className={styles.required}>*</span>
                    {normalizedRows.length > 0 && stats.error > 0 && !hasNameMapping && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                        ({stats.error} righe senza nome)
                      </span>
                    )}
                  </label>
                  <div className={styles.mappingInputs}>
                    {fieldMapping.full_name ? (
                      <select
                        value={fieldMapping.full_name}
                        onChange={(e) => setFieldMapping({ ...fieldMapping, full_name: e.target.value })}
                        className={styles.mappingSelect}
                      >
                        <option value="">— Seleziona —</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <select
                          value={fieldMapping.nome || ""}
                          onChange={(e) => setFieldMapping({ ...fieldMapping, nome: e.target.value })}
                          className={styles.mappingSelect}
                        >
                          <option value="">Nome —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className={styles.mappingPlus}>+</span>
                        <select
                          value={fieldMapping.cognome || ""}
                          onChange={(e) => setFieldMapping({ ...fieldMapping, cognome: e.target.value })}
                          className={styles.mappingSelect}
                        >
                          <option value="">Cognome —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </>
                    )}
                    {fieldMapping.full_name && (
                      <button
                        onClick={() => {
                          const next = { ...fieldMapping };
                          delete next.full_name;
                          setFieldMapping({ ...next, nome: '', cognome: '' });
                        }}
                        className={styles.mappingToggle}
                      >
                        Usa Nome + Cognome
                      </button>
                    )}
                    {!fieldMapping.full_name && (fieldMapping.nome || fieldMapping.cognome) && (
                      <button
                        onClick={() => {
                          const next = { ...fieldMapping };
                          delete next.nome;
                          delete next.cognome;
                          setFieldMapping({ ...next, full_name: '' });
                        }}
                        className={styles.mappingToggle}
                      >
                        Usa colonna unica
                      </button>
                    )}
                  </div>
                </div>

                {/* OPTIONAL fields */}
                {[
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Telefono' },
                  { key: 'linkedin', label: 'LinkedIn' },
                  { key: 'investor_type_raw', label: 'Tipo Investitore (raw)' },
                  { key: 'source_type_raw', label: 'Tipo Sorgente (raw)' },
                  { key: 'motivation', label: 'Motivazione' },
                  { key: 'activity', label: 'Attività' },
                  { key: 'notes', label: 'Note' },
                  { key: 'client_company_raw', label: 'Cliente Imment (Company)' },
                  { key: 'investor_company_name_raw', label: 'Ragione Sociale Investitore' },
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
                    Errori ({stats.error + stats.errorCritical})
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
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Stato</th>
                      <th>Messaggi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows
                      .filter((row) => {
                        if (previewFilter === "all") return true;
                        if (previewFilter === "errors") return row._status === "error" || row._status === "error_critical";
                        if (previewFilter === "warnings") return row._status === "warning";
                        if (previewFilter === "ok") return row._status === "ok";
                        return true;
                      })
                      .slice(0, 50)
                      .map((row) => {
                        const rowOriginalIndex = row._originalIndex;
                        const isEditing = editingRow === rowOriginalIndex;
                        const hasPendingEdit = pendingEdits.has(rowOriginalIndex);
                        // Se c'è una modifica pendente, usa quella per il valore visualizzato
                        const pendingEdit = pendingEdits.get(rowOriginalIndex);
                        const displayFullName = isEditing && editingField === 'full_name' 
                          ? row.full_name 
                          : (pendingEdit?.full_name !== undefined ? pendingEdit.full_name : row.full_name);
                        const displayEmail = isEditing && editingField === 'email' 
                          ? row.email 
                          : (pendingEdit?.email !== undefined ? pendingEdit.email : row.email);
                        
                        return (
                        <tr key={rowOriginalIndex} className={styles[`row${row._status.charAt(0).toUpperCase() + row._status.slice(1).replace('_', '')}`]}>
                          <td className={styles.rowNumber}>{row._originalIndex + 2}</td>
                          <td>
                            {hasPendingEdit && !isEditing && (
                              <span className={styles.pendingBadge} title="Modifica non confermata">⚠</span>
                            )}
                            {isEditing && editingField === 'full_name' ? (
                              <input
                                type="text"
                                value={displayFullName || ''}
                                onChange={(e) => {
                                  // Aggiorna solo la visualizzazione immediata (non salvare ancora)
                                  const updated = normalizedRows.map((r) => 
                                    r._originalIndex === rowOriginalIndex 
                                      ? { ...r, full_name: e.target.value }
                                      : r
                                  );
                                  setNormalizedRows(updated);
                                }}
                                onBlur={() => {
                                  const currentValue = displayFullName || '';
                                  const originalValue = csvRows[rowOriginalIndex]?.[fieldMapping.full_name || ''] || 
                                                       (fieldMapping.nome && fieldMapping.cognome 
                                                         ? `${csvRows[rowOriginalIndex]?.[fieldMapping.nome] || ''} ${csvRows[rowOriginalIndex]?.[fieldMapping.cognome] || ''}`.trim()
                                                         : '');
                                  
                                  // Se il valore è cambiato, mostra popup di conferma
                                  if (currentValue !== originalValue && currentValue.trim() !== '') {
                                    setShowConfirmDialog({
                                      rowIndex: rowOriginalIndex,
                                      field: 'full_name',
                                      value: currentValue
                                    });
                                    // Salva temporaneamente in pendingEdits
                                    const newPending = new Map(pendingEdits);
                                    newPending.set(rowOriginalIndex, { 
                                      ...newPending.get(rowOriginalIndex), 
                                      full_name: currentValue 
                                    });
                                    setPendingEdits(newPending);
                                  } else {
                                    // Nessuna modifica, chiudi editing
                                    setEditingRow(null);
                                    setEditingField(null);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const currentValue = displayFullName || '';
                                    const originalValue = csvRows[rowOriginalIndex]?.[fieldMapping.full_name || ''] || 
                                                         (fieldMapping.nome && fieldMapping.cognome 
                                                           ? `${csvRows[rowOriginalIndex]?.[fieldMapping.nome] || ''} ${csvRows[rowOriginalIndex]?.[fieldMapping.cognome] || ''}`.trim()
                                                           : '');
                                    
                                    if (currentValue !== originalValue && currentValue.trim() !== '') {
                                      setShowConfirmDialog({
                                        rowIndex: rowOriginalIndex,
                                        field: 'full_name',
                                        value: currentValue
                                      });
                                      const newPending = new Map(pendingEdits);
                                      newPending.set(rowOriginalIndex, { 
                                        ...newPending.get(rowOriginalIndex), 
                                        full_name: currentValue 
                                      });
                                      setPendingEdits(newPending);
                                    } else {
                                      setEditingRow(null);
                                      setEditingField(null);
                                    }
                                  }
                                  if (e.key === 'Escape') {
                                    // Annulla la modifica
                                    const newPending = new Map(pendingEdits);
                                    newPending.delete(rowOriginalIndex);
                                    setPendingEdits(newPending);
                                    setEditingRow(null);
                                    setEditingField(null);
                                    applyMapping();
                                  }
                                }}
                                className={styles.inlineEditInput}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={styles.editableCell}
                                onClick={() => {
                                  setEditingRow(rowOriginalIndex);
                                  setEditingField('full_name');
                                }}
                                title="Clicca per modificare"
                              >
                                {displayFullName ? (
                                  displayFullName
                                ) : (
                                  <span className={styles.missing} title="Nome mancante - verifica il mapping">
                                    — Nome mancante
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {hasPendingEdit && !isEditing && (
                              <span className={styles.pendingBadge} title="Modifica non confermata">⚠</span>
                            )}
                            {isEditing && editingField === 'email' ? (
                              <input
                                type="text"
                                value={displayEmail || ''}
                                onChange={(e) => {
                                  // Aggiorna solo la visualizzazione immediata (non salvare ancora)
                                  const updated = normalizedRows.map((r) => 
                                    r._originalIndex === rowOriginalIndex 
                                      ? { ...r, email: e.target.value }
                                      : r
                                  );
                                  setNormalizedRows(updated);
                                }}
                                onBlur={() => {
                                  const currentValue = displayEmail || '';
                                  const originalValue = csvRows[rowOriginalIndex]?.[fieldMapping.email || ''] || '';
                                  
                                  // Se il valore è cambiato, mostra popup di conferma
                                  if (currentValue !== originalValue) {
                                    setShowConfirmDialog({
                                      rowIndex: rowOriginalIndex,
                                      field: 'email',
                                      value: currentValue
                                    });
                                    // Salva temporaneamente in pendingEdits
                                    const newPending = new Map(pendingEdits);
                                    newPending.set(rowOriginalIndex, { 
                                      ...newPending.get(rowOriginalIndex), 
                                      email: currentValue 
                                    });
                                    setPendingEdits(newPending);
                                  } else {
                                    // Nessuna modifica, chiudi editing
                                    setEditingRow(null);
                                    setEditingField(null);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const currentValue = displayEmail || '';
                                    const originalValue = csvRows[rowOriginalIndex]?.[fieldMapping.email || ''] || '';
                                    
                                    if (currentValue !== originalValue) {
                                      setShowConfirmDialog({
                                        rowIndex: rowOriginalIndex,
                                        field: 'email',
                                        value: currentValue
                                      });
                                      const newPending = new Map(pendingEdits);
                                      newPending.set(rowOriginalIndex, { 
                                        ...newPending.get(rowOriginalIndex), 
                                        email: currentValue 
                                      });
                                      setPendingEdits(newPending);
                                    } else {
                                      setEditingRow(null);
                                      setEditingField(null);
                                    }
                                  }
                                  if (e.key === 'Escape') {
                                    // Annulla la modifica
                                    const newPending = new Map(pendingEdits);
                                    newPending.delete(rowOriginalIndex);
                                    setPendingEdits(newPending);
                                    setEditingRow(null);
                                    setEditingField(null);
                                    applyMapping();
                                  }
                                }}
                                className={styles.inlineEditInput}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={styles.editableCell}
                                onClick={() => {
                                  if (row._editable || !row.email) {
                                    setEditingRow(rowOriginalIndex);
                                    setEditingField('email');
                                  }
                                }}
                                title={row._editable || !displayEmail ? "Clicca per modificare" : ""}
                              >
                                {displayEmail ? (
                                  displayEmail
                                ) : (
                                  <span className={styles.missing}>—</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={styles[`statusBadge${row._status.charAt(0).toUpperCase() + row._status.slice(1).replace('_', '')}`]}>
                              {row._status === 'error_critical' ? 'ERRORE CRITICO' : row._status.toUpperCase()}
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
                        );
                      })}
                  </tbody>
                </table>
                {normalizedRows.filter((row) => {
                  if (previewFilter === "all") return true;
                  if (previewFilter === "errors") return row._status === "error" || row._status === "error_critical";
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
              {!hasNameMapping && (
                <div className={styles.errorBox} style={{ marginBottom: 0 }}>
                  <AlertCircle size={16} className={styles.errorIcon} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage}>
                      Seleziona almeno il mapping per &quot;Nome completo&quot; per procedere
                    </div>
                  </div>
                </div>
              )}
              {hasNameMapping && stats.errorCritical > 0 && (
                <div className={styles.errorBox} style={{ marginBottom: 0 }}>
                  <AlertCircle size={16} className={styles.errorIcon} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage}>
                      Ci sono {stats.errorCritical} errori critici (nome mancante) che devono essere corretti prima di procedere
                    </div>
                  </div>
                </div>
              )}
              {hasNameMapping && stats.errorCritical === 0 && stats.error > 0 && (
                <div className={styles.warningBox} style={{ marginBottom: 0, background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                  <AlertTriangle size={16} style={{ color: '#fb923c' }} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage} style={{ color: '#fb923c' }}>
                      Ci sono {stats.error} errori non critici (es. email non valida). Le righe verranno importate comunque con warning.
                      Puoi correggerle ora o dopo l&apos;importazione.
                    </div>
                  </div>
                </div>
              )}
              {hasPendingEdits && (
                <div className={styles.warningBox} style={{ marginBottom: 0, background: 'rgba(37, 99, 235, 0.1)', borderColor: 'rgba(37, 99, 235, 0.3)' }}>
                  <AlertCircle size={16} style={{ color: '#2563eb' }} />
                  <div className={styles.errorContent}>
                    <div className={styles.errorMessage} style={{ color: '#2563eb' }}>
                      Hai {pendingEdits.size} modifica{pendingEdits.size > 1 ? 'he' : ''} non confermata{pendingEdits.size > 1 ? 'e' : ''}. 
                      Conferma le modifiche per procedere con l&apos;importazione.
                    </div>
                  </div>
                </div>
              )}
              {hasNameMapping && stats.error === 0 && (stats.ok + stats.warning) === 0 && (
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
                  <div className={styles.summaryLabel}>Righe pronte per l&apos;import</div>
                </div>
                <div className={styles.summaryStat}>
                  <div className={styles.summaryValue}>{skippedRows.length}</div>
                  <div className={styles.summaryLabel}>Righe scartate</div>
                </div>
              </div>
              {skippedRows.length > 0 && (
                <div className={styles.skippedDetails}>
                  <h3 className={styles.subtitle}>Dettaglio righe scartate:</h3>
                  <ul className={styles.skippedList}>
                    {skippedRows.filter(r => r._status === 'error_critical').length > 0 && (
                      <li>
                        <strong>{skippedRows.filter(r => r._status === 'error_critical').length}</strong> righe con errori critici (nome mancante)
                      </li>
                    )}
                    {skippedRows.filter(r => r._status === 'skip').length > 0 && (
                      <li>
                        <strong>{skippedRows.filter(r => r._status === 'skip').length}</strong> righe completamente vuote
                      </li>
                    )}
                    {skippedRows.filter(r => r._status === 'error').length > 0 && (
                      <li>
                        <strong>{skippedRows.filter(r => r._status === 'error').length}</strong> righe con errori non critici (es. email non valida) - verranno comunque importate
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
                  <div className={styles.reportLabel}>Inseriti</div>
                </div>
                <div className={styles.reportStat}>
                  <CheckCircle size={32} className={styles.statIconOk} />
                  <div className={styles.reportValue}>{importResult.updated}</div>
                  <div className={styles.reportLabel}>Aggiornati</div>
                </div>
                <div className={styles.reportStat}>
                  <X size={32} className={styles.statIconSkip} />
                  <div className={styles.reportValue}>{importResult.skipped}</div>
                  <div className={styles.reportLabel}>Scartati</div>
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
                  router.push(`/investors`);
                }}
                className={styles.buttonPrimary}
              >
                Vai agli investitori
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Dialog di conferma modifica */}
        {showConfirmDialog && (
          <div className={styles.dialogOverlay} onClick={() => {
            // Se clicchi fuori, annulla la modifica
            const newPending = new Map(pendingEdits);
            newPending.delete(showConfirmDialog.rowIndex);
            setPendingEdits(newPending);
            setShowConfirmDialog(null);
            setEditingRow(null);
            setEditingField(null);
            applyMapping();
          }}>
            <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.dialogTitle}>Conferma modifica</h3>
              <p className={styles.dialogMessage}>
                Desideri confermare la modifica del campo <strong>{showConfirmDialog.field === 'full_name' ? 'Nome' : 'Email'}</strong>?
              </p>
              <div className={styles.dialogValue}>
                <strong>Nuovo valore:</strong> {showConfirmDialog.value || '(vuoto)'}
              </div>
              <div className={styles.dialogActions}>
                <button
                  onClick={() => {
                    // Annulla
                    const newPending = new Map(pendingEdits);
                    newPending.delete(showConfirmDialog.rowIndex);
                    setPendingEdits(newPending);
                    setShowConfirmDialog(null);
                    setEditingRow(null);
                    setEditingField(null);
                    applyMapping();
                  }}
                  className={styles.dialogButtonSecondary}
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    // Conferma: sposta da pendingEdits a manualEdits
                    const newEdits = new Map(manualEdits);
                    const pendingEdit = pendingEdits.get(showConfirmDialog.rowIndex);
                    if (pendingEdit) {
                      newEdits.set(showConfirmDialog.rowIndex, {
                        ...newEdits.get(showConfirmDialog.rowIndex),
                        ...pendingEdit
                      });
                    }
                    setManualEdits(newEdits);
                    
                    const newPending = new Map(pendingEdits);
                    newPending.delete(showConfirmDialog.rowIndex);
                    setPendingEdits(newPending);
                    
                    setShowConfirmDialog(null);
                    setEditingRow(null);
                    setEditingField(null);
                    applyMapping();
                    showToast('Modifica confermata', 'success');
                  }}
                  className={styles.dialogButtonPrimary}
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireCompany>
  );
}
