import { supabase } from '@/lib/supabaseClient'
import { LOI } from '../types/loi'
import { LoiEvent, LoiEventType, buildLoiEvent } from '@/lib/loiEvents'
// TODO: Il tipo Database non è disponibile - potrebbe essere necessario generarlo da Supabase
// Per ora usiamo any per far compilare il codice
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LOIRow = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LOIInsert = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LOIUpdate = any

// Funzioni di conversione tra tipi LOI e Database
const convertRowToLOI = (row: LOIRow): LOI => ({
  id: row.id,
  investorId: row.investor_id,
  investorName: row.investor_name,
  investorEmail: row.investor_email,
  investorCompany: row.investor_company,
  loiNumber: row.loi_number,
  title: row.title,
  companyName: row.company_name,
  companyFullName: row.company_full_name,
  sfpClass: row.sfp_class,
  sfpValue: row.sfp_value,
  discountPercentage: row.discount_percentage,
  conversionDate: row.conversion_date,
  maxTotalValue: row.max_total_value,
  ticketSize: row.ticket_size,
  subscriptionDate: row.subscription_date,
  subscriptionDeadline: row.subscription_deadline,
  loiExpiryDate: row.loi_expiry_date,
  status: row.status,
  priority: row.priority,
  companyLegalAddress: row.company_legal_address,
  companyCAP: row.company_cap,
  companyCity: row.company_city,
  companyRegistration: row.company_registration,
  companyVAT: row.company_vat,
  companyCapital: row.company_capital,
  taxBenefitPercentage: row.tax_benefit_percentage,
  taxBenefitValue: row.tax_benefit_value,
  documentsProvided: row.documents_provided,
  paymentMethod: row.payment_method,
  confidentialityPeriod: row.confidentiality_period,
  competentCourt: row.competent_court,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by
})

const convertLOIToInsert = (loi: Partial<LOI>): LOIInsert => ({
  id: loi.id,
  investor_id: loi.investorId!,
  investor_name: loi.investorName!,
  investor_email: loi.investorEmail!,
  investor_company: loi.investorCompany,
  loi_number: loi.loiNumber!,
  title: loi.title!,
  company_name: loi.companyName!,
  company_full_name: loi.companyFullName!,
  sfp_class: loi.sfpClass!,
  sfp_value: loi.sfpValue!,
  discount_percentage: loi.discountPercentage!,
  conversion_date: loi.conversionDate!,
  max_total_value: loi.maxTotalValue!,
  ticket_size: loi.ticketSize!,
  subscription_date: loi.subscriptionDate!,
  subscription_deadline: loi.subscriptionDeadline!,
  loi_expiry_date: loi.loiExpiryDate!,
  status: loi.status!,
  priority: loi.priority!,
  company_legal_address: loi.companyLegalAddress!,
  company_cap: loi.companyCAP!,
  company_city: loi.companyCity!,
  company_registration: loi.companyRegistration!,
  company_vat: loi.companyVAT!,
  company_capital: loi.companyCapital!,
  tax_benefit_percentage: loi.taxBenefitPercentage!,
  tax_benefit_value: loi.taxBenefitValue!,
  documents_provided: loi.documentsProvided!,
  payment_method: loi.paymentMethod!,
  confidentiality_period: loi.confidentialityPeriod!,
  competent_court: loi.competentCourt!,
  notes: loi.notes,
  created_at: loi.createdAt,
  updated_at: loi.updatedAt,
  created_by: loi.createdBy!
})

// Servizi per le LOI
export const loiService = {
  // Ottieni tutte le LOI
  async getAllLOIs(): Promise<LOI[]> {
    const { data, error } = await supabase
      .from('lois')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore nel recupero delle LOI:', error)
      throw new Error('Errore nel recupero delle LOI')
    }

    return data ? data.map(convertRowToLOI) : []
  },

  // Ottieni LOI per ID
  async getLOIById(id: string): Promise<LOI | null> {
    const { data, error } = await supabase
      .from('lois')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Errore nel recupero della LOI:', error)
      return null
    }

    return data ? convertRowToLOI(data) : null
  },

  // Ottieni LOI per investitore
  async getLOIsByInvestor(investorId: string): Promise<LOI[]> {
    const { data, error } = await supabase
      .from('lois')
      .select('*')
      .eq('investor_id', investorId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore nel recupero delle LOI per investitore:', error)
      throw new Error('Errore nel recupero delle LOI per investitore')
    }

    return data ? data.map(convertRowToLOI) : []
  },

  // Crea nuova LOI
  async createLOI(loi: Partial<LOI>): Promise<LOI> {
    const insertData = convertLOIToInsert({
      ...loi,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    const { data, error } = await supabase
      .from('lois')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Log più informativo per il debug
      const typedError = error as {
        message?: string
        details?: string
        hint?: string
        code?: string
      } | null
      console.error('Errore nella creazione della LOI:', {
        message: typedError?.message,
        details: typedError?.details,
        hint: typedError?.hint,
        code: typedError?.code,
        raw: error
      })
      throw new Error(typedError?.message || 'Errore nella creazione della LOI')
    }

    return convertRowToLOI(data)
  },

  // Aggiorna LOI
  async updateLOI(id: string, updates: Partial<LOI>): Promise<LOI> {
    const updateData: LOIUpdate = {
      ...convertLOIToInsert(updates),
      updated_at: new Date().toISOString()
    }

    // Rimuovi campi undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof LOIUpdate] === undefined) {
        delete updateData[key as keyof LOIUpdate]
      }
    })

    const { data, error } = await supabase
      .from('lois')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Errore nell\'aggiornamento della LOI:', error)
      throw new Error('Errore nell\'aggiornamento della LOI')
    }

    return convertRowToLOI(data)
  },

  // Elimina LOI
  async deleteLOI(id: string): Promise<void> {
    const { error } = await supabase
      .from('lois')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Errore nell\'eliminazione della LOI:', error)
      throw new Error('Errore nell\'eliminazione della LOI')
    }
  },

  // Ottieni statistiche LOI
  async getLOIStats(): Promise<{
    totalLOIs: number
    sentLOIs: number
    signedLOIs: number
    totalValue: number
    conversionRate: number
    pendingExpiry: number
  }> {
    const { data, error } = await supabase
      .from('lois')
      .select('status, sfp_value, loi_expiry_date')

    if (error) {
      console.error('Errore nel recupero delle statistiche:', error)
      throw new Error('Errore nel recupero delle statistiche')
    }

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const stats = data.reduce((acc, loi) => {
      acc.totalLOIs++
      acc.totalValue += loi.sfp_value

      if (loi.status === 'sent') acc.sentLOIs++
      if (loi.status === 'signed') acc.signedLOIs++

      // Conta LOI in scadenza
      const expiryDate = new Date(loi.loi_expiry_date)
      if (loi.status === 'sent' && expiryDate <= sevenDaysFromNow && expiryDate > now) {
        acc.pendingExpiry++
      }

      return acc
    }, {
      totalLOIs: 0,
      sentLOIs: 0,
      signedLOIs: 0,
      totalValue: 0,
      pendingExpiry: 0,
      conversionRate: 0
    })

    stats.conversionRate = stats.totalLOIs > 0 ? (stats.signedLOIs / stats.totalLOIs) * 100 : 0

    return stats
  },

  // Servizi per gli eventi LOI
  async listLoiEvents(loiId: string): Promise<LoiEvent[]> {
    const { data, error } = await supabase
      .from('fundops_loi_events')
      .select('*')
      .eq('loi_id', loiId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore nel recupero degli eventi LOI:', error)
      throw new Error('Errore nel recupero degli eventi LOI')
    }

    return data || []
  },

  async createLoiEvent(
    loiId: string,
    eventType: LoiEventType | string,
    metadata?: Record<string, unknown>
  ): Promise<LoiEvent | null> {
    try {
      const eventData = buildLoiEvent(eventType, {
        loi_id: loiId,
        metadata,
      })

      const { data, error } = await supabase
        .from('fundops_loi_events')
        .insert({
          loi_id: loiId,
          event_type: eventData.event_type,
          label: eventData.label,
          metadata: eventData.metadata || null,
          created_by: eventData.created_by || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Errore nella creazione dell\'evento LOI:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Errore nella creazione dell\'evento LOI:', error)
      return null
    }
  },

  async getLatestEventsForLois(loiIds: string[]): Promise<Record<string, LoiEvent>> {
    if (loiIds.length === 0) {
      return {}
    }

    const { data, error } = await supabase
      .from('fundops_loi_events')
      .select('*')
      .in('loi_id', loiIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore nel recupero degli ultimi eventi:', error)
      return {}
    }

    // Raggruppa per loi_id e prendi solo il primo (più recente) per ogni LOI
    const latestByLoiId: Record<string, LoiEvent> = {}
    if (data) {
      for (const event of data) {
        if (!latestByLoiId[event.loi_id]) {
          latestByLoiId[event.loi_id] = event
        }
      }
    }

    return latestByLoiId
  },

  // Segna una LOI come firmata (solo se status = sent)
  async markAsSigned(loiId: string, companyId: string): Promise<LOI> {
    const response = await fetch(`/api/fundops_lois/${loiId}/mark-signed?companyId=${companyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Errore nel segnare come firmata')
    }

    const result = await response.json()
    return result.data
  },

  // Annulla una LOI (solo se status ∈ [draft, sent])
  async cancelLoi(loiId: string, companyId: string): Promise<LOI> {
    const response = await fetch(`/api/fundops_lois/${loiId}/cancel?companyId=${companyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Errore nell\'annullamento della LOI')
    }

    const result = await response.json()
    return result.data
  },

  // Scade automaticamente le LOI scadute (server-side)
  // Questo metodo chiama l'endpoint server che trova e aggiorna tutte le LOI scadute
  async expireLois(companyId?: string): Promise<{ count: number; loiIds: string[] }> {
    const url = companyId 
      ? `/api/fundops_lois/expire?companyId=${companyId}`
      : '/api/fundops_lois/expire'
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Errore nella scadenza automatica delle LOI')
    }

    const result = await response.json()
    return {
      count: result.count || 0,
      loiIds: result.data || [],
    }
  }
}
