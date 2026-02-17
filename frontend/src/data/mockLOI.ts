import { LOI, LOITemplate, LOIStats } from '../types/loi';

// Template LOI SFP 2025
export const loiTemplate: LOITemplate = {
  id: 'template-sfp-2025',
  name: 'SFP 2025 - Società Srl',
  description: 'Template per Strumenti Finanziari Partecipativi 2025',
  companyName: 'Società Srl',
  maxTotalValue: 150000,
  ticketSize: 5000,
  conversionDate: '31/12/2026',
  sfpClasses: {
    A: { deadline: '15/03/2025', discount: 20 },
    B: { deadline: '30/04/2025', discount: 15 },
    C: { deadline: '30/06/2025', discount: 10 }
  },
  taxBenefitPercentage: 30,
  confidentialityPeriod: 24,
  templateContent: '', // Sarà popolato con il template HTML
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z'
};

// LOI Mock Data
export const mockLOIs: LOI[] = [
  {
    id: 'loi-001',
    investorId: 'inv-001',
    investorName: 'Marco Rossi',
    investorEmail: 'marco.rossi@venturecapital.it',
    investorCompany: 'Venture Capital Partners',
    investorPosition: 'Managing Partner',
    
    loiNumber: 'LOI-SFP-2025-001',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Società Srl',
    companyFullName: 'Società Srl Startup Innovativa',
    
    sfpClass: 'A',
    sfpValue: 25000, // €25.000 (5x ticket size)
    discountPercentage: 20,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '10/03/2025',
    subscriptionDeadline: '15/03/2025',
    loiSentDate: '05/03/2025',
    loiSignedDate: '12/03/2025',
    loiExpiryDate: '05/04/2025',
    
    status: 'signed',
    priority: 'high',
    
    companyLegalAddress: 'Via Roma 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€50.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 7500, // 30% di €25.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    
    notes: 'Investitore molto interessato, pronto a firmare.',
    internalNotes: 'Follow-up necessario per documentazione aggiuntiva.',
    
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-03-12T14:30:00Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin'
  },
  {
    id: 'loi-002',
    investorId: 'inv-002',
    investorName: 'Anna Bianchi',
    investorEmail: 'anna.bianchi@angelgroup.com',
    investorCompany: 'Angel Group Milano',
    investorPosition: 'Angel Investor',
    
    loiNumber: 'LOI-SFP-2025-002',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Società Srl',
    companyFullName: 'Società Srl Startup Innovativa',
    
    sfpClass: 'B',
    sfpValue: 15000, // €15.000 (3x ticket size)
    discountPercentage: 15,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '20/04/2025',
    subscriptionDeadline: '30/04/2025',
    loiSentDate: '18/04/2025',
    loiSignedDate: undefined,
    loiExpiryDate: '18/05/2025',
    
    status: 'sent',
    priority: 'medium',
    
    companyLegalAddress: 'Via Roma 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€50.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 4500, // 30% di €15.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: false
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    
    notes: 'In attesa di firma. Seguire entro fine settimana.',
    internalNotes: 'Inviare reminder per firma.',
    
    createdAt: '2025-04-15T09:00:00Z',
    updatedAt: '2025-04-18T11:00:00Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin'
  },
  {
    id: 'loi-003',
    investorId: 'inv-003',
    investorName: 'Giuseppe Verdi',
    investorEmail: 'g.verdi@institutional.fund',
    investorCompany: 'Institutional Fund S.p.A.',
    investorPosition: 'Investment Director',
    
    loiNumber: 'LOI-SFP-2025-003',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Società Srl',
    companyFullName: 'Società Srl Startup Innovativa',
    
    sfpClass: 'C',
    sfpValue: 50000, // €50.000 (10x ticket size)
    discountPercentage: 10,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '15/07/2025',
    subscriptionDeadline: '30/06/2025',
    loiSentDate: '10/07/2025',
    loiSignedDate: undefined,
    loiExpiryDate: '10/08/2025',
    
    status: 'sent',
    priority: 'high',
    
    companyLegalAddress: 'Via Roma 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€50.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 15000, // 30% di €50.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: false,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    
    notes: 'Investitore istituzionale. Processo decisionale lungo.',
    internalNotes: 'Monitorare attentamente scadenze.',
    
    createdAt: '2025-07-05T14:00:00Z',
    updatedAt: '2025-07-10T16:00:00Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin'
  },
  {
    id: 'loi-004',
    investorId: 'inv-004',
    investorName: 'Sofia Neri',
    investorEmail: 'sofia.neri@gmail.com',
    investorCompany: 'Freelance',
    investorPosition: 'Business Consultant',
    
    loiNumber: 'LOI-SFP-2025-004',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Società Srl',
    companyFullName: 'Società Srl Startup Innovativa',
    
    sfpClass: 'A',
    sfpValue: 5000, // €5.000 (1x ticket size)
    discountPercentage: 20,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '01/03/2025',
    subscriptionDeadline: '15/03/2025',
    loiSentDate: '28/02/2025',
    loiSignedDate: '02/03/2025',
    loiExpiryDate: '28/03/2025',
    
    status: 'signed',
    priority: 'low',
    
    companyLegalAddress: 'Via Roma 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€50.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 1500, // 30% di €5.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    
    notes: 'Primo investitore a firmare. Molto entusiasta del progetto.',
    internalNotes: 'Esempio positivo per altri investitori.',
    
    createdAt: '2025-02-25T08:00:00Z',
    updatedAt: '2025-03-02T10:00:00Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin'
  },
  {
    id: 'loi-005',
    investorId: 'inv-005',
    investorName: 'Luca Ferrari',
    investorEmail: 'luca@techventures.vc',
    investorCompany: 'Tech Ventures VC',
    investorPosition: 'Principal',
    
    loiNumber: 'LOI-SFP-2025-005',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Società Srl',
    companyFullName: 'Società Srl Startup Innovativa',
    
    sfpClass: 'B',
    sfpValue: 10000, // €10.000 (2x ticket size)
    discountPercentage: 15,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '25/04/2025',
    subscriptionDeadline: '30/04/2025',
    loiSentDate: '22/04/2025',
    loiSignedDate: undefined,
    loiExpiryDate: '22/05/2025',
    
    status: 'expired',
    priority: 'medium',
    
    companyLegalAddress: 'Via Roma 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€50.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 3000, // 30% di €10.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Tribunale di Roma',
    
    notes: 'LOI scaduta senza firma. Valutare nuovo approccio.',
    internalNotes: 'Contattare per rinegoziare condizioni.',
    
    createdAt: '2025-04-20T12:00:00Z',
    updatedAt: '2025-05-23T09:00:00Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin'
  },
  {
    id: 'loi-006',
    investorId: 'inv-006',
    investorName: 'Giulia Verdi',
    investorEmail: 'giulia.verdi@businessangels.it',
    investorCompany: 'Business Angels Roma',
    investorPosition: 'Angel Investor',
    
    loiNumber: 'LOI-2025-006',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Smart Equity Srl',
    companyFullName: 'Smart Equity Srl - Startup Innovativa',
    
    sfpClass: 'A',
    sfpValue: 20000, // €20.000 (4x ticket size)
    discountPercentage: 20,
    conversionDate: '31/12/2026',
    maxTotalValue: 150000,
    ticketSize: 5000,
    
    subscriptionDate: '15/01/2025',
    subscriptionDeadline: '15/03/2025',
    loiSentDate: '15/01/2025',
    loiSignedDate: undefined,
    loiExpiryDate: '15/02/2025',
    
    status: 'sent',
    priority: 'high',
    
    companyLegalAddress: 'Via Example 123',
    companyCAP: '00100',
    companyCity: 'Roma',
    companyRegistration: '12345678901',
    companyVAT: 'IT12345678901',
    companyCapital: '€ 10.000,00',
    
    taxBenefitPercentage: 30,
    taxBenefitValue: 6000, // 30% di €20.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Roma',
    
    notes: 'Investitore molto interessato al progetto. Ha richiesto informazioni aggiuntive sui benefici fiscali.',
    internalNotes: 'Follow-up programmato per il 20 gennaio. Inviare documentazione aggiuntiva.',
    
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    createdBy: 'Mario Rossi',
    lastModifiedBy: 'Mario Rossi'
  }
];

// Funzioni di utilità
export const getLOIById = (id: string): LOI | undefined => {
  return mockLOIs.find(loi => loi.id === id);
};

export const getLOIsByInvestorId = (investorId: string): LOI[] => {
  return mockLOIs.filter(loi => loi.investorId === investorId);
};

export const getLOIsByStatus = (status: string): LOI[] => {
  return mockLOIs.filter(loi => loi.status === status);
};

export const getLOIStats = (): LOIStats => {
  const totalLOIs = mockLOIs.length;
  const sentLOIs = mockLOIs.filter(loi => loi.status === 'sent').length;
  const signedLOIs = mockLOIs.filter(loi => loi.status === 'signed').length;
  const expiredLOIs = mockLOIs.filter(loi => loi.status === 'expired').length;
  const totalValue = mockLOIs.reduce((sum, loi) => sum + loi.sfpValue, 0);
  const averageValue = totalValue / totalLOIs;
  const conversionRate = sentLOIs > 0 ? (signedLOIs / sentLOIs) * 100 : 0;
  
  // LOI in scadenza nei prossimi 30 giorni
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const pendingExpiry = mockLOIs.filter(loi => {
    const expiryDate = new Date(loi.loiExpiryDate);
    return expiryDate > now && expiryDate <= thirtyDaysFromNow && loi.status === 'sent';
  }).length;
  
  return {
    totalLOIs,
    sentLOIs,
    signedLOIs,
    expiredLOIs,
    totalValue,
    averageValue,
    conversionRate,
    pendingExpiry
  };
};

export const getPendingLOIs = (): LOI[] => {
  return mockLOIs.filter(loi => {
    const expiryDate = new Date(loi.loiExpiryDate);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return loi.status === 'sent' && expiryDate <= sevenDaysFromNow;
  });
};
