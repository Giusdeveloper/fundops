"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Download, Eye, Edit, Trash2, Mail, Phone, Calendar, ExternalLink, Upload, TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react';
import { Investor, InvestorFilters, InvestorFormData } from '../../../types/investor';
import { mockInvestors } from '../../../data/mockInvestors';
import InvestorForm from '../../../components/InvestorForm';
import ImportInvestorsModal from '../../../components/ImportInvestorsModal';
import './investitori.css';

export default function InvestorsPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>(mockInvestors);
  const [filters, setFilters] = useState<InvestorFilters>({
    search: '',
    status: '',
    category: '',
    sortBy: 'name',
    sortOrder: 'asc'
  });
  const [investorTypeFilter, setInvestorTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Statistiche per tipologie
  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    investors.forEach(investor => {
      const type = investor.investorType || 'other';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [investors]);


  const investmentStats = useMemo(() => {
    const totalInvested = investors.reduce((sum, inv) => sum + inv.totalInvested, 0);
    const totalInvestments = investors.reduce((sum, inv) => sum + inv.numberOfInvestments, 0);
    const avgInvestment = investors.filter(i => i.totalInvested > 0).length > 0
      ? totalInvested / investors.filter(i => i.totalInvested > 0).length
      : 0;
    return { totalInvested, totalInvestments, avgInvestment };
  }, [investors]);

  // Anima le barre delle statistiche
  useEffect(() => {
    const bars = document.querySelectorAll('.type-stat-fill');
    bars.forEach((bar) => {
      const percentage = bar.getAttribute('data-percentage');
      if (percentage) {
        (bar as HTMLElement).style.width = `${percentage}%`;
      }
    });
  }, [typeStats]);

  // Filtri e ordinamento
  const filteredInvestors = useMemo(() => {
    let filtered = [...investors];

    // Filtro per ricerca
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(investor => 
        investor.name.toLowerCase().includes(searchLower) ||
        investor.email.toLowerCase().includes(searchLower) ||
        investor.company?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro per status
    if (filters.status) {
      filtered = filtered.filter(investor => investor.status === filters.status);
    }


    // Filtro per tipologia investitore
    if (investorTypeFilter) {
      filtered = filtered.filter(investor => investor.investorType === investorTypeFilter);
    }

    // Ordinamento
    filtered.sort((a, b) => {
      const aValue = a[filters.sortBy];
      const bValue = b[filters.sortBy];

      // Gestione dei valori undefined
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return filters.sortOrder === 'asc' ? 1 : -1;
      if (bValue === undefined) return filters.sortOrder === 'asc' ? -1 : 1;

      // Gestione dei valori stringa
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aLower = aValue.toLowerCase();
        const bLower = bValue.toLowerCase();
        
        if (filters.sortOrder === 'asc') {
          return aLower > bLower ? 1 : -1;
        } else {
          return aLower < bLower ? 1 : -1;
        }
      }

      // Gestione dei valori numerici
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (filters.sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }

      // Fallback per altri tipi
      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [investors, filters, investorTypeFilter]);

  const handleFilterChange = (key: keyof InvestorFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateInvestor = () => {
    setEditingInvestor(null);
    setShowForm(true);
  };

  const handleEditInvestor = (investor: Investor) => {
    setEditingInvestor(investor);
    setShowForm(true);
  };

  const handleViewInvestor = (investorId: string) => {
    router.push(`/investitori/${investorId}`);
  };

  const handleSaveInvestor = (investorData: InvestorFormData) => {
    if (editingInvestor) {
      // Edit existing investor
      setInvestors(prev => prev.map(inv => 
        inv.id === editingInvestor.id 
          ? { ...inv, ...investorData, updatedAt: new Date().toISOString() }
          : inv
      ));
    } else {
      // Create new investor
      const newInvestor: Investor = {
        ...investorData,
        id: `inv-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalInvested: 0,
        numberOfInvestments: 0,
        lastContactDate: new Date().toISOString().split('T')[0]
      };
      setInvestors(prev => [...prev, newInvestor]);
    }
    setShowForm(false);
    setEditingInvestor(null);
  };

  const handleDeleteInvestor = (investorId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo investitore?')) {
      setInvestors(prev => prev.filter(inv => inv.id !== investorId));
    }
  };

  const handleImportInvestors = (importedInvestors: InvestorFormData[]) => {
    const newInvestors: Investor[] = importedInvestors.map(investorData => ({
      ...investorData,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalInvested: 0,
      numberOfInvestments: 0,
      lastContactDate: new Date().toISOString().split('T')[0]
    }));
    
    setInvestors(prev => [...prev, ...newInvestors]);
    setShowImportModal(false);
  };

  const handleExportInvestors = () => {
    const headers = [
      'Nome',
      'Email',
      'Telefono',
      'Azienda',
      'Posizione',
      'Status',
      'Categoria',
      'Tipologia Investitore',
      'Metodo Contatto Preferito',
      'Fuso Orario',
      'Ultimo Contatto',
      'Motivazione',
      'LinkedIn',
      'Note',
      'Totale Investito (€)',
      'Numero Investimenti',
      'Data Creazione',
      'Data Ultimo Aggiornamento'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredInvestors.map(investor => [
        `"${investor.name}"`,
        `"${investor.email}"`,
        `"${investor.phone || ''}"`,
        `"${investor.company || ''}"`,
        `"${investor.position || ''}"`,
        `"${getStatusLabel(investor.status)}"`,
        `"${getCategoryLabel(investor.category)}"`,
        `"${getInvestorTypeLabel(investor.investorType)}"`,
        `"${getContactMethodLabel(investor.preferredContactMethod)}"`,
        `"${investor.timezone || ''}"`,
        `"${investor.lastContactDate || ''}"`,
        `"${investor.motivation || ''}"`,
        `"${investor.linkedin || ''}"`,
        `"${investor.notes || ''}"`,
        investor.totalInvested.toString(),
        investor.numberOfInvestments.toString(),
        `"${formatDate(investor.createdAt)}"`,
        `"${formatDate(investor.updatedAt)}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `investitori_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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


  const getInvestorTypeLabel = (investorType?: string) => {
    if (!investorType) return '-';
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

  const getStatusLabel = (status: string) => {
    const statusConfig = {
      active: 'Attivo',
      pending: 'In Attesa',
      inactive: 'Inattivo'
    };
    return statusConfig[status as keyof typeof statusConfig] || status;
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

  const getContactMethodLabel = (method: string) => {
    const methodConfig = {
      email: 'Email',
      phone: 'Telefono',
      meeting: 'Riunione'
    };
    return methodConfig[method as keyof typeof methodConfig] || method;
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
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  return (
    <div className="investors-page">
      {/* Header */}
      <div className="investors-header">
        <div className="investors-title-section">
          <h1 className="investors-title">Gestione Investitori</h1>
          <p className="investors-subtitle">Gestisci il tuo portafoglio di investitori</p>
        </div>
        <div className="investors-actions">
          <button className="btn-secondary" onClick={handleExportInvestors}>
            <Download size={18} />
            Esporta
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={18} />
            Importa
          </button>
          <button className="btn-primary" onClick={handleCreateInvestor}>
            <Plus size={18} />
            Nuovo Investitore
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="investors-filters">
        <div className="filters-row">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Cerca per nome, email o azienda..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
            title="Filtra per status"
          >
            <option value="">Tutti gli status</option>
            <option value="active">Attivo</option>
            <option value="pending">In Attesa</option>
            <option value="inactive">Inattivo</option>
          </select>


          <select
            value={investorTypeFilter}
            onChange={(e) => setInvestorTypeFilter(e.target.value)}
            className="filter-select"
            title="Filtra per tipologia"
          >
            <option value="">Tutte le tipologie</option>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="business_development">Business Development</option>
            <option value="professionals">Professionals</option>
            <option value="member_get_member">Member Get Member</option>
            <option value="exit">Exit</option>
            <option value="influencer">Influencer</option>
            <option value="brand_awareness">Brand Awareness</option>
            <option value="recruiter">Recruiter</option>
          </select>

          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setFilters(prev => ({ 
                ...prev, 
                sortBy: sortBy as InvestorFilters['sortBy'], 
                sortOrder: sortOrder as InvestorFilters['sortOrder'] 
              }));
            }}
            className="filter-select"
            title="Ordina per"
          >
            <option value="name-asc">Nome (A-Z)</option>
            <option value="name-desc">Nome (Z-A)</option>
            <option value="totalInvested-desc">Investimento (Alto-Basso)</option>
            <option value="totalInvested-asc">Investimento (Basso-Alto)</option>
            <option value="createdAt-desc">Data creazione (Recenti)</option>
            <option value="createdAt-asc">Data creazione (Vecchi)</option>
          </select>
        </div>
      </div>

      {/* Statistiche Avanzate */}
      <div className="advanced-stats">
        <div className="stats-section">
          <h3 className="stats-section-title">
            <BarChart3 size={18} />
            Distribuzione per Tipologia
          </h3>
          <div className="type-stats-grid">
            {Object.entries(typeStats).map(([type, count]) => (
              <div key={type} className="type-stat-card">
                <div className="type-stat-label">{getInvestorTypeLabel(type)}</div>
                <div className="type-stat-value">{count}</div>
                <div className="type-stat-bar">
                  <div 
                    className="type-stat-fill" 
                    data-percentage={(count / investors.length) * 100}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <h3 className="stats-section-title">
            <TrendingUp size={18} />
            Metriche Investimenti
          </h3>
          <div className="investment-stats-grid">
            <div className="investment-stat-card">
              <div className="stat-icon">
                <DollarSign size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{formatCurrency(investmentStats.totalInvested)}</div>
                <div className="stat-label">Totale Investito</div>
              </div>
            </div>
            <div className="investment-stat-card">
              <div className="stat-icon">
                <TrendingUp size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{investmentStats.totalInvestments}</div>
                <div className="stat-label">Numero Investimenti</div>
              </div>
            </div>
            <div className="investment-stat-card">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{formatCurrency(investmentStats.avgInvestment)}</div>
                <div className="stat-label">Media per Investitore</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabella Investitori */}
      <div className="investors-table-container">
        <table className="investors-table">
          <thead>
            <tr>
              <th>Investitore</th>
              <th>Contatto</th>
              <th>Investimento</th>
              <th>Status</th>
              <th>Tipologia</th>
              <th>Ultimo Contatto</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvestors.map((investor) => (
              <tr key={investor.id} className="investor-row">
                <td>
                  <div className="investor-info">
                    <div className="investor-name">{investor.name}</div>
                    <div className="investor-position">{investor.position}</div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    <div className="contact-item">
                      <Mail size={14} />
                      <span>{investor.email}</span>
                    </div>
                    {investor.phone && (
                      <div className="contact-item">
                        <Phone size={14} />
                        <span>{investor.phone}</span>
                      </div>
                    )}
                    {investor.linkedin && (
                      <div className="contact-item">
                        <ExternalLink size={14} />
                        <a 
                          href={investor.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="linkedin-link"
                        >
                          LinkedIn
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="investment-info">
                    {investor.totalInvested > 0 ? (
                      <>
                        <div className="investment-amount">{formatCurrency(investor.totalInvested)}</div>
                        <div className="investment-count">{investor.numberOfInvestments} investimenti</div>
                      </>
                    ) : (
                      <span className="no-investment">Potenziale investitore</span>
                    )}
                  </div>
                </td>
                <td>{getStatusBadge(investor.status)}</td>
                <td>
                  <span className="investor-type-badge">
                    {getInvestorTypeLabel(investor.investorType)}
                  </span>
                </td>
                <td>
                  {investor.lastContactDate ? (
                    <div className="last-contact">
                      <Calendar size={14} />
                      <span>{formatDate(investor.lastContactDate)}</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="action-btn view-btn" 
                      title="Visualizza"
                      onClick={() => handleViewInvestor(investor.id)}
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      className="action-btn edit-btn" 
                      title="Modifica"
                      onClick={() => handleEditInvestor(investor)}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      title="Elimina"
                      onClick={() => handleDeleteInvestor(investor.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredInvestors.length === 0 && (
          <div className="no-results">
            <p>Nessun investitore trovato con i filtri selezionati.</p>
          </div>
        )}
      </div>

      {/* Statistiche */}
      <div className="investors-stats">
        <div className="stat-card">
          <div className="stat-value">{investors.length}</div>
          <div className="stat-label">Totale Investitori</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{investors.filter(i => i.status === 'active').length}</div>
          <div className="stat-label">Investitori Attivi</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(investors.reduce((sum, i) => sum + i.totalInvested, 0))}</div>
          <div className="stat-label">Totale Investito</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{investors.filter(i => i.status === 'pending').length}</div>
          <div className="stat-label">In Attesa</div>
        </div>
      </div>

      {/* Form Modal */}
      <InvestorForm
        investor={editingInvestor}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingInvestor(null);
        }}
        onSave={handleSaveInvestor}
        mode={editingInvestor ? 'edit' : 'create'}
      />

      {/* Import Modal */}
      <ImportInvestorsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportInvestors}
      />
    </div>
  );
}
