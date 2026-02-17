"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { useCompany } from "@/context/CompanyContext";
import { FileText, Download, Trash2, Upload as UploadIcon, FileUp, X } from "lucide-react";
import styles from "./LoiDocuments.module.css";

interface Document {
  id: string;
  type: "loi_pdf" | "attachment" | "loi_receipt" | "notary_deed" | "investment_form" | "wire_proof";
  title: string;
  version: number;
  created_at: string;
  size_bytes: number | null;
  mime_type: string;
}

interface LoiDocumentsProps {
  loiId: string;
}

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString.slice(0, 10);
  }
};

export default function LoiDocuments({ loiId }: LoiDocumentsProps) {
  const { showToast } = useToast();
  const { activeCompanyId: companyId } = useCompany();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [uploadForm, setUploadForm] = useState({
    title: "",
    file: null as File | null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `/api/fundops_documents?loiId=${loiId}&companyId=${companyId}`
      );

      if (!response.ok) {
        throw new Error("Errore nel caricamento dei documenti");
      }

      const result = await response.json();
      setDocuments(result.data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      showToast("Errore nel caricamento dei documenti", "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, loiId, showToast]);

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId, fetchDocuments]);

  const handleGeneratePDF = async () => {
    if (!companyId) {
      showToast("Company ID mancante", "error");
      return;
    }

    setGeneratingPDF(true);
    try {
      const response = await fetch("/api/fundops_documents/generate-loi-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId, loiId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nella generazione del PDF");
      }

      showToast("PDF LOI generato con successo", "success");
      fetchDocuments();
      window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
    } catch (err) {
      console.error("Error generating PDF:", err);
      showToast(
        err instanceof Error ? err.message : "Errore nella generazione del PDF",
        "error"
      );
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
      if (!uploadForm.title) {
        setUploadForm({ ...uploadForm, file, title: file.name });
      }
    }
  };

  const handleUpload = async () => {
    if (!companyId) {
      showToast("Company ID mancante", "error");
      return;
    }

    if (!uploadForm.file || !uploadForm.title.trim()) {
      showToast("Seleziona un file e inserisci un titolo", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("companyId", companyId);
      formData.append("loiId", loiId);
      formData.append("type", "attachment");
      formData.append("title", uploadForm.title.trim());

      const response = await fetch("/api/fundops_documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel caricamento del file");
      }

      showToast("Documento caricato con successo", "success");
      setUploadForm({ title: "", file: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchDocuments();
      window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
    } catch (err) {
      console.error("Error uploading file:", err);
      showToast(
        err instanceof Error ? err.message : "Errore nel caricamento del file",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel recupero dell'URL");
      }

      const result = await response.json();
      window.open(result.url, "_blank");
    } catch (err) {
      console.error("Error downloading file:", err);
      showToast(
        err instanceof Error ? err.message : "Errore nel download del file",
        "error"
      );
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!companyId) {
      showToast("Company ID mancante", "error");
      return;
    }

    // Usa toast invece di confirm
    // L'utente può cliccare di nuovo per confermare se necessario
    setDeletingId(documentId);
    try {
      const response = await fetch("/api/fundops_documents/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId, documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'eliminazione");
      }

      showToast("Documento eliminato", "success");
      fetchDocuments();
      window.dispatchEvent(new CustomEvent('loi-event-created', { detail: { loiId } }));
    } catch (err) {
      console.error("Error deleting document:", err);
      showToast(
        err instanceof Error ? err.message : "Errore nell'eliminazione",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className={styles["documents-section"]}>
      <h2 className={styles["documents-title"]}>Documento di supporto</h2>
      <p className={styles["documents-subtitle"]}>
        Il documento formalizza l&apos;impegno espresso e ne dettaglia le condizioni.
      </p>

      {/* Azioni */}
      <div className={styles["documents-actions"]}>
        <button
          onClick={handleGeneratePDF}
          disabled={generatingPDF || !companyId}
          className={styles["action-button"]}
        >
          {generatingPDF ? "Generazione..." : "Genera PDF LOI"}
        </button>
      </div>

      {/* Form Upload */}
      <div className={styles["upload-section"]}>
        <h3 className={styles["upload-title"]}>Carica documento</h3>
        <div className={styles["upload-form"]}>
          {/* File selector custom button */}
          <div className={styles["file-selector-wrapper"]}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className={styles["file-input-hidden"]}
              disabled={uploading}
              aria-label="Seleziona file PDF"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={styles["file-select-button"]}
            >
              <FileUp size={16} />
              Scegli file
            </button>
            {uploadForm.file && (
              <div className={styles["file-name-display"]}>
                <span className={styles["file-name-text"]} title={uploadForm.file.name}>
                  {uploadForm.file.name.length > 30 
                    ? `${uploadForm.file.name.slice(0, 30)}...` 
                    : uploadForm.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadForm({ ...uploadForm, file: null });
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className={styles["file-name-remove"]}
                  disabled={uploading}
                  aria-label="Rimuovi file selezionato"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          
          <input
            type="text"
            placeholder="Titolo documento"
            value={uploadForm.title}
            onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
            className={styles["title-input"]}
            disabled={uploading}
          />
          
          <button
            onClick={handleUpload}
            disabled={uploading || !uploadForm.file || !uploadForm.title.trim()}
            className={styles["upload-button"]}
          >
            {uploading ? "Caricamento..." : <><UploadIcon size={16} /> Carica</>}
          </button>
        </div>
        {(!uploadForm.file || !uploadForm.title.trim()) && (
          <p className={styles["upload-helper"]}>
            Seleziona un file PDF e inserisci un titolo
          </p>
        )}
      </div>

      {/* Lista Documenti */}
      {loading ? (
        <div className={styles["documents-loading"]}>
          <p>Caricamento...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className={styles["documents-empty"]}>
          <FileText size={48} className={styles["empty-icon"]} />
          <p className={styles["empty-text"]}>Nessun documento disponibile</p>
          <p className={styles["empty-subtext"]}>
            Carica un documento o genera un PDF LOI per iniziare
          </p>
        </div>
      ) : (
        <div className={styles["documents-table"]}>
          <div className={styles["documents-table-header"]}>
            <div className={styles["table-col-title"]}>Titolo</div>
            <div className={styles["table-col-type"]}>Tipo</div>
            <div className={styles["table-col-version"]}>Versione</div>
            <div className={styles["table-col-date"]}>Data</div>
            <div className={styles["table-col-actions"]}>Azioni</div>
          </div>
          <div className={styles["documents-table-body"]}>
            {documents.map((doc) => (
              <div key={doc.id} className={styles["document-row"]}>
                <div className={styles["table-col-title"]}>
                  <div className={styles["document-title"]}>{doc.title}</div>
                </div>
                <div className={styles["table-col-type"]}>
                  <span className={styles["document-type-badge"]}>
                    {doc.type === "loi_pdf" ? "PDF LOI" : doc.type === "loi_receipt" ? "Ricevuta" : "Allegato"}
                  </span>
                </div>
                <div className={styles["table-col-version"]}>
                  <span className={styles["document-version"]}>v{doc.version}</span>
                </div>
                <div className={styles["table-col-date"]}>
                  <span className={styles["document-date"]}>
                    {formatDate(doc.created_at)}
                  </span>
                </div>
                <div className={styles["table-col-actions"]}>
                  <div className={styles["document-actions"]}>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className={styles["action-button-small"]}
                      title="Scarica"
                    >
                      <Download size={14} />
                      Scarica
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className={`${styles["action-button-small"]} ${styles["action-button-danger"]}`}
                      title="Elimina"
                    >
                      <Trash2 size={14} />
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
