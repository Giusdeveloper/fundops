"use client";

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Eye, 
  Mail, 
  Calendar, 
  AlertTriangle,
  FileText,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  FileUp
} from 'lucide-react';
import { LOI, LOIFilters } from '../../../types/loi';
import { mockLOIs, getLOIStats, getPendingLOIs } from '../../../data/mockLOI';
import { mockInvestors } from '../../../data/mockInvestors';
import { loiService } from '../../../services/loiService';
import { investorService } from '../../../services/investorService';
import { testSupabaseConnection, testTablesExistence, initializeDatabase } from '../../../utils/testSupabaseConnection';
import LOIFormComplete from '../../../components/LOIFormComplete';
import { previewLOIDocument } from '../../../utils/pdfGenerator';
import type { LOIDocumentData } from '../../../utils/loiDocumentTemplate';
import { formatCurrency, formatDate } from '../../../utils/formatUtils';
import './loi.css';

export default function LOIPage() {
  const [lois, setLois] = useState<LOI[]>([]);
  const [investors, setInvestors] = useState(mockInvestors);
  const [loading, setLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(false);
  const [filters, setFilters] = useState<LOIFilters>({
    search: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [showForm, setShowForm] = useState(false);

  // Carica dati iniziali
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Testa la connessione a Supabase
        const isConnected = await testSupabaseConnection();
        
        if (isConnected) {
          // Testa se le tabelle esistono
          const tablesExist = await testTablesExistence();
          
          if (tablesExist.investors && tablesExist.lois) {
            // Prova a caricare da Supabase
            const [loisData, investorsData] = await Promise.all([
              loiService.getAllLOIs(),
              investorService.getAllInvestors()
            ]);
            
            if (loisData.length > 0 || investorsData.length > 0) {
              setLois(loisData);
              setInvestors(investorsData);
              setUseSupabase(true);
            } else {
              // Inizializza con dati di esempio se vuoto
              await initializeDatabase();
              const [newLoisData, newInvestorsData] = await Promise.all([
                loiService.getAllLOIs(),
                investorService.getAllInvestors()
              ]);
              setLois(newLoisData);
              setInvestors(newInvestorsData);
              setUseSupabase(true);
            }
          } else {
            console.warn('⚠️ Tabelle non trovate, usando dati locali');
            setLois(mockLOIs);
            setInvestors(mockInvestors);
            setUseSupabase(false);
          }
        } else {
          console.warn('⚠️ Connessione Supabase fallita, usando dati locali');
          setLois(mockLOIs);
          setInvestors(mockInvestors);
          setUseSupabase(false);
        }
      } catch (error) {
        console.error('❌ Errore nel caricamento dei dati:', error);
        // Fallback ai mock data in caso di errore
        setLois(mockLOIs);
        setInvestors(mockInvestors);
        setUseSupabase(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Statistiche
  const stats = useMemo(() => getLOIStats(), []);
  const pendingLOIs = useMemo(() => getPendingLOIs(), []);

  // Ottieni investitori con stato LOI
  const investorsWithLOIStatus = useMemo(() => {
    return investors.map(investor => {
      // Trova LOI per questo investitore
      const investorLOIs = lois.filter(loi => loi.investorId === investor.id);
      const latestLOI = investorLOIs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return {
        ...investor,
        loiStatus: latestLOI ? latestLOI.status : 'none',
        loiNumber: latestLOI ? latestLOI.loiNumber : null,
        loiDate: latestLOI ? latestLOI.createdAt : null,
        loiExpiryDate: latestLOI ? latestLOI.loiExpiryDate : null,
        loiValue: latestLOI ? latestLOI.sfpValue : null,
        loiClass: latestLOI ? latestLOI.sfpClass : null,
        loiPriority: latestLOI ? latestLOI.priority : null,
        loiId: latestLOI ? latestLOI.id : null
      };
    });
  }, [investors, lois]);

  // Filtri e ordinamento per investitori
  const filteredInvestors = useMemo(() => {
    let filtered = [...investorsWithLOIStatus];

    // Filtro per ricerca
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(investor => 
        investor.name.toLowerCase().includes(searchLower) ||
        investor.email.toLowerCase().includes(searchLower) ||
        (investor.company && investor.company.toLowerCase().includes(searchLower)) ||
        (investor.loiNumber && investor.loiNumber.toLowerCase().includes(searchLower))
      );
    }

    // Filtro per status LOI
    if (filters.status) {
      filtered = filtered.filter(investor => investor.loiStatus === filters.status);
    }


    // Ordinamento
    filtered.sort((a, b) => {
      let aValue: string | number | undefined, bValue: string | number | undefined;
      
      switch (filters.sortBy) {
        case 'investorName':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'loiDate' as const:
          aValue = a.loiDate || undefined;
          bValue = b.loiDate || undefined;
          break;
        case 'loiExpiryDate':
          aValue = a.loiExpiryDate || undefined;
          bValue = b.loiExpiryDate || undefined;
          break;
        default:
          aValue = a.createdAt;
          bValue = b.createdAt;
      }

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return filters.sortOrder === 'asc' ? 1 : -1;
      if (bValue === undefined) return filters.sortOrder === 'asc' ? -1 : 1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aLower = aValue.toLowerCase();
        const bLower = bValue.toLowerCase();
        
        if (filters.sortOrder === 'asc') {
          return aLower > bLower ? 1 : -1;
        } else {
          return aLower < bLower ? 1 : -1;
        }
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (filters.sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [investorsWithLOIStatus, filters]);

  const handleFilterChange = (key: keyof LOIFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };


  const handleCreateLOI = () => {
    setShowForm(true);
  };

  const handleViewLOI = (loiId: string) => {
    const loi = lois.find(l => l.id === loiId);
    if (loi) {
      // Converti la LOI in LOIDocumentData per l'anteprima
      const loiData: LOIDocumentData = {
        investorId: loi.investorId,
        investorName: loi.investorName,
        investorEmail: loi.investorEmail,
        investorCompany: loi.investorCompany,
        investorAddress: '',
        investorVAT: '',
        logoUrl: '',
        loiNumber: loi.loiNumber,
        loiDate: loi.subscriptionDate,
        expiryDate: loi.loiExpiryDate,
        sfpClass: loi.sfpClass,
        sfpValue: loi.sfpValue,
        discountPercentage: loi.discountPercentage,
        maxTotalValue: loi.maxTotalValue,
        companyName: loi.companyName,
        companyFullName: loi.companyFullName,
        companyAddress: loi.companyLegalAddress,
        companyCity: loi.companyCity,
        companyCAP: loi.companyCAP,
        companyProvince: 'RM',
        companyVAT: loi.companyVAT,
        companyCapital: loi.companyCapital,
        companyRegistration: loi.companyRegistration,
        companyREA: 'RM - 123456',
        companyEmail: 'info@smartequity.it',
        companyPEC: 'smartequity@pec.it',
        companyCEO: 'Mario Rossi',
        companyTribunale: loi.competentCourt,
        conversionDate: loi.conversionDate,
        paymentTerms: 'Bonifico bancario entro 30 giorni dalla firma',
        notes: loi.notes
      };
      previewLOIDocument(loiData);
    }
  };

  const handleGenerateLOI = async (formData: {
    loiNumber: string;
    loiDate: string;
    expiryDate: string;
    sfpValue: number;
    discountPercentage: number;
    conversionDate: string;
    maxTotalValue: number;
    companyName: string;
    companyFullName: string;
    companyAddress: string;
    companyCAP: string;
    companyCity: string;
    companyRegistration: string;
    companyVAT: string;
    companyCapital: string;
    companyTribunale: string;
    notes?: string;
  }) => {
    // Genera LOI per tutti gli investitori
    const targetInvestors = investorsWithLOIStatus;

    // Per ogni investitore selezionato, genera un nuovo documento
    for (let index = 0; index < targetInvestors.length; index++) {
      const investor = targetInvestors[index];
      const loiData: LOIDocumentData = {
        investorId: investor.id,
        investorName: investor.name,
        investorEmail: investor.email,
        investorCompany: investor.company,
        investorAddress: investor.company ? `${investor.company}, Via Example 123, 00100 Roma` : undefined,
        investorVAT: investor.company ? 'IT12345678901' : undefined,
        loiNumber: formData.loiNumber,
        loiDate: formData.loiDate,
        expiryDate: formData.expiryDate,
        sfpClass: investor.loiClass || 'B',
        sfpValue: formData.sfpValue,
        discountPercentage: formData.discountPercentage,
        conversionDate: formData.conversionDate,
        maxTotalValue: formData.maxTotalValue,
        companyName: formData.companyName,
        companyFullName: formData.companyFullName,
        companyAddress: formData.companyAddress,
        companyCAP: formData.companyCAP,
        companyCity: formData.companyCity,
        companyRegistration: formData.companyRegistration,
        companyVAT: formData.companyVAT,
        companyCapital: formData.companyCapital,
        companyProvince: '',
        companyTribunale: formData.companyTribunale,
        companyREA: '',
        companyEmail: '',
        companyPEC: '',
        companyCEO: '',
        paymentTerms: '30 giorni dalla firma',
        notes: formData.notes
      };

      // Mostra anteprima del documento per il primo investitore
      if (index === 0) {
        previewLOIDocument(loiData);
      }

      // Salva nel database
      const newLOI: Partial<LOI> = {
        id: `loi-${Date.now()}-${investor.id}`,
        investorId: investor.id,
        investorName: investor.name,
        investorEmail: investor.email,
        investorCompany: investor.company,
        loiNumber: formData.loiNumber,
        title: 'Lettera d\'intenti SFP 2025',
        companyName: formData.companyName,
        companyFullName: formData.companyFullName,
        sfpClass: investor.loiClass || 'B',
        sfpValue: formData.sfpValue,
        discountPercentage: formData.discountPercentage,
        conversionDate: formData.conversionDate,
        maxTotalValue: formData.maxTotalValue,
        ticketSize: formData.sfpValue,
        subscriptionDate: formData.loiDate,
        subscriptionDeadline: formData.expiryDate,
        loiExpiryDate: formData.expiryDate,
        status: 'sent',
        priority: 'medium',
        companyLegalAddress: formData.companyAddress,
        companyCAP: formData.companyCAP,
        companyCity: formData.companyCity,
        companyRegistration: formData.companyRegistration,
        companyVAT: formData.companyVAT,
        companyCapital: formData.companyCapital,
        taxBenefitPercentage: 30,
        taxBenefitValue: (formData.sfpValue - (formData.sfpValue * formData.discountPercentage / 100)) * 0.3,
        documentsProvided: {
          companyRegistration: false,
          investorDeck: false,
          regulation: false
        },
        paymentMethod: 'bank_transfer',
        confidentialityPeriod: 24,
        competentCourt: formData.companyTribunale,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Mario Rossi'
      };
      
      // Salva in Supabase se disponibile, altrimenti in locale
      if (useSupabase) {
        try {
          const savedLOI = await loiService.createLOI(newLOI);
          setLois(prev => [...prev, savedLOI]);
        } catch (error) {
          console.error('Errore nel salvataggio in Supabase:', error);
          // Mostra feedback all'utente e fallback ai dati locali
          alert('⚠️ Salvataggio su Supabase non riuscito. La LOI verrà salvata localmente.');
          setLois(prev => [...prev, newLOI as LOI]);
        }
      } else {
        setLois(prev => [...prev, newLOI as LOI]);
      }
    }

    setShowForm(false);
    
    // Mostra conferma
    alert(`LOI generata per ${targetInvestors.length} investitore${targetInvestors.length > 1 ? 'i' : ''}!`);
  };

  const handleDownloadLOI = (loi: LOI) => {
    // Converti la LOI in LOIDocumentData per il download
    const loiData: LOIDocumentData = {
      investorId: loi.investorId,
      investorName: loi.investorName,
      investorEmail: loi.investorEmail,
      investorCompany: loi.investorCompany,
      investorAddress: '',
      investorVAT: '',
      logoUrl: '',
      loiNumber: loi.loiNumber,
      loiDate: loi.subscriptionDate,
      expiryDate: loi.loiExpiryDate,
      sfpClass: loi.sfpClass,
      sfpValue: loi.sfpValue,
      discountPercentage: loi.discountPercentage,
      maxTotalValue: loi.maxTotalValue,
      companyName: loi.companyName,
      companyFullName: loi.companyFullName,
      companyAddress: loi.companyLegalAddress,
      companyCity: loi.companyCity,
      companyCAP: loi.companyCAP,
      companyProvince: 'RM',
      companyVAT: loi.companyVAT,
      companyCapital: loi.companyCapital,
      companyRegistration: loi.companyRegistration,
      companyREA: 'RM - 123456',
      companyEmail: 'info@smartequity.it',
      companyPEC: 'smartequity@pec.it',
      companyCEO: 'Mario Rossi',
      companyTribunale: loi.competentCourt,
      conversionDate: loi.conversionDate,
      paymentTerms: 'Bonifico bancario entro 30 giorni dalla firma',
      notes: loi.notes
    };
    
    // Usa la funzione di download PDF
    import('../../../utils/pdfGenerator').then(({ downloadLOIAsHTML }) => {
      downloadLOIAsHTML(loiData);
    });
  };

  const handleImportLOI = () => {
    // Crea un input file per selezionare il file JSON
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importedData = JSON.parse(event.target?.result as string);
            
            // Valida che sia una LOI valida
            if (importedData && importedData.loiNumber && importedData.investorName) {
              // Aggiungi ID e timestamp se non presenti
              const newLOI: LOI = {
                ...importedData,
                id: importedData.id || `loi-import-${Date.now()}`,
                createdAt: importedData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: importedData.createdBy || 'Importato'
              };
              
              // Salva in Supabase se disponibile
              if (useSupabase) {
                try {
                  const savedLOI = await loiService.createLOI(newLOI);
                  setLois(prev => [...prev, savedLOI]);
                } catch (error) {
                  console.error('Errore nel salvataggio in Supabase:', error);
                  setLois(prev => [...prev, newLOI]);
                }
              } else {
                setLois(prev => [...prev, newLOI]);
              }
              
              alert(`LOI importata con successo per ${newLOI.investorName}!`);
            } else {
              alert('File non valido. Assicurati che contenga una LOI completa.');
            }
          } catch (error) {
            alert('Errore durante l\'importazione del file. Verifica che sia un JSON valido.');
            console.error('Errore importazione LOI:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportLOI = (loi: LOI) => {
    // Esporta la LOI come file JSON
    const dataStr = JSON.stringify(loi, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `LOI_${loi.loiNumber}_${loi.investorName.replace(/\s+/g, '_')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleSendEmail = (loi: LOI) => {
    // Prepara email con subject e body precompilati
    const subject = encodeURIComponent(`Lettera d'Intenti ${loi.loiNumber} - ${loi.companyName}`);
    const previewLink = `${window.location.origin}`; // Placeholder, si può sostituire con link pubblico al file
    const bodyLines = [
      `Gentile ${loi.investorName},`,
      '',
      `in allegato/di seguito trova la Lettera d'Intenti (${loi.loiNumber}) relativa a ${loi.companyName}.`,
      '',
      `Numero LOI: ${loi.loiNumber}`,
      `Stato: ${loi.status}`,
      `Scadenza LOI: ${loi.loiExpiryDate}`,
      '',
      'La invitiamo a prenderne visione e procedere con la firma digitale.',
      '',
      `Cordiali saluti,`,
      `Team ${loi.companyName}`,
      '',
      `(Anteprima documento: ${previewLink})`
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));

    // Apre il client email predefinito
    window.location.href = `mailto:${loi.investorEmail}?subject=${subject}&body=${body}`;
  };


  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Bozza', class: 'status-draft', icon: FileText },
      sent: { label: 'Inviata', class: 'status-sent', icon: Mail },
      signed: { label: 'Firmata', class: 'status-signed', icon: CheckCircle },
      expired: { label: 'Scaduta', class: 'status-expired', icon: XCircle },
      rejected: { label: 'Rifiutata', class: 'status-rejected', icon: XCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, class: '', icon: FileText };
    const Icon = config.icon;
    
    return (
      <span className={`status-badge ${config.class}`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };



  const isExpiringSoon = (loi: LOI) => {
    const expiryDate = new Date(loi.loiExpiryDate);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return loi.status === 'sent' && expiryDate <= sevenDaysFromNow && expiryDate > now;
  };

  return (
    <div className="loi-page">
      {/* Header */}
      <div className="loi-header">
        <div className="loi-title-section">
          <h1 className="loi-title">Gestione LOI</h1>
          <p className="loi-subtitle">Lettere d&apos;Intenti per Strumenti Finanziari Partecipativi</p>
        </div>
        <div className="loi-actions">
          <button className="btn-secondary" onClick={handleImportLOI}>
            <Upload size={18} />
            Importa LOI
          </button>
          <button className="btn-secondary">
            <Download size={18} />
            Esporta
          </button>
          <button className="btn-primary" onClick={handleCreateLOI}>
            <Plus size={18} />
            Nuova LOI
          </button>
        </div>
      </div>

      {/* Alert per LOI in scadenza */}
      {pendingLOIs.length > 0 && (
        <div className="alert-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>Attenzione:</strong> {pendingLOIs.length} LOI in scadenza nei prossimi 7 giorni.
            <a href="#" className="alert-link">Visualizza dettagli</a>
          </div>
        </div>
      )}

      {/* Statistiche */}
      <div className="loi-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalLOIs}</div>
            <div className="stat-label">Totale LOI</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Mail size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.sentLOIs}</div>
            <div className="stat-label">Inviate</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.signedLOIs}</div>
            <div className="stat-label">Firmate</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalValue)}</div>
            <div className="stat-label">Valore Totale</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.conversionRate.toFixed(1)}%</div>
            <div className="stat-label">Tasso Conversione</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingExpiry}</div>
            <div className="stat-label">In Scadenza</div>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="loi-filters">
        <div className="filters-row">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Cerca per investitore, email, numero LOI..."
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
            <option value="draft">Bozza</option>
            <option value="sent">Inviata</option>
            <option value="signed">Firmata</option>
            <option value="expired">Scaduta</option>
            <option value="rejected">Rifiutata</option>
          </select>



          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setFilters(prev => ({ 
                ...prev, 
                sortBy: sortBy as LOIFilters['sortBy'], 
                sortOrder: sortOrder as LOIFilters['sortOrder'] 
              }));
            }}
            className="filter-select"
            title="Ordina per"
          >
            <option value="createdAt-desc">Data creazione (Recenti)</option>
            <option value="createdAt-asc">Data creazione (Vecchi)</option>
            <option value="loiExpiryDate-asc">Scadenza (Prossime)</option>
            <option value="loiExpiryDate-desc">Scadenza (Lontane)</option>
            <option value="sfpValue-desc">Valore (Alto-Basso)</option>
            <option value="sfpValue-asc">Valore (Basso-Alto)</option>
            <option value="investorName-asc">Investitore (A-Z)</option>
            <option value="investorName-desc">Investitore (Z-A)</option>
          </select>
        </div>
      </div>


      {/* Indicatore di caricamento */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Caricamento dati...</p>
        </div>
      )}

      {/* Indicatore database */}
      {!loading && (
        <div className="database-status">
          {useSupabase ? (
            <span className="status-indicator supabase">
              <CheckCircle size={16} />
              Connesso a Supabase (https://bvqrovzrvmdhuehonfcq.supabase.co)
            </span>
          ) : (
            <span className="status-indicator local">
              <AlertTriangle size={16} />
              Modalità offline (dati locali) - Configura .env.local per Supabase
            </span>
          )}
        </div>
      )}

      {/* Tabella LOI */}
      <div className="loi-table-container">
        <table className="loi-table">
          <thead>
            <tr>
              <th>Investitore</th>
              <th>Stato LOI</th>
              <th>Numero LOI</th>
              <th>Scadenza</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvestors.map((investor) => (
              <tr key={investor.id} className={`loi-row ${investor.loiExpiryDate && isExpiringSoon({ loiExpiryDate: investor.loiExpiryDate } as LOI) ? 'expiring-soon' : ''}`}>
                <td>
                  <div className="investor-info">
                    <div className="investor-name">{investor.name}</div>
                    <div className="investor-email">{investor.email}</div>
                    {investor.company && (
                      <div className="investor-company">{investor.company}</div>
                    )}
                  </div>
                </td>
                <td>
                  {investor.loiStatus === 'none' ? (
                    <span className="status-badge status-none">
                      <XCircle size={14} />
                      Nessuna LOI
                    </span>
                  ) : (
                    getStatusBadge(investor.loiStatus)
                  )}
                </td>
                <td>
                  {investor.loiNumber ? (
                    <div className="loi-info">
                      <div className="loi-number">{investor.loiNumber}</div>
                      {investor.loiDate && (
                        <div className="loi-date">{formatDate(investor.loiDate)}</div>
                      )}
                    </div>
                  ) : (
                    <span className="no-loi">-</span>
                  )}
                </td>
                <td>
                  {investor.loiExpiryDate ? (
                    <div className="expiry-info">
                      <Calendar size={14} />
                      <span className={investor.loiExpiryDate && isExpiringSoon({ loiExpiryDate: investor.loiExpiryDate } as LOI) ? 'expiring-text' : ''}>
                        {formatDate(investor.loiExpiryDate)}
                      </span>
                      {investor.loiExpiryDate && isExpiringSoon({ loiExpiryDate: investor.loiExpiryDate } as LOI) && (
                        <AlertTriangle size={14} className="expiry-warning" />
                      )}
                    </div>
                  ) : (
                    <span className="no-loi">-</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    {investor.loiId ? (
                      <>
                        <button 
                          className="action-btn view-btn" 
                          title="Visualizza LOI"
                          onClick={() => handleViewLOI(investor.loiId!)}
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="action-btn download-btn" 
                          title="Scarica LOI come PDF/HTML"
                          onClick={() => handleDownloadLOI(lois.find(l => l.id === investor.loiId)!)}
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          className="action-btn mail-btn" 
                          title="Invia LOI via email"
                          onClick={() => handleSendEmail(lois.find(l => l.id === investor.loiId)!)}
                        >
                          <Mail size={16} />
                        </button>
                        <button 
                          className="action-btn export-btn" 
                          title="Esporta LOI come JSON"
                          onClick={() => handleExportLOI(lois.find(l => l.id === investor.loiId)!)}
                        >
                          <FileUp size={16} />
                        </button>
                      </>
                    ) : (
                      <button 
                        className="action-btn create-btn" 
                        title="Crea LOI"
                        onClick={() => setShowForm(true)}
                      >
                        <FileText size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredInvestors.length === 0 && (
          <div className="no-results">
            <FileText size={48} />
            <p>Nessun investitore trovato con i filtri selezionati.</p>
          </div>
        )}
      </div>

      {/* LOI Form Modal - Complete for Document Generation */}
      <LOIFormComplete
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onGenerate={handleGenerateLOI}
      />
    </div>
  );
}
