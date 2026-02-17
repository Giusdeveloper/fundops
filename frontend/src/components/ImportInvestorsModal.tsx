"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { InvestorFormData } from '../types/investor';
import './ImportInvestorsModal.css';

interface ImportInvestorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (investors: InvestorFormData[]) => void;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportPreview {
  data: Record<string, string>[];
  errors: ImportError[];
  isValid: boolean;
}

export default function ImportInvestorsModal({ isOpen, onClose, onImport }: ImportInvestorsModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'import'>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setPreview({
          data: [],
          errors: [{ row: 0, field: 'file', message: 'File vuoto' }],
          isValid: false
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data = lines.slice(1).map((line) => {
        const values = line.split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        
        return { ...row, _rowIndex: (lines.slice(1).indexOf(line) + 2).toString() }; // +2 perché iniziamo da riga 2 (header è riga 1)
      });

      const errors = validateData(data);
      const isValid = errors.length === 0;

      setPreview({
        data,
        errors,
        isValid
      });

      setStep('preview');
    } catch (error) {
      console.error('Errore nel parsing del file:', error);
      setPreview({
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Errore nel parsing del file' }],
        isValid: false
      });
    }
  };

  const validateData = (data: Record<string, string>[]): ImportError[] => {
    const errors: ImportError[] = [];
    const requiredFields = ['nome', 'email'];
    
    data.forEach((row) => {
      const rowNum = parseInt(row._rowIndex);
      
      // Validazione campi obbligatori
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({
            row: rowNum,
            field,
            message: `Campo obbligatorio mancante`
          });
        }
      });

      // Validazione email
      if (row.email && !/\S+@\S+\.\S+/.test(row.email)) {
        errors.push({
          row: rowNum,
          field: 'email',
          message: 'Email non valida'
        });
      }

      // Validazione telefono
      if (row.telefono && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(row.telefono)) {
        errors.push({
          row: rowNum,
          field: 'telefono',
          message: 'Numero di telefono non valido'
        });
      }

      // Validazione LinkedIn
      if (row.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(row.linkedin)) {
        errors.push({
          row: rowNum,
          field: 'linkedin',
          message: 'URL LinkedIn non valido'
        });
      }
    });

    return errors;
  };

  const mapDataToInvestor = (row: Record<string, string>): InvestorFormData => {
    return {
      name: row.nome || '',
      email: row.email || '',
      phone: row.telefono || '',
      company: row.azienda || '',
      position: row.posizione || '',
      status: (mapStatus(row.status) || 'active') as 'active' | 'pending' | 'inactive',
      category: (mapCategory(row.categoria) || 'individual') as 'individual' | 'angel' | 'vc' | 'institutional',
      notes: row.note || '',
      preferredContactMethod: (mapContactMethod(row.metodo_contatto) || 'email') as 'email' | 'phone' | 'meeting',
      timezone: row.fuso_orario || 'Europe/Rome',
      lastContactDate: row.ultimo_contatto || '',
      investorType: (mapInvestorType(row.tipologia) || 'customer') as 'customer' | 'supplier' | 'business_development' | 'professionals' | 'member_get_member' | 'exit' | 'influencer' | 'brand_awareness' | 'recruiter',
      motivation: row.motivazione || '',
      linkedin: row.linkedin || ''
    };
  };

  const mapStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'attivo': 'active',
      'in attesa': 'pending',
      'inattivo': 'inactive'
    };
    return statusMap[status?.toLowerCase()] || 'active';
  };

  const mapCategory = (category: string) => {
    const categoryMap: Record<string, string> = {
      'angel': 'angel',
      'angel investor': 'angel',
      'vc': 'vc',
      'venture capital': 'vc',
      'istituzionale': 'institutional',
      'individuale': 'individual'
    };
    return categoryMap[category?.toLowerCase()] || 'individual';
  };

  const mapContactMethod = (method: string) => {
    const methodMap: Record<string, string> = {
      'email': 'email',
      'telefono': 'phone',
      'riunione': 'meeting'
    };
    return methodMap[method?.toLowerCase()] || 'email';
  };

  const mapInvestorType = (type: string) => {
    const typeMap: Record<string, string> = {
      'customer': 'customer',
      'supplier': 'supplier',
      'business development': 'business_development',
      'professionals': 'professionals',
      'member get member': 'member_get_member',
      'exit': 'exit',
      'influencer': 'influencer',
      'brand awareness': 'brand_awareness',
      'recruiter': 'recruiter'
    };
    return typeMap[type?.toLowerCase()] || 'customer';
  };

  const handleImport = async () => {
    if (!preview || !preview.isValid) return;

    setImporting(true);
    setStep('import');

    try {
      const investors = preview.data.map(mapDataToInvestor);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simula importazione
      
      onImport(investors);
      setImportedCount(investors.length);
    } catch (error) {
      console.error('Errore durante l\'importazione:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setPreview(null);
    setImporting(false);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'nome',
      'email',
      'telefono',
      'azienda',
      'posizione',
      'status',
      'categoria',
      'tipologia',
      'metodo_contatto',
      'fuso_orario',
      'ultimo_contatto',
      'motivazione',
      'linkedin',
      'note'
    ];

    const csvContent = headers.join(',') + '\n' +
      'Mario Rossi,mario.rossi@example.com,+39 333 123 4567,ACME Corp,CEO,attivo,individuale,customer,email,Europe/Rome,2024-01-15,Interessato a progetti innovativi,https://linkedin.com/in/mario-rossi,Note di esempio';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_investitori.csv';
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="import-header">
          <div className="import-title-section">
            <h2 className="import-title">Importa Investitori</h2>
            <p className="import-subtitle">
              {step === 'upload' && 'Carica un file CSV o XLS con i dati degli investitori'}
              {step === 'preview' && 'Anteprima dei dati da importare'}
              {step === 'import' && 'Importazione in corso...'}
            </p>
          </div>
          <button className="close-button" onClick={onClose} title="Chiudi">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="import-content">
          {step === 'upload' && (
            <div className="upload-section">
              <div className="upload-area">
                <Upload size={48} className="upload-icon" />
                <h3>Carica File</h3>
                <p>Trascina il file CSV/XLS qui o clicca per selezionare</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="file-input"
                  title="Seleziona file CSV o XLS"
                />
                <button className="upload-button">
                  Seleziona File
                </button>
              </div>

              <div className="template-section">
                <h4>Template</h4>
                <p>Scarica il template CSV per vedere il formato richiesto</p>
                <button className="template-button" onClick={downloadTemplate}>
                  <Download size={16} />
                  Scarica Template
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="preview-section">
              <div className="preview-header">
                <div className="preview-stats">
                  <div className="stat">
                    <span className="stat-value">{preview.data.length}</span>
                    <span className="stat-label">Righe da importare</span>
                  </div>
                  <div className="stat">
                    <span className={`stat-value ${preview.errors.length > 0 ? 'error' : 'success'}`}>
                      {preview.errors.length}
                    </span>
                    <span className="stat-label">Errori trovati</span>
                  </div>
                </div>
              </div>

              {preview.errors.length > 0 && (
                <div className="errors-section">
                  <h4>
                    <AlertCircle size={16} />
                    Errori di Validazione
                  </h4>
                  <div className="errors-list">
                    {preview.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="error-item">
                        <span className="error-row">Riga {error.row}</span>
                        <span className="error-field">{error.field}</span>
                        <span className="error-message">{error.message}</span>
                      </div>
                    ))}
                    {preview.errors.length > 10 && (
                      <div className="error-item">
                        <span className="error-message">
                          ... e altri {preview.errors.length - 10} errori
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="preview-table">
                <h4>Anteprima Dati</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Azienda</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          <td>{row.nome}</td>
                          <td>{row.email}</td>
                          <td>{row.azienda}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.data.length > 5 && (
                    <p className="table-note">
                      ... e altri {preview.data.length - 5} record
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'import' && (
            <div className="import-section">
              <div className="import-status">
                {importing ? (
                  <>
                    <div className="loading-spinner"></div>
                    <h3>Importazione in corso...</h3>
                    <p>Elaborazione dei dati degli investitori</p>
                  </>
                ) : (
                  <>
                    <CheckCircle size={48} className="success-icon" />
                    <h3>Importazione Completata!</h3>
                    <p>{importedCount} investitori importati con successo</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="import-actions">
          {step === 'upload' && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Annulla
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="btn-secondary" onClick={handleReset}>
                Indietro
              </button>
              <button 
                className="btn-primary" 
                onClick={handleImport}
                disabled={!preview?.isValid}
              >
                Importa {preview?.data.length || 0} Investitori
              </button>
            </>
          )}

          {step === 'import' && !importing && (
            <button className="btn-primary" onClick={onClose}>
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
