"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, FileText, User, Euro, Calendar, Building, Mail } from 'lucide-react';
import './LOIForm.css';

interface LOIFormCompleteData {
  // Dati LOI
  loiNumber: string;
  loiDate: string;
  expiryDate: string;
  
  // Dati Finanziari SFP
  sfpValue: number;
  discountPercentage: number;
  conversionDate: string;
  maxTotalValue: number;
  sfpClass: 'A' | 'B' | 'C';
  
  // Dati Investitore
  investorAddress?: string;
  investorVAT?: string;
  
  // Logo
  logoUrl?: string;
  
  
  // Dati Azienda
  companyName: string;
  companyFullName: string;
  companyAddress: string;
  companyCity: string;
  companyCAP: string;
  companyProvince: string;
  companyVAT: string;
  companyCapital: string;
  companyRegistration: string;
  companyREA: string;
  companyEmail: string;
  companyPEC: string;
  companyCEO: string;
  companyTribunale: string;
  
  // Note
  notes?: string;
}

interface LOIFormCompleteProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: LOIFormCompleteData) => void;
}

export default function LOIFormComplete({ isOpen, onClose, onGenerate }: LOIFormCompleteProps) {
  // Genera numero LOI progressivo
  const generateLOINumber = () => {
    const year = new Date().getFullYear();
    
    // Controlla se siamo nel browser
    if (typeof window === 'undefined') {
      // Durante SSR, genera un numero temporaneo
      return `LOI-${year}-000`;
    }
    
    try {
    const existingLOIs = JSON.parse(localStorage.getItem('lois') || '[]');
    const currentYearLOIs = existingLOIs.filter((loi: { loiNumber?: string }) => 
      loi.loiNumber && loi.loiNumber.includes(`LOI-${year}-`)
    );
      const nextNumber = String(currentYearLOIs.length + 1).padStart(3, '0');
      return `LOI-${year}-${nextNumber}`;
    } catch {
      // Fallback in caso di errore
      const timestamp = Date.now().toString().slice(-4);
      return `LOI-${year}-${timestamp}`;
    }
  };

  const [formData, setFormData] = useState<LOIFormCompleteData>({
    loiNumber: generateLOINumber(),
    loiDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    sfpValue: 5000,
    discountPercentage: 15,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    sfpClass: 'A',
    investorAddress: '',
    investorVAT: '',
    logoUrl: '',
    companyName: 'Smart Equity Srl',
    companyFullName: 'Smart Equity Srl - Startup Innovativa',
    companyAddress: 'Via Example 123',
    companyCity: 'Roma',
    companyCAP: '00100',
    companyProvince: 'RM',
    companyVAT: 'IT12345678901',
    companyCapital: '€ 10.000,00',
    companyRegistration: '12345678901',
    companyREA: 'RM - 123456',
    companyEmail: 'info@smartequity.it',
    companyPEC: 'smartequity@pec.it',
    companyCEO: 'Mario Rossi',
    companyTribunale: 'Roma',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isClient, setIsClient] = useState(false);

  // Controlla se siamo nel browser
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Aggiorna il numero LOI quando il componente è montato nel browser
  useEffect(() => {
    if (isClient && isOpen) {
      const newLOINumber = generateLOINumber();
      setFormData(prev => ({ ...prev, loiNumber: newLOINumber }));
    }
  }, [isClient, isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Reset form quando si apre
      setFormData({
        loiNumber: generateLOINumber(),
        loiDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        sfpValue: 5000,
        discountPercentage: 15,
        conversionDate: '31/12/2026',
        maxTotalValue: 150000,
        sfpClass: 'A',
        investorAddress: '',
        investorVAT: '',
        logoUrl: '',
        companyName: 'Smart Equity Srl',
        companyFullName: 'Smart Equity Srl - Startup Innovativa',
        companyAddress: 'Via Example 123',
        companyCity: 'Roma',
        companyCAP: '00100',
        companyProvince: 'RM',
        companyVAT: 'IT12345678901',
        companyCapital: '€ 10.000,00',
        companyRegistration: '12345678901',
        companyREA: 'RM - 123456',
        companyEmail: 'info@smartequity.it',
        companyPEC: 'smartequity@pec.it',
        companyCEO: 'Mario Rossi',
        companyTribunale: 'Roma',
        notes: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.loiNumber.trim()) newErrors.loiNumber = 'Il numero LOI è obbligatorio';
    if (!formData.loiDate) newErrors.loiDate = 'La data LOI è obbligatoria';
    if (!formData.expiryDate) newErrors.expiryDate = 'La data di scadenza è obbligatoria';
    if (!formData.sfpValue || formData.sfpValue <= 0) newErrors.sfpValue = 'Il ticket size minimo deve essere maggiore di 0';
    if (!formData.sfpClass) newErrors.sfpClass = 'La classe SFP è obbligatoria';
    if (!formData.companyName.trim()) newErrors.companyName = 'Il nome azienda è obbligatorio';
    if (!formData.companyFullName.trim()) newErrors.companyFullName = 'La denominazione completa è obbligatoria';
    if (!formData.companyAddress.trim()) newErrors.companyAddress = 'L\'indirizzo è obbligatorio';
    if (!formData.companyVAT.trim()) newErrors.companyVAT = 'La P.IVA è obbligatoria';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onGenerate(formData);
    }
  };

  const handleInputChange = (field: keyof LOIFormCompleteData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Selezione investitori spostata nella pagina LOI

  const calculateDiscount = () => {
    return formData.sfpValue * (formData.discountPercentage / 100);
  };

  const calculateNetAmount = () => {
    return formData.sfpValue - calculateDiscount();
  };

  const calculateTaxBenefit = () => {
    return calculateNetAmount() * 0.3;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content loi-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FileText size={24} />
            Crea Lettera di Intenti
          </h2>
          <button className="close-button" onClick={onClose} title="Chiudi">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="loi-form">
          {/* Sezione Dati LOI */}
          <div className="form-section">
            <h3 className="section-title">
              <FileText size={18} />
              Dati LOI
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="loiNumber" className="form-label">Numero LOI *</label>
                <input
                  type="text"
                  id="loiNumber"
                  value={formData.loiNumber}
                  className="form-input form-input-readonly"
                  readOnly
                />
                <small className="form-help">Generato automaticamente</small>
              </div>
              <div className="form-group">
                <label htmlFor="loiDate" className="form-label">
                  <Calendar size={16} />
                  Data LOI *
                </label>
                <input
                  type="date"
                  id="loiDate"
                  value={formData.loiDate}
                  onChange={(e) => handleInputChange('loiDate', e.target.value)}
                  className={`form-input ${errors.loiDate ? 'error' : ''}`}
                />
                {errors.loiDate && <span className="error-message">{errors.loiDate}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="expiryDate" className="form-label">
                  <Calendar size={16} />
                  Data Scadenza LOI *
                </label>
                <input
                  type="date"
                  id="expiryDate"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  className={`form-input ${errors.expiryDate ? 'error' : ''}`}
                />
                {errors.expiryDate && <span className="error-message">{errors.expiryDate}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="logoUrl" className="form-label">Logo Azienda (URL)</label>
                <input
                  type="url"
                  id="logoUrl"
                  value={formData.logoUrl || ''}
                  onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                  className="form-input"
                  placeholder="https://example.com/logo.png"
                />
                <small className="form-help">Inserisci l&apos;URL del logo aziendale per il documento</small>
              </div>
            </div>
          </div>

          {/* Sezione Dati Investitore */}
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} />
              Dati Investitore
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="investorAddress" className="form-label">Indirizzo Investitore</label>
                <input
                  type="text"
                  id="investorAddress"
                  value={formData.investorAddress || ''}
                  onChange={(e) => handleInputChange('investorAddress', e.target.value)}
                  className="form-input"
                  placeholder="Via Roma, 123 - 00100 Roma"
                />
              </div>
              <div className="form-group">
                <label htmlFor="investorVAT" className="form-label">P.IVA Investitore</label>
                <input
                  type="text"
                  id="investorVAT"
                  value={formData.investorVAT || ''}
                  onChange={(e) => handleInputChange('investorVAT', e.target.value)}
                  className="form-input"
                  placeholder="IT12345678901"
                />
              </div>
            </div>
          </div>

          {/* Sezione SFP */}
          <div className="form-section">
            <h3 className="section-title">
              <Euro size={18} />
              Strumenti Finanziari Partecipativi
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sfpValue" className="form-label">Ticket Size Minimo *</label>
                <input
                  type="number"
                  id="sfpValue"
                  value={formData.sfpValue}
                  onChange={(e) => handleInputChange('sfpValue', Number(e.target.value))}
                  className={`form-input ${errors.sfpValue ? 'error' : ''}`}
                  min="0"
                  step="100"
                />
                {errors.sfpValue && <span className="error-message">{errors.sfpValue}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="discountPercentage" className="form-label">Sconto (%)</label>
                <input
                  type="number"
                  id="discountPercentage"
                  value={formData.discountPercentage}
                  onChange={(e) => handleInputChange('discountPercentage', Number(e.target.value))}
                  className="form-input"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sfpClass" className="form-label">Classe SFP *</label>
                <select
                  id="sfpClass"
                  value={formData.sfpClass}
                  onChange={(e) => handleInputChange('sfpClass', e.target.value as 'A' | 'B' | 'C')}
                  className={`form-select ${errors.sfpClass ? 'error' : ''}`}
                >
                  <option value="A">Classe A (20% sconto)</option>
                  <option value="B">Classe B (15% sconto)</option>
                  <option value="C">Classe C (10% sconto)</option>
                </select>
                {errors.sfpClass && <span className="error-message">{errors.sfpClass}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="conversionDate" className="form-label">
                  <Calendar size={16} />
                  Data Scadenza Round
                </label>
                <input
                  type="text"
                  id="conversionDate"
                  value={formData.conversionDate}
                  onChange={(e) => handleInputChange('conversionDate', e.target.value)}
                  className="form-input"
                  placeholder="31/12/2026"
                />
              </div>
              <div className="form-group">
                <label htmlFor="maxTotalValue" className="form-label">Importo Round</label>
                <input
                  type="number"
                  id="maxTotalValue"
                  value={formData.maxTotalValue}
                  onChange={(e) => handleInputChange('maxTotalValue', Number(e.target.value))}
                  className="form-input"
                  min="0"
                  step="1000"
                />
              </div>
            </div>


            {(formData.sfpValue && formData.sfpValue > 0) && (
              <div className="value-calculation">
                <div className="calc-row">
                  <span>Ticket Size Minimo:</span>
                  <strong>€ {(formData.sfpValue || 0).toLocaleString('it-IT')}</strong>
                </div>
                <div className="calc-row discount">
                  <span>Sconto ({formData.discountPercentage || 0}%):</span>
                  <strong>- € {calculateDiscount().toLocaleString('it-IT')}</strong>
                </div>
                <div className="calc-row total">
                  <span>Importo da Versare:</span>
                  <strong>€ {calculateNetAmount().toLocaleString('it-IT')}</strong>
                </div>
                <div className="calc-row tax">
                  <span>Detrazione Fiscale (30%):</span>
                  <strong>€ {calculateTaxBenefit().toLocaleString('it-IT')}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Sezione Azienda */}
          <div className="form-section">
            <h3 className="section-title">
              <Building size={18} />
              Dati Società Emittente
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyName" className="form-label">Nome Azienda *</label>
                <input
                  type="text"
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  className={`form-input ${errors.companyName ? 'error' : ''}`}
                  placeholder="Smart Equity Srl"
                />
                {errors.companyName && <span className="error-message">{errors.companyName}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="companyFullName" className="form-label">Denominazione Completa *</label>
                <input
                  type="text"
                  id="companyFullName"
                  value={formData.companyFullName}
                  onChange={(e) => handleInputChange('companyFullName', e.target.value)}
                  className={`form-input ${errors.companyFullName ? 'error' : ''}`}
                  placeholder="Smart Equity Srl - Startup Innovativa"
                />
                {errors.companyFullName && <span className="error-message">{errors.companyFullName}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="companyAddress" className="form-label">Indirizzo Sede Legale *</label>
              <input
                type="text"
                id="companyAddress"
                value={formData.companyAddress}
                onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                className={`form-input ${errors.companyAddress ? 'error' : ''}`}
                placeholder="Via Roma, 123"
              />
              {errors.companyAddress && <span className="error-message">{errors.companyAddress}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyCity" className="form-label">Città</label>
                <input
                  type="text"
                  id="companyCity"
                  value={formData.companyCity}
                  onChange={(e) => handleInputChange('companyCity', e.target.value)}
                  className="form-input"
                  placeholder="Roma"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyCAP" className="form-label">CAP</label>
                <input
                  type="text"
                  id="companyCAP"
                  value={formData.companyCAP}
                  onChange={(e) => handleInputChange('companyCAP', e.target.value)}
                  className="form-input"
                  placeholder="00100"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyProvince" className="form-label">Provincia</label>
                <input
                  type="text"
                  id="companyProvince"
                  value={formData.companyProvince}
                  onChange={(e) => handleInputChange('companyProvince', e.target.value)}
                  className="form-input"
                  placeholder="RM"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyVAT" className="form-label">P.IVA *</label>
                <input
                  type="text"
                  id="companyVAT"
                  value={formData.companyVAT}
                  onChange={(e) => handleInputChange('companyVAT', e.target.value)}
                  className={`form-input ${errors.companyVAT ? 'error' : ''}`}
                  placeholder="IT12345678901"
                />
                {errors.companyVAT && <span className="error-message">{errors.companyVAT}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="companyRegistration" className="form-label">Codice Fiscale</label>
                <input
                  type="text"
                  id="companyRegistration"
                  value={formData.companyRegistration}
                  onChange={(e) => handleInputChange('companyRegistration', e.target.value)}
                  className="form-input"
                  placeholder="12345678901"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyREA" className="form-label">R.E.A.</label>
                <input
                  type="text"
                  id="companyREA"
                  value={formData.companyREA}
                  onChange={(e) => handleInputChange('companyREA', e.target.value)}
                  className="form-input"
                  placeholder="RM - 123456"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyCapital" className="form-label">Capitale Sociale</label>
                <input
                  type="text"
                  id="companyCapital"
                  value={formData.companyCapital}
                  onChange={(e) => handleInputChange('companyCapital', e.target.value)}
                  className="form-input"
                  placeholder="€ 10.000,00"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyEmail" className="form-label">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  type="email"
                  id="companyEmail"
                  value={formData.companyEmail}
                  onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                  className="form-input"
                  placeholder="info@smartequity.it"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyPEC" className="form-label">PEC</label>
                <input
                  type="email"
                  id="companyPEC"
                  value={formData.companyPEC}
                  onChange={(e) => handleInputChange('companyPEC', e.target.value)}
                  className="form-input"
                  placeholder="smartequity@pec.it"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyCEO" className="form-label">CEO</label>
                <input
                  type="text"
                  id="companyCEO"
                  value={formData.companyCEO}
                  onChange={(e) => handleInputChange('companyCEO', e.target.value)}
                  className="form-input"
                  placeholder="Mario Rossi"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyTribunale" className="form-label">Tribunale Competente</label>
                <input
                  type="text"
                  id="companyTribunale"
                  value={formData.companyTribunale}
                  onChange={(e) => handleInputChange('companyTribunale', e.target.value)}
                  className="form-input"
                  placeholder="Roma"
                />
              </div>
            </div>
          </div>

          {/* Selezione Investitori spostata nella pagina LOI */}

          {/* Note */}
          <div className="form-section">
            <h3 className="section-title">
              <FileText size={18} />
              Note Aggiuntive
            </h3>
            <div className="form-group">
              <textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="Eventuali note o condizioni particolari da includere nel documento..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annulla
            </button>
            <button type="submit" className="btn-primary">
              <Save size={18} />
              Genera e Invia LOI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
