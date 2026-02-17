"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, User, Building, FileText, Calendar, DollarSign, Percent, Euro } from 'lucide-react';
import { LOI, LOIFormData } from '../types/loi';
import { mockInvestors } from '../data/mockInvestors';
import { formatCurrency } from '../utils/formatUtils';
import './LOIForm.css';

interface LOIFormProps {
  loi: LOI | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: LOIFormData) => void;
  mode: 'create' | 'edit';
}

export default function LOIForm({ loi, isOpen, onClose, onSave, mode }: LOIFormProps) {
  const [formData, setFormData] = useState<Partial<LOIFormData>>({
    investorId: '',
    investorName: '',
    investorEmail: '',
    investorCompany: '',
    investorPosition: '',
    loiNumber: '',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Smart Equity Srl',
    companyFullName: 'Smart Equity Srl Startup Innovativa',
    sfpClass: 'B',
    sfpValue: 0,
    discountPercentage: 15,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    subscriptionDate: new Date().toISOString().split('T')[0],
    subscriptionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    loiSentDate: '',
    loiSignedDate: '',
    loiExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
    priority: 'medium',
    companyLegalAddress: 'Via Example 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: 'REA RM-123456',
    companyVAT: 'IT12345678901',
    companyCapital: '€ 10.000',
    taxBenefitPercentage: 30,
    taxBenefitValue: 0,
    documentsProvided: {
      companyRegistration: false,
      investorDeck: false,
      regulation: false
    },
    paymentMethod: 'bank_transfer',
    bankAccount: '',
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    notes: '',
    internalNotes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Popolamento form in modalità edit
  useEffect(() => {
    if (loi && mode === 'edit') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, updatedAt, createdBy, lastModifiedBy, ...restLoi } = loi;
      setFormData(restLoi);
    } else {
      // Reset form per modalità create
      const nextNumber = `SFP-2025-${String(Date.now()).slice(-3).padStart(3, '0')}`;
      setFormData({
        investorId: '',
        investorName: '',
        investorEmail: '',
        investorCompany: '',
        investorPosition: '',
        loiNumber: nextNumber,
        title: 'Lettera d\'intenti SFP 2025',
        companyName: 'Smart Equity Srl',
        companyFullName: 'Smart Equity Srl Startup Innovativa',
        sfpClass: 'B',
        sfpValue: 0,
        discountPercentage: 15,
        conversionDate: '31/12/2026',
        maxTotalValue: 150000,
        ticketSize: 5000,
        subscriptionDate: new Date().toISOString().split('T')[0],
        subscriptionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        loiSentDate: '',
        loiSignedDate: '',
        loiExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        priority: 'medium',
        companyLegalAddress: 'Via Example 123',
        companyCAP: '00100',
        companyCity: 'Roma',
        companyRegistration: 'REA RM-123456',
        companyVAT: 'IT12345678901',
        companyCapital: '€ 10.000',
        taxBenefitPercentage: 30,
        taxBenefitValue: 0,
        documentsProvided: {
          companyRegistration: false,
          investorDeck: false,
          regulation: false
        },
        paymentMethod: 'bank_transfer',
        bankAccount: '',
        confidentialityPeriod: 24,
        competentCourt: 'Tribunale di Roma',
        notes: '',
        internalNotes: ''
      });
    }
    setErrors({});
  }, [loi, mode, isOpen]);

  // Quando si seleziona un investitore, popola i dati
  const handleInvestorChange = (investorId: string) => {
    const investor = mockInvestors.find(inv => inv.id === investorId);
    if (investor) {
      setFormData(prev => ({
        ...prev,
        investorId: investor.id,
        investorName: investor.name,
        investorEmail: investor.email,
        investorCompany: investor.company || ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.investorId) {
      newErrors.investorId = 'Seleziona un investitore';
    }
    if (!formData.loiNumber?.trim()) {
      newErrors.loiNumber = 'Il numero LOI è obbligatorio';
    }
    if (!formData.loiExpiryDate) {
      newErrors.loiExpiryDate = 'La data di scadenza è obbligatoria';
    }
    if (!formData.sfpValue || formData.sfpValue <= 0) {
      newErrors.sfpValue = 'Il valore SFP deve essere maggiore di 0';
    }
    if (formData.discountPercentage && (formData.discountPercentage < 0 || formData.discountPercentage > 100)) {
      newErrors.discountPercentage = 'Lo sconto deve essere tra 0 e 100%';
    }
    if (formData.status === 'signed' && !formData.loiSignedDate) {
      newErrors.loiSignedDate = 'La data di firma è obbligatoria per LOI firmate';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof LOIFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Rimuovi errore quando l'utente inizia a correggere
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simula un delay per il salvataggio
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Calcola il valore del beneficio fiscale
      const taxBenefitValue = (formData.sfpValue || 0) * ((formData.taxBenefitPercentage || 0) / 100);
      
      // Prepara i dati completi per il salvataggio
      const completeFormData: LOIFormData = {
        ...formData as LOIFormData,
        taxBenefitValue
      };
      
      onSave(completeFormData);
      onClose();
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const calculateNetValue = () => {
    const discount = (formData.sfpValue || 0) * ((formData.discountPercentage || 0) / 100);
    return (formData.sfpValue || 0) - discount;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content loi-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FileText size={24} />
            {mode === 'create' ? 'Nuova Lettera di Intenti' : 'Modifica LOI'}
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
              Informazioni Investitore
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
                disabled={mode === 'edit'}
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
              <div className="investor-info-display">
                <div className="info-item">
                  <strong>Nome:</strong> {formData.investorName}
                </div>
                <div className="info-item">
                  <strong>Email:</strong> {formData.investorEmail}
                </div>
                {formData.investorCompany && (
                  <div className="info-item">
                    <strong>Azienda:</strong> {formData.investorCompany}
                  </div>
                )}
              </div>
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
                <label htmlFor="loiNumber" className="form-label">
                  Numero LOI *
                </label>
                <input
                  type="text"
                  id="loiNumber"
                  value={formData.loiNumber}
                  onChange={(e) => handleInputChange('loiNumber', e.target.value)}
                  className={`form-input ${errors.loiNumber ? 'error' : ''}`}
                  placeholder="SFP-2025-001"
                />
                {errors.loiNumber && <span className="error-message">{errors.loiNumber}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="status" className="form-label">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="form-select"
                >
                  <option value="draft">Bozza</option>
                  <option value="sent">Inviata</option>
                  <option value="signed">Firmata</option>
                  <option value="expired">Scaduta</option>
                  <option value="rejected">Rifiutata</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="loiSentDate" className="form-label">
                  <Calendar size={16} />
                  Data Invio
                </label>
                <input
                  type="date"
                  id="loiSentDate"
                  value={formData.loiSentDate || ''}
                  onChange={(e) => handleInputChange('loiSentDate', e.target.value)}
                  className={`form-input ${errors.loiSentDate ? 'error' : ''}`}
                />
                {errors.loiSentDate && <span className="error-message">{errors.loiSentDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="loiExpiryDate" className="form-label">
                  <Calendar size={16} />
                  Data Scadenza *
                </label>
                <input
                  type="date"
                  id="loiExpiryDate"
                  value={formData.loiExpiryDate || ''}
                  onChange={(e) => handleInputChange('loiExpiryDate', e.target.value)}
                  className={`form-input ${errors.loiExpiryDate ? 'error' : ''}`}
                />
                {errors.loiExpiryDate && <span className="error-message">{errors.loiExpiryDate}</span>}
              </div>
            </div>

            {formData.status === 'signed' && (
              <div className="form-group">
                <label htmlFor="loiSignedDate" className="form-label">
                  <Calendar size={16} />
                  Data Firma
                </label>
                <input
                  type="date"
                  id="loiSignedDate"
                  value={formData.loiSignedDate || ''}
                  onChange={(e) => handleInputChange('loiSignedDate', e.target.value)}
                  className={`form-input ${errors.loiSignedDate ? 'error' : ''}`}
                />
                {errors.loiSignedDate && <span className="error-message">{errors.loiSignedDate}</span>}
              </div>
            )}
          </div>

          {/* Sezione Finanziaria */}
          <div className="form-section">
            <h3 className="section-title">
              <DollarSign size={18} />
              Informazioni Finanziarie
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sfpValue" className="form-label">
                  <Euro size={16} />
                  Valore SFP *
                </label>
                <input
                  type="number"
                  id="sfpValue"
                  value={formData.sfpValue || ''}
                  onChange={(e) => handleInputChange('sfpValue', Number(e.target.value))}
                  className={`form-input ${errors.sfpValue ? 'error' : ''}`}
                  placeholder="10000"
                  min="0"
                  step="100"
                />
                {errors.sfpValue && <span className="error-message">{errors.sfpValue}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="discountPercentage" className="form-label">
                  <Percent size={16} />
                  Sconto (%)
                </label>
                <input
                  type="number"
                  id="discountPercentage"
                  value={formData.discountPercentage || ''}
                  onChange={(e) => handleInputChange('discountPercentage', Number(e.target.value))}
                  className={`form-input ${errors.discountPercentage ? 'error' : ''}`}
                  placeholder="20"
                  min="0"
                  max="100"
                  step="1"
                />
                {errors.discountPercentage && <span className="error-message">{errors.discountPercentage}</span>}
              </div>
            </div>

            {(formData.sfpValue && formData.sfpValue > 0) && (
              <div className="value-calculation">
                <div className="calc-row">
                  <span>Valore SFP:</span>
                  <strong>{formatCurrency(formData.sfpValue || 0)}</strong>
                </div>
                <div className="calc-row discount">
                  <span>Sconto ({formData.discountPercentage || 0}%):</span>
                  <strong>- {formatCurrency((formData.sfpValue || 0) * ((formData.discountPercentage || 0) / 100))}</strong>
                </div>
                <div className="calc-row total">
                  <span>Importo Netto:</span>
                  <strong>{formatCurrency(calculateNetValue())}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Sezione Pagamento */}
          <div className="form-section">
            <h3 className="section-title">
              <Building size={18} />
              Termini di Pagamento
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="subscriptionDeadline" className="form-label">
                  <Calendar size={16} />
                  Scadenza Sottoscrizione
                </label>
                <input
                  type="date"
                  id="subscriptionDeadline"
                  value={formData.subscriptionDeadline || ''}
                  onChange={(e) => handleInputChange('subscriptionDeadline', e.target.value)}
                  className={`form-input ${errors.subscriptionDeadline ? 'error' : ''}`}
                />
                {errors.subscriptionDeadline && <span className="error-message">{errors.subscriptionDeadline}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="paymentMethod" className="form-label">
                  Metodo di Pagamento
                </label>
                <select
                  id="paymentMethod"
                  value={formData.paymentMethod || 'bank_transfer'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="form-select"
                >
                  <option value="bank_transfer">Bonifico Bancario</option>
                  <option value="check">Assegno</option>
                  <option value="cash">Contante</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sezione Note */}
          <div className="form-section">
            <h3 className="section-title">
              <FileText size={18} />
              Note Aggiuntive
            </h3>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Note
              </label>
              <textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="form-textarea"
                placeholder="Aggiungi eventuali note o condizioni speciali..."
                rows={4}
              />
            </div>
          </div>


          {/* Footer Buttons */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              <Save size={18} />
              {isSubmitting ? 'Salvataggio...' : mode === 'create' ? 'Crea LOI' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

