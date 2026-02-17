export interface LOI {
  id: string;
  // Dati Investitore
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorCompany?: string;
  investorPosition?: string;
  
  // Dati LOI
  loiNumber: string;
  title: string; // "Lettera d'intenti SFP 2025"
  companyName: string; // "Società Srl"
  companyFullName: string; // "Società Srl Startup Innovativa"
  
  // Dati Investimento SFP
  sfpClass: 'A' | 'B' | 'C';
  sfpValue: number; // Valore SFP (es. €5.000)
  discountPercentage: number; // Sconto applicato (20%, 15%, 10%)
  conversionDate: string; // "31/12/2026"
  maxTotalValue: number; // €150.000
  ticketSize: number; // €5.000
  
  // Date e Scadenze
  subscriptionDate: string; // Data sottoscrizione
  subscriptionDeadline: string; // Scadenza per sconto
  loiSentDate?: string; // Data invio LOI
  loiSignedDate?: string; // Data firma LOI
  loiExpiryDate: string; // Data scadenza LOI
  
  // Stati e Workflow
  status: 'draft' | 'sent' | 'signed' | 'expired' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  
  // Dati Azienda (da template)
  companyLegalAddress: string;
  companyCAP: string;
  companyCity: string;
  companyRegistration: string;
  companyVAT: string;
  companyCapital: string;
  
  // Benefici Fiscali
  taxBenefitPercentage: number; // 30%
  taxBenefitValue: number; // Calcolato automaticamente
  
  // Documenti
  documentsProvided: {
    companyRegistration: boolean;
    investorDeck: boolean;
    regulation: boolean;
  };
  
  // Modalità di Pagamento
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
  bankAccount?: string;
  
  // Accordo di Riservatezza
  confidentialityPeriod: number; // 24 mesi
  
  // Contenzioso
  competentCourt: string; // "Tribunale di Città"
  
  // Note e Commenti
  notes?: string;
  internalNotes?: string;
  
  // Metadati
  createdAt: string;
  updatedAt: string;
  createdBy: string; // User ID che ha creato la LOI
  lastModifiedBy?: string;
}

export interface LOITemplate {
  id: string;
  name: string;
  description: string;
  companyName: string;
  maxTotalValue: number;
  ticketSize: number;
  conversionDate: string;
  sfpClasses: {
    A: { deadline: string; discount: number };
    B: { deadline: string; discount: number };
    C: { deadline: string; discount: number };
  };
  taxBenefitPercentage: number;
  confidentialityPeriod: number;
  templateContent: string; // HTML template del documento
  isActive: boolean;
  createdAt: string;
}

export interface LOIFilters {
  search: string;
  status: string;
  sortBy: 'createdAt' | 'loiExpiryDate' | 'investorName' | 'loiDate';
  sortOrder: 'asc' | 'desc';
  dateRange?: {
    from: string;
    to: string;
  };
}

export type LOIFormData = Omit<LOI, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'lastModifiedBy'>;

// Utility Types
export interface LOIStats {
  totalLOIs: number;
  sentLOIs: number;
  signedLOIs: number;
  expiredLOIs: number;
  totalValue: number;
  averageValue: number;
  conversionRate: number; // signed / sent
  pendingExpiry: number; // LOI in scadenza nei prossimi 30 giorni
}

export interface LOITimelineEvent {
  id: string;
  loiId: string;
  type: 'created' | 'sent' | 'viewed' | 'signed' | 'expired' | 'rejected' | 'note_added';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}
