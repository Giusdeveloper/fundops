"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Edit, 
  Mail, 
  Phone, 
  Calendar, 
  Building, 
  Briefcase, 
  FileText, 
  Globe,
  TrendingUp,
  Users,
  Activity,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { Investor, InvestorFormData } from '../../../../types/investor';
import { getInvestorById, getInvestmentsByInvestorId } from '../../../../data/mockInvestors';
import InvestorForm from '../../../../components/InvestorForm';
import './investor-detail.css';

export default function InvestorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const investorId = params.id as string;
  
  const [investor, setInvestor] = useState<Investor | null>(getInvestorById(investorId) || null);
  const [showForm, setShowForm] = useState(false);

  if (!investor) {
    return (
      <div className="investor-detail-page">
        <div className="error-state">
          <h1>Investitore non trovato</h1>
          <p>L&apos;investitore che stai cercando non esiste o è stato rimosso.</p>
          <button 
            className="btn-primary"
            onClick={() => router.push('/investitori')}
          >
            <ArrowLeft size={18} />
            Torna alla Lista
          </button>
        </div>
      </div>
    );
  }

  const investments = getInvestmentsByInvestorId(investorId);

  const handleSave = (updatedData: InvestorFormData) => {
    // In a real app, this would update the database
    setInvestor(prev => prev ? { 
      ...prev, 
      ...updatedData, 
      updatedAt: new Date().toISOString() 
    } : null);
    setShowForm(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Attivo', class: 'status-active' },
      pending: { label: 'In Attesa', class: 'status-pending' },
      inactive: { label: 'Inattivo', class: 'status-inactive' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, class: '' };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const getCategoryLabel = (category: string) => {
    const categoryConfig = {
      angel: 'Angel Investor',
      vc: 'Venture Capital',
      institutional: 'Istituzionale',
      individual: 'Individuale'
    };
    return categoryConfig[category as keyof typeof categoryConfig] || category;
  };

  const getInvestorTypeLabel = (investorType?: string) => {
    if (!investorType) return 'N/A';
    const typeConfig = {
      customer: 'Customer',
      supplier: 'Supplier',
      business_development: 'Business Development',
      professionals: 'Professionals',
      member_get_member: 'Member Get Member',
      exit: 'Exit',
      influencer: 'Influencer',
      brand_awareness: 'Brand Awareness',
      recruiter: 'Recruiter'
    };
    return typeConfig[investorType as keyof typeof typeConfig] || investorType;
  };

  const getContactMethodLabel = (method: string) => {
    const methodConfig = {
      email: 'Email',
      phone: 'Telefono',
      meeting: 'Riunione'
    };
    return methodConfig[method as keyof typeof methodConfig] || method;
  };

  return (
    <div className="investor-detail-page">
      {/* Header */}
      <div className="investor-header">
        <div className="header-left">
          <button 
            className="back-button"
            onClick={() => router.push('/investitori')}
          >
            <ArrowLeft size={18} />
            Torna alla Lista
          </button>
          
          <div className="investor-title-section">
            <h1 className="investor-name">{investor.name}</h1>
            <p className="investor-subtitle">
              {investor.position} {investor.company && `• ${investor.company}`}
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={() => setShowForm(true)}
          >
            <Edit size={18} />
            Modifica
          </button>
        </div>
      </div>

      <div className="investor-content">
        {/* Overview Cards */}
        <div className="overview-cards">
          <div className="overview-card">
            <div className="card-icon">
              <Building size={24} />
            </div>
            <div className="card-content">
              <div className="card-value">{investor.company || 'N/A'}</div>
              <div className="card-label">Azienda</div>
            </div>
          </div>

          <div className="overview-card">
            <div className="card-icon">
              <Briefcase size={24} />
            </div>
            <div className="card-content">
              <div className="card-value">{investor.position || 'N/A'}</div>
              <div className="card-label">Posizione</div>
            </div>
          </div>

          <div className="overview-card">
            <div className="card-icon">
              <Calendar size={24} />
            </div>
            <div className="card-content">
              <div className="card-value">
                {investor.lastContactDate ? formatDate(investor.lastContactDate) : 'Mai'}
              </div>
              <div className="card-label">Ultimo Contatto</div>
            </div>
          </div>

          <div className="overview-card">
            <div className="card-icon">
              <Activity size={24} />
            </div>
            <div className="card-content">
              <div className="card-value">{getCategoryLabel(investor.category)}</div>
              <div className="card-label">Categoria</div>
            </div>
          </div>
        </div>

        <div className="investor-details-grid">
          {/* Informazioni Personali */}
          <div className="detail-section">
            <h2 className="section-title">
              <Users size={20} />
              Informazioni Personali
            </h2>
            
            <div className="detail-items">
              <div className="detail-item">
                <div className="detail-label">
                  <Mail size={16} />
                  Email
                </div>
                <div className="detail-value">{investor.email}</div>
              </div>

              {investor.phone && (
                <div className="detail-item">
                  <div className="detail-label">
                    <Phone size={16} />
                    Telefono
                  </div>
                  <div className="detail-value">{investor.phone}</div>
                </div>
              )}

              <div className="detail-item">
                <div className="detail-label">
                  <Globe size={16} />
                  Fuso Orario
                </div>
                <div className="detail-value">{investor.timezone || 'Europe/Rome'}</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">Status</div>
                <div className="detail-value">{getStatusBadge(investor.status)}</div>
              </div>
            </div>
          </div>

          {/* Informazioni Aziendali */}
          <div className="detail-section">
            <h2 className="section-title">
              <Building size={20} />
              Informazioni Investitore
            </h2>
            
            <div className="detail-items">
              {investor.company && (
                <div className="detail-item">
                  <div className="detail-label">
                    <Building size={16} />
                    Azienda
                  </div>
                  <div className="detail-value">{investor.company}</div>
                </div>
              )}

              {investor.position && (
                <div className="detail-item">
                  <div className="detail-label">
                    <Briefcase size={16} />
                    Posizione
                  </div>
                  <div className="detail-value">{investor.position}</div>
                </div>
              )}

              <div className="detail-item">
                <div className="detail-label">Categoria</div>
                <div className="detail-value">{getCategoryLabel(investor.category)}</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  <Users size={16} />
                  Tipologia Investitore
                </div>
                <div className="detail-value">{getInvestorTypeLabel(investor.investorType)}</div>
              </div>

              {investor.linkedin && (
                <div className="detail-item">
                  <div className="detail-label">
                    <ExternalLink size={16} />
                    LinkedIn
                  </div>
                  <div className="detail-value">
                    <a 
                      href={investor.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="linkedin-link"
                    >
                      {investor.linkedin}
                    </a>
                  </div>
                </div>
              )}

              <div className="detail-item">
                <div className="detail-label">Metodo di Contatto Preferito</div>
                <div className="detail-value">{getContactMethodLabel(investor.preferredContactMethod)}</div>
              </div>
            </div>
          </div>

          {/* Motivazione - Solo se presente */}
          {investor.motivation && (
            <div className="detail-section full-width">
              <h2 className="section-title">
                <MessageSquare size={20} />
                Motivazione
              </h2>
              
              <div className="motivation-content">
                <p>{investor.motivation}</p>
              </div>
            </div>
          )}

          {/* Storico Investimenti - Solo se ci sono investimenti */}
          {investments.length > 0 && (
            <div className="detail-section full-width">
              <h2 className="section-title">
                <TrendingUp size={20} />
                Storico Investimenti
              </h2>
              
              <div className="investments-table">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Importo</th>
                      <th>Progetto</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((investment) => (
                      <tr key={investment.id}>
                        <td>{formatDate(investment.date)}</td>
                        <td className="amount">{formatCurrency(investment.amount)}</td>
                        <td>{investment.projectId || '-'}</td>
                        <td>
                          <span className={`investment-status ${investment.status}`}>
                            {investment.status === 'committed' ? 'Impegnato' : 
                             investment.status === 'transferred' ? 'Trasferito' : 'In Attesa'}
                          </span>
                        </td>
                        <td>{investment.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Note */}
          {investor.notes && (
            <div className="detail-section full-width">
              <h2 className="section-title">
                <FileText size={20} />
                Note
              </h2>
              
              <div className="notes-content">
                <p>{investor.notes}</p>
              </div>
            </div>
          )}

          {/* Attività Recenti */}
          <div className="detail-section full-width">
            <h2 className="section-title">
              <Activity size={20} />
              Attività Recenti
            </h2>
            
            <div className="activity-timeline">
              <div className="activity-item">
                <div className="activity-icon">
                  <Calendar size={16} />
                </div>
                <div className="activity-content">
                  <div className="activity-title">Investitore aggiunto</div>
                  <div className="activity-date">{formatDate(investor.createdAt)}</div>
                </div>
              </div>

              {investor.updatedAt !== investor.createdAt && (
                <div className="activity-item">
                  <div className="activity-icon">
                    <Edit size={16} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">Profilo aggiornato</div>
                    <div className="activity-date">{formatDate(investor.updatedAt)}</div>
                  </div>
                </div>
              )}

              {investor.lastContactDate && (
                <div className="activity-item">
                  <div className="activity-icon">
                    <MessageSquare size={16} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">Ultimo contatto</div>
                    <div className="activity-date">{formatDate(investor.lastContactDate)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <InvestorForm
        investor={investor}
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        mode="edit"
      />
    </div>
  );
}
