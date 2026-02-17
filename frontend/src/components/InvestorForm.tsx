"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Building, Briefcase, FileText, Globe, Calendar } from 'lucide-react';
import { Investor, InvestorFormData } from '../types/investor';
import './InvestorForm.css';

interface InvestorFormProps {
  investor?: Investor | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (investor: InvestorFormData) => void;
  mode: 'create' | 'edit';
}

export default function InvestorForm({ investor, isOpen, onClose, onSave, mode }: InvestorFormProps) {
  const [formData, setFormData] = useState<InvestorFormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    status: 'active',
    category: 'individual',
    notes: '',
    preferredContactMethod: 'email',
    timezone: 'Europe/Rome',
    lastContactDate: '',
    investorType: 'customer',
    motivation: '',
    linkedin: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (investor && mode === 'edit') {
      setFormData({
        name: investor.name,
        email: investor.email,
        phone: investor.phone || '',
        company: investor.company || '',
        position: investor.position || '',
        status: investor.status,
        category: investor.category,
        notes: investor.notes || '',
        preferredContactMethod: investor.preferredContactMethod,
        timezone: investor.timezone || 'Europe/Rome',
        lastContactDate: investor.lastContactDate || '',
        investorType: investor.investorType || 'customer',
        motivation: investor.motivation || '',
        linkedin: investor.linkedin || ''
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        status: 'active',
        category: 'individual',
        notes: '',
        preferredContactMethod: 'email',
        timezone: 'Europe/Rome',
        lastContactDate: '',
        investorType: 'customer',
        motivation: '',
        linkedin: ''
      });
    }
    setErrors({});
  }, [investor, mode, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome è obbligatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email è obbligatoria';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email non valida';
    }

    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Numero di telefono non valido';
    }

    if (formData.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(formData.linkedin)) {
      newErrors.linkedin = 'URL LinkedIn non valido. Formato: https://linkedin.com/in/username';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving investor:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof InvestorFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="investor-form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div className="form-title-section">
            <h2 className="form-title">
              {mode === 'create' ? 'Nuovo Investitore' : 'Modifica Investitore'}
            </h2>
            <p className="form-subtitle">
              {mode === 'create' 
                ? 'Aggiungi un nuovo investitore al tuo portafoglio' 
                : 'Modifica le informazioni dell\'investitore'
              }
            </p>
          </div>
          <button className="close-button" onClick={onClose} title="Chiudi">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="investor-form">
          <div className="form-sections">
            {/* Informazioni Personali */}
            <div className="form-section">
              <h3 className="section-title">
                <User size={18} />
                Informazioni Personali
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name" className="form-label">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="Es. Mario Rossi"
                  />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    placeholder="mario.rossi@example.com"
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone" className="form-label">
                    <Phone size={16} />
                    Telefono
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`form-input ${errors.phone ? 'error' : ''}`}
                    placeholder="+39 333 123 4567"
                  />
                  {errors.phone && <span className="error-message">{errors.phone}</span>}
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
                    <option value="active">Attivo</option>
                    <option value="pending">In Attesa</option>
                    <option value="inactive">Inattivo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Informazioni Investitore */}
            <div className="form-section">
              <h3 className="section-title">
                <Building size={18} />
                Informazioni Investitore
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company" className="form-label">
                    Azienda
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="form-input"
                    placeholder="Es. Venture Capital Partners"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="position" className="form-label">
                    <Briefcase size={16} />
                    Posizione
                  </label>
                  <input
                    type="text"
                    id="position"
                    value={formData.position}
                    onChange={(e) => handleInputChange('position', e.target.value)}
                    className="form-input"
                    placeholder="Es. Managing Partner"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category" className="form-label">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="form-select"
                  >
                    <option value="individual">Individuale</option>
                    <option value="angel">Angel Investor</option>
                    <option value="vc">Venture Capital</option>
                    <option value="institutional">Istituzionale</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="investorType" className="form-label">
                    Tipologia Investitore
                  </label>
                  <select
                    id="investorType"
                    value={formData.investorType || 'customer'}
                    onChange={(e) => handleInputChange('investorType', e.target.value)}
                    className="form-select"
                  >
                    <option value="customer">Investor Customer</option>
                    <option value="supplier">Investor Supplier</option>
                    <option value="business_development">Investor Business Development</option>
                    <option value="professionals">Investor Professionals (Legal, Chartered Accountant)</option>
                    <option value="member_get_member">Investor &quot;Member Get Member&quot;</option>
                    <option value="exit">Investor &quot;Exit&quot;</option>
                    <option value="influencer">Investor Influencer</option>
                    <option value="brand_awareness">Investor Brand Awareness / Advisor (Trust)</option>
                    <option value="recruiter">Investor Recruiter</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="linkedin" className="form-label">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    id="linkedin"
                    value={formData.linkedin || ''}
                    onChange={(e) => handleInputChange('linkedin', e.target.value)}
                    className={`form-input ${errors.linkedin ? 'error' : ''}`}
                    placeholder="https://linkedin.com/in/username"
                  />
                  {errors.linkedin && <span className="error-message">{errors.linkedin}</span>}
                </div>
              </div>
            </div>

            {/* Informazioni Contatto */}
            <div className="form-section">
              <h3 className="section-title">
                <Mail size={18} />
                Informazioni Contatto
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="preferredContactMethod" className="form-label">
                    Metodo di Contatto Preferito
                  </label>
                  <select
                    id="preferredContactMethod"
                    value={formData.preferredContactMethod}
                    onChange={(e) => handleInputChange('preferredContactMethod', e.target.value)}
                    className="form-select"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Telefono</option>
                    <option value="meeting">Riunione</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="timezone" className="form-label">
                    <Globe size={16} />
                    Fuso Orario
                  </label>
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="form-select"
                  >
                    <option value="Europe/Rome">Europa/Roma</option>
                    <option value="Europe/London">Europa/Londra</option>
                    <option value="Europe/Paris">Europa/Parigi</option>
                    <option value="America/New_York">America/New York</option>
                    <option value="America/Los_Angeles">America/Los Angeles</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="lastContactDate" className="form-label">
                    <Calendar size={16} />
                    Ultimo Contatto
                  </label>
                  <input
                    type="date"
                    id="lastContactDate"
                    value={formData.lastContactDate}
                    onChange={(e) => handleInputChange('lastContactDate', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Motivazione e Note */}
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} />
                Motivazione e Note
              </h3>
              
              <div className="form-group">
                <label htmlFor="motivation" className="form-label">
                  Motivazione
                </label>
                <textarea
                  id="motivation"
                  value={formData.motivation || ''}
                  onChange={(e) => handleInputChange('motivation', e.target.value)}
                  className="form-textarea"
                  placeholder="Descrivi la motivazione dell'investitore, i suoi obiettivi e le sue aspettative..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes" className="form-label">
                  Note Aggiuntive
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="form-textarea"
                  placeholder="Aggiungi note, preferenze o informazioni aggiuntive sull'investitore..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
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
              {isSubmitting ? 'Salvataggio...' : (mode === 'create' ? 'Crea Investitore' : 'Salva Modifiche')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
