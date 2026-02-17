import { Investor, Investment } from '../types/investor';

export const mockInvestments: Investment[] = [
  {
    id: 'inv-001',
    investorId: 'inv-001',
    amount: 500000,
    date: '2024-01-15',
    projectId: 'proj-001',
    status: 'transferred',
    notes: 'Investimento iniziale Serie A'
  },
  {
    id: 'inv-002',
    investorId: 'inv-002',
    amount: 300000,
    date: '2024-02-20',
    projectId: 'proj-001',
    status: 'transferred',
    notes: 'Follow-on investment'
  },
  {
    id: 'inv-003',
    investorId: 'inv-003',
    amount: 750000,
    date: '2024-03-10',
    projectId: 'proj-002',
    status: 'committed',
    notes: 'Pendente trasferimento'
  }
];

export const mockInvestors: Investor[] = [
  {
    id: 'inv-001',
    name: 'Marco Rossi',
    email: 'marco.rossi@venturecapital.it',
    phone: '+39 333 123 4567',
    company: 'Venture Capital Partners',
    position: 'Managing Partner',
    status: 'active',
    category: 'vc',
    notes: 'Interessato a progetti fintech e AI. Molto reattivo.',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    totalInvested: 500000,
    numberOfInvestments: 1,
    lastContactDate: '2024-01-20',
    preferredContactMethod: 'email',
    timezone: 'Europe/Rome',
    investorType: 'business_development',
    motivation: 'Interessato a progetti innovativi nel settore fintech con potenziale di crescita internazionale.',
    linkedin: 'https://linkedin.com/in/marco-rossi-vc'
  },
  {
    id: 'inv-002',
    name: 'Anna Bianchi',
    email: 'anna.bianchi@angelgroup.com',
    phone: '+39 347 987 6543',
    company: 'Angel Group Milano',
    position: 'Angel Investor',
    status: 'active',
    category: 'angel',
    notes: 'Ex-founder di startup tech. Esperta in go-to-market.',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-02-20T00:00:00Z',
    totalInvested: 300000,
    numberOfInvestments: 1,
    lastContactDate: '2024-02-25',
    preferredContactMethod: 'meeting',
    timezone: 'Europe/Rome',
    investorType: 'customer',
    motivation: 'Vuole supportare startup tech italiane con la sua esperienza imprenditoriale e network.',
    linkedin: 'https://linkedin.com/in/anna-bianchi-angel'
  },
  {
    id: 'inv-003',
    name: 'Giuseppe Verdi',
    email: 'g.verdi@institutional.fund',
    phone: '+39 06 1234 5678',
    company: 'Institutional Fund S.p.A.',
    position: 'Investment Director',
    status: 'pending',
    category: 'institutional',
    notes: 'Fondo istituzionale. Processo decisionale lungo ma sicuro.',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-10T00:00:00Z',
    totalInvested: 750000,
    numberOfInvestments: 1,
    lastContactDate: '2024-03-05',
    preferredContactMethod: 'phone',
    timezone: 'Europe/Rome',
    investorType: 'business_development',
    motivation: 'Diversificazione del portafoglio istituzionale con focus su startup ad alto potenziale.',
    linkedin: 'https://linkedin.com/in/giuseppe-verdi-institutional'
  },
  {
    id: 'inv-004',
    name: 'Sofia Neri',
    email: 'sofia.neri@gmail.com',
    phone: '+39 320 555 1234',
    company: 'Freelance',
    position: 'Business Consultant',
    status: 'active',
    category: 'individual',
    notes: 'Investitore individuale. Interessata a progetti sostenibili.',
    createdAt: '2024-02-10T00:00:00Z',
    updatedAt: '2024-02-28T00:00:00Z',
    totalInvested: 50000,
    numberOfInvestments: 1,
    lastContactDate: '2024-03-01',
    preferredContactMethod: 'email',
    timezone: 'Europe/Rome',
    investorType: 'customer',
    motivation: 'Interessata a investire in progetti che promuovono la sostenibilità ambientale.',
    linkedin: 'https://linkedin.com/in/sofia-neri-consultant'
  },
  {
    id: 'inv-005',
    name: 'Luca Ferrari',
    email: 'luca@techventures.vc',
    phone: '+39 335 777 8888',
    company: 'Tech Ventures VC',
    position: 'Principal',
    status: 'inactive',
    category: 'vc',
    notes: 'Interessato ma in attesa di maggiori dettagli sul progetto.',
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    totalInvested: 0,
    numberOfInvestments: 0,
    lastContactDate: '2024-01-20',
    preferredContactMethod: 'email',
    timezone: 'Europe/Rome',
    investorType: 'business_development',
    motivation: 'Cerca opportunità di partnership strategiche nel settore tech.',
    linkedin: 'https://linkedin.com/in/luca-ferrari-techvc'
  },
  {
    id: 'inv-006',
    name: 'Giulia Verdi',
    email: 'giulia.verdi@businessangels.it',
    phone: '+39 338 999 0000',
    company: 'Business Angels Roma',
    position: 'Angel Investor',
    status: 'active',
    category: 'angel',
    notes: 'Angel investor esperta in startup fintech. Molto interessata ai benefici fiscali SFP.',
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    totalInvested: 75000,
    numberOfInvestments: 3,
    lastContactDate: '2025-01-15',
    preferredContactMethod: 'phone',
    timezone: 'Europe/Rome',
    investorType: 'business_development',
    motivation: 'Investe in startup innovative con focus su fintech e AI.',
    linkedin: 'https://linkedin.com/in/giulia-verdi-business-angels'
  }
];

// Funzioni di utilità per gestire i dati
export const getInvestorById = (id: string): Investor | undefined => {
  return mockInvestors.find(investor => investor.id === id);
};

export const getInvestmentsByInvestorId = (investorId: string): Investment[] => {
  return mockInvestments.filter(investment => investment.investorId === investorId);
};

export const getInvestorsByStatus = (status: string): Investor[] => {
  return mockInvestors.filter(investor => investor.status === status);
};

export const getTotalInvestedAmount = (): number => {
  return mockInvestors.reduce((total, investor) => total + investor.totalInvested, 0);
};

export const getActiveInvestorsCount = (): number => {
  return mockInvestors.filter(investor => investor.status === 'active').length;
};
