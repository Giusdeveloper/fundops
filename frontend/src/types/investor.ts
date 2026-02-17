export interface Investor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  status: 'active' | 'pending' | 'inactive';
  category: 'angel' | 'vc' | 'institutional' | 'individual';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Dati per dashboard (calcolati dinamicamente)
  totalInvested: number;
  numberOfInvestments: number;
  lastContactDate?: string;
  // Preferenze comunicazione
  preferredContactMethod: 'email' | 'phone' | 'meeting';
  timezone?: string;
  // Nuovi campi
  investorType?: 'customer' | 'supplier' | 'business_development' | 'professionals' | 'member_get_member' | 'exit' | 'influencer' | 'brand_awareness' | 'recruiter';
  motivation?: string;
  linkedin?: string;
}

export interface Investment {
  id: string;
  investorId: string;
  amount: number;
  date: string;
  projectId?: string;
  status: 'committed' | 'transferred' | 'pending';
  notes?: string;
}

export interface InvestorFilters {
  search: string;
  status: string;
  category: string;
  sortBy: 'name' | 'totalInvested' | 'createdAt' | 'lastContactDate';
  sortOrder: 'asc' | 'desc';
}

export type InvestorFormData = Omit<Investor, 'id' | 'createdAt' | 'updatedAt' | 'totalInvested' | 'numberOfInvestments'>;
