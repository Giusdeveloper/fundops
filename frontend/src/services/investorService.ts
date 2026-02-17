import { supabase } from '@/lib/supabaseClient'
import { Investor } from '../types/investor'
// TODO: Il tipo Database non è disponibile - potrebbe essere necessario generarlo da Supabase
// Per ora usiamo any per far compilare il codice
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvestorRow = any

// Funzioni di conversione tra Database (fundops_investors) e tipo Investor legacy
// Il database usa: full_name, company_id, type, category, etc.
// Il tipo Investor legacy usa: name, company, investorType, etc.
const convertRowToInvestor = (row: InvestorRow): Investor => ({
  id: row.id,
  name: row.full_name || '', // full_name -> name
  email: row.email || '',
  phone: row.phone || undefined,
  company: undefined, // Non presente nel database reale
  position: undefined, // Non presente nel database reale
  status: 'active' as const, // Default, non presente nel database reale
  category: (row.category || 'individual') as 'angel' | 'vc' | 'institutional' | 'individual',
  notes: row.notes || undefined,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
  totalInvested: 0, // Non presente nel database reale
  numberOfInvestments: 0, // Non presente nel database reale
  lastContactDate: undefined,
  preferredContactMethod: 'email' as const, // Default
  timezone: undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  investorType: row.type as any, // type -> investorType
  motivation: undefined,
  linkedin: undefined
})

// Servizi per gli investitori - aggiornato per usare fundops_investors
export const investorService = {
  // Ottieni tutti gli investitori
  async getAllInvestors(): Promise<Investor[]> {
    const { data, error } = await supabase
      .from('fundops_investors')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Errore nel recupero degli investitori:', error.message)
      return []
    }

    return data ? data.map(convertRowToInvestor) : []
  },

  // Ottieni investitore per ID
  async getInvestorById(id: string): Promise<Investor | null> {
    const { data, error } = await supabase
      .from('fundops_investors')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Errore nel recupero dell\'investitore:', error)
      return null
    }

    return data ? convertRowToInvestor(data) : null
  },

  // Ottieni investitori per status (non supportato nel database reale, restituisce tutti)
  async getInvestorsByStatus(_status: string): Promise<Investor[]> {
    void _status
    // Il database reale non ha il campo status, quindi restituiamo tutti
    return this.getAllInvestors()
  },

  // Crea nuovo investitore (non implementato - usa l'API diretta)
  async createInvestor(_investor: Partial<Investor>): Promise<Investor> {
    void _investor
    throw new Error('Usa l\'API /api/fundops_investors per creare investitori')
  },

  // Aggiorna investitore (non implementato - usa l'API diretta)
  async updateInvestor(_id: string, _updates: Partial<Investor>): Promise<Investor> {
    void _id
    void _updates
    throw new Error('Usa l\'API /api/fundops_investors per aggiornare investitori')
  },

  // Elimina investitore (non implementato - usa l'API diretta)
  async deleteInvestor(_id: string): Promise<void> {
    void _id
    throw new Error('Usa l\'API /api/fundops_investors per eliminare investitori')
  },

  // Cerca investitori
  async searchInvestors(query: string): Promise<Investor[]> {
    const { data, error } = await supabase
      .from('fundops_investors')
      .select('*')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Errore nella ricerca degli investitori:', error.message)
      return []
    }

    return data ? data.map(convertRowToInvestor) : []
  },

  // Ottieni statistiche investitori
  async getInvestorStats(): Promise<{
    totalInvestors: number
    activeInvestors: number
    totalInvested: number
    averageInvestment: number
  }> {
    const { data, error } = await supabase
      .from('fundops_investors')
      .select('id')

    if (error) {
      console.warn('Errore nel recupero delle statistiche investitori:', error.message)
      return {
        totalInvestors: 0,
        activeInvestors: 0,
        totalInvested: 0,
        averageInvestment: 0
      }
    }

    return {
      totalInvestors: data?.length || 0,
      activeInvestors: data?.length || 0, // Il database reale non ha status
      totalInvested: 0, // Non presente nel database reale
      averageInvestment: 0
    }
  }
}
