import { LOI } from '../types/loi';

/**
 * Crea una LOI di esempio e la salva nel localStorage
 * Utile per testare il sistema e vedere come funziona
 */
export const createExampleLOI = (): void => {
  const exampleLOI: LOI = {
    id: 'loi-example-001',
    investorId: 'inv-006',
    investorName: 'Giulia Verdi',
    investorEmail: 'giulia.verdi@businessangels.it',
    investorCompany: 'Business Angels Roma',
    investorPosition: 'Angel Investor',
    
    loiNumber: 'LOI-2025-EXAMPLE',
    title: 'Lettera d\'intenti SFP 2025',
    companyName: 'Smart Equity Srl',
    companyFullName: 'Smart Equity Srl - Startup Innovativa',
    
    sfpClass: 'A',
    sfpValue: 25000, // €25.000 (5x ticket size)
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
    taxBenefitValue: 7500, // 30% di €25.000
    
    documentsProvided: {
      companyRegistration: true,
      investorDeck: true,
      regulation: true
    },
    
    paymentMethod: 'bank_transfer',
    bankAccount: 'IT60X0542811101000000123456',
    
    confidentialityPeriod: 24,
    competentCourt: 'Roma',
    
    notes: 'LOI di esempio creata per testare il sistema. Investitore interessato ai benefici fiscali SFP.',
    internalNotes: 'Documento di test per dimostrazione del sistema.',
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistema',
    lastModifiedBy: 'Sistema'
  };

  // Recupera le LOI esistenti dal localStorage
  const existingLOIs = JSON.parse(localStorage.getItem('lois') || '[]');
  
  // Controlla se la LOI di esempio esiste già
  const exampleExists = existingLOIs.some((loi: LOI) => loi.id === 'loi-example-001');
  
  if (!exampleExists) {
    // Aggiunge la LOI di esempio
    existingLOIs.push(exampleLOI);
    localStorage.setItem('lois', JSON.stringify(existingLOIs));
    
    console.log('✅ LOI di esempio creata con successo!');
    console.log('📄 Numero LOI:', exampleLOI.loiNumber);
    console.log('👤 Investitore:', exampleLOI.investorName);
    console.log('💰 Valore:', `€${exampleLOI.sfpValue.toLocaleString('it-IT')}`);
  } else {
    console.log('ℹ️ LOI di esempio già esistente nel localStorage');
  }
};

/**
 * Rimuove la LOI di esempio dal localStorage
 */
export const removeExampleLOI = (): void => {
  const existingLOIs = JSON.parse(localStorage.getItem('lois') || '[]');
  const filteredLOIs = existingLOIs.filter((loi: LOI) => loi.id !== 'loi-example-001');
  
  localStorage.setItem('lois', JSON.stringify(filteredLOIs));
  console.log('🗑️ LOI di esempio rimossa dal localStorage');
};

/**
 * Mostra tutte le LOI presenti nel localStorage
 */
export const listLOIsInStorage = (): void => {
  const lois = JSON.parse(localStorage.getItem('lois') || '[]');
  
  console.log(`📊 Trovate ${lois.length} LOI nel localStorage:`);
  lois.forEach((loi: LOI, index: number) => {
    console.log(`${index + 1}. ${loi.loiNumber} - ${loi.investorName} (${loi.status})`);
  });
};
