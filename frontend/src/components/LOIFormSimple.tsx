"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, FileText, User, Euro, Calendar, Building } from 'lucide-react';
import { mockInvestors } from '../data/mockInvestors';
import { formatCurrency } from '../utils/formatUtils';
import './LOIForm.css';

interface LOIFormSimpleData {
  // Dati Investitore
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorCompany?: string;
  investorAddress?: string;
  investorVAT?: string;
  
  // Dati LOI
  loiNumber: string;
  loiDate: string;
  expiryDate: string;
  
  // Dati Finanziari SFP
  sfpClass: 'A' | 'B' | 'C';
  sfpValue: number;
  discountPercentage: number;
  
  // Dati Azienda
  companyName: string;
  companyFullName: string;
  companyAddress: string;
  companyVAT: string;
  companyCapital: string;
  
  // Termini
  conversionDate: string;
  paymentTerms: string;
  
  // Note
  notes?: string;
}

interface LOIFormSimpleProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: LOIFormSimpleData) => void;
  editData?: LOIFormSimpleData | null;
}

export default function LOIFormSimple({ isOpen, onClose, onGenerate, editData }: LOIFormSimpleProps) {
  const [formData, setFormData] = useState<LOIFormSimpleData>({
    investorId: '',
    investorName: '',
    investorEmail: '',
    investorCompany: '',
    investorAddress: '',
    investorVAT: '',
    loiNumber: `LOI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    loiDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    sfpClass: 'B',
    sfpValue: 5000,
    discountPercentage: 15,
    companyName: 'Smart Equity Srl',
    companyFullName: 'Smart Equity Srl - Startup Innovativa',
    companyAddress: 'Via Example 123, 00100 Roma RM',
    companyVAT: 'IT12345678901',
    companyCapital: '€ 10.000,00',
    conversionDate: '31/12/2026',
    paymentTerms: '30 giorni dalla firma',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editData) {
      setFormData(editData);
    } else {
      // Reset al form iniziale
      setFormData({
        investorId: '',
        investorName: '',
        investorEmail: '',
        investorCompany: '',
        investorAddress: '',
        investorVAT: '',
        loiNumber: `LOI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        loiDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        sfpClass: 'B',
        sfpValue: 5000,
        discountPercentage: 15,
        companyName: 'Smart Equity Srl',
        companyFullName: 'Smart Equity Srl - Startup Innovativa',
        companyAddress: 'Via Example 123, 00100 Roma RM',
        companyVAT: 'IT12345678901',
        companyCapital: '€ 10.000,00',
        conversionDate: '31/12/2026',
        paymentTerms: '30 giorni dalla firma',
        notes: ''
      });
    }
    setErrors({});
  }, [editData, isOpen]);

  const handleInvestorChange = (investorId: string) => {
    const investor = mockInvestors.find(inv => inv.id === investorId);
    if (investor) {
      setFormData(prev => ({
        ...prev,
        investorId: investor.id,
        investorName: investor.name,
        investorEmail: investor.email,
        investorCompany: investor.company || '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.investorId) newErrors.investorId = 'Seleziona un investitore';
    if (!formData.investorName.trim()) newErrors.investorName = 'Il nome è obbligatorio';
    if (!formData.investorEmail.trim()) newErrors.investorEmail = 'L\'email è obbligatoria';
    if (!formData.loiNumber.trim()) newErrors.loiNumber = 'Il numero LOI è obbligatorio';
    if (!formData.sfpValue || formData.sfpValue <= 0) newErrors.sfpValue = 'Il valore SFP deve essere maggiore di 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onGenerate(formData);
    }
  };

  const handleInputChange = (field: keyof LOIFormSimpleData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const calculateDiscount = () => {
    return formData.sfpValue * (formData.discountPercentage / 100);
  };

  const calculateNetAmount = () => {
    return formData.sfpValue - calculateDiscount();
  };

  const getSFPClassInfo = (sfpClass: string) => {
    const info = {
      'A': { deadline: '30 giorni', discount: 20 },
      'B': { deadline: '60 giorni', discount: 15 },
      'C': { deadline: '90 giorni', discount: 10 }
    };
    return info[sfpClass as keyof typeof info] || info['B'];
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content loi-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FileText size={24} />
            Genera Lettera di Intenti
          </h2>
          <button className="close-button" onClick={onClose} title="Chiudi">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="loi-form">
          {/* Sezione Investitore */}
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} />
              Dati Investitore
            </h3>

            <div className="form-group">
              <label htmlFor="investorId" className="form-label">
                Seleziona Investitore *
              </label>
              <select
                id="investorId"
                value={formData.investorId}
                onChange={(e) => handleInvestorChange(e.target.value)}
                className={`form-select ${errors.investorId ? 'error' : ''}`}
              >
                <option value="">-- Seleziona un investitore --</option>
                {mockInvestors.map(investor => (
                  <option key={investor.id} value={investor.id}>
                    {investor.name} - {investor.email}
                  </option>
                ))}
              </select>
              {errors.investorId && <span className="error-message">{errors.investorId}</span>}
            </div>

            {formData.investorId && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="investorName" className="form-label">Nome/Ragione Sociale *</label>
                    <input
                      type="text"
                      id="investorName"
                      value={formData.investorName}
                      onChange={(e) => handleInputChange('investorName', e.target.value)}
                      className={`form-input ${errors.investorName ? 'error' : ''}`}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="investorEmail" className="form-label">Email *</label>
                    <input
                      type="email"
                      id="investorEmail"
                      value={formData.investorEmail}
                      onChange={(e) => handleInputChange('investorEmail', e.target.value)}
                      className={`form-input ${errors.investorEmail ? 'error' : ''}`}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="investorCompany" className="form-label">Azienda</label>
                    <input
                      type="text"
                      id="investorCompany"
                      value={formData.investorCompany || ''}
                      onChange={(e) => handleInputChange('investorCompany', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="investorVAT" className="form-label">P.IVA/CF</label>
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

                <div className="form-group">
                  <label htmlFor="investorAddress" className="form-label">Indirizzo Completo</label>
                  <input
                    type="text"
                    id="investorAddress"
                    value={formData.investorAddress || ''}
                    onChange={(e) => handleInputChange('investorAddress', e.target.value)}
                    className="form-input"
                    placeholder="Via, CAP, Città, Provincia"
                  />
                </div>
              </>
            )}
          </div>

          {/* Sezione LOI */}
          <div className="form-section">
            <h3 className="section-title">
              <FileText size={18} />
              Dettagli LOI
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="loiNumber" className="form-label">Numero LOI *</label>
                <input
                  type="text"
                  id="loiNumber"
                  value={formData.loiNumber}
                  onChange={(e) => handleInputChange('loiNumber', e.target.value)}
                  className={`form-input ${errors.loiNumber ? 'error' : ''}`}
                />
              </div>
              <div className="form-group">
                <label htmlFor="loiDate" className="form-label">
                  <Calendar size={16} />
                  Data LOI
                </label>
                <input
                  type="date"
                  id="loiDate"
                  value={formData.loiDate}
                  onChange={(e) => handleInputChange('loiDate', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expiryDate" className="form-label">
                <Calendar size={16} />
                Data Scadenza LOI
              </label>
              <input
                type="date"
                id="expiryDate"
                value={formData.expiryDate}
                onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                className="form-input"
              />
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
                <label htmlFor="sfpClass" className="form-label">Classe SFP</label>
                <select
                  id="sfpClass"
                  value={formData.sfpClass}
                  onChange={(e) => handleInputChange('sfpClass', e.target.value)}
                  className="form-select"
                >
                  <option value="A">Classe A - Sconto 20% (30 giorni)</option>
                  <option value="B">Classe B - Sconto 15% (60 giorni)</option>
                  <option value="C">Classe C - Sconto 10% (90 giorni)</option>
                </select>
                <small className="form-helper">
                  Scadenza: {getSFPClassInfo(formData.sfpClass).deadline} | Sconto: {getSFPClassInfo(formData.sfpClass).discount}%
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="sfpValue" className="form-label">Valore SFP *</label>
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
            </div>

            <div className="value-calculation">
              <div className="calc-row">
                <span>Valore SFP:</span>
                <strong>{formatCurrency(formData.sfpValue)}</strong>
              </div>
              <div className="calc-row discount">
                <span>Sconto ({formData.discountPercentage}%):</span>
                <strong>- {formatCurrency(calculateDiscount())}</strong>
              </div>
              <div className="calc-row total">
                <span>Importo da Versare:</span>
                <strong>{formatCurrency(calculateNetAmount())}</strong>
              </div>
              <div className="calc-row tax">
                <span>Detrazione Fiscale (30%):</span>
                <strong>{formatCurrency(calculateNetAmount() * 0.3)}</strong>
              </div>
            </div>
          </div>

          {/* Sezione Azienda */}
          <div className="form-section">
            <h3 className="section-title">
              <Building size={18} />
              Dati Società Emittente
            </h3>

            <div className="form-group">
              <label htmlFor="companyFullName" className="form-label">Denominazione Completa</label>
              <input
                type="text"
                id="companyFullName"
                value={formData.companyFullName}
                onChange={(e) => handleInputChange('companyFullName', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyAddress" className="form-label">Sede Legale</label>
                <input
                  type="text"
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyVAT" className="form-label">P.IVA</label>
                <input
                  type="text"
                  id="companyVAT"
                  value={formData.companyVAT}
                  onChange={(e) => handleInputChange('companyVAT', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="companyCapital" className="form-label">Capitale Sociale</label>
              <input
                type="text"
                id="companyCapital"
                value={formData.companyCapital}
                onChange={(e) => handleInputChange('companyCapital', e.target.value)}
                className="form-input"
              />
            </div>
          </div>

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
              Genera Documento LOI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

