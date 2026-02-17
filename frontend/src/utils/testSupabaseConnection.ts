import { supabase } from '@/lib/supabaseClient'

/**
 * Testa la connessione a Supabase
 * @returns Promise<boolean> - true se la connessione è riuscita
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testando connessione a Supabase...')
    
    // Testa la connessione effettuando una query semplice
    // Prova prima con fundops_investors (tabella effettiva)
    const { error } = await supabase
      .from('fundops_investors')
      .select('id')
      .limit(1)
    
    if (error) {
      // Se fallisce, prova con investors (per retrocompatibilità)
      const { error: error2 } = await supabase
        .from('investors')
        .select('id')
        .limit(1)
      
      if (error2) {
        console.warn('⚠️ Connessione Supabase: tabelle non trovate. Verifica che le tabelle esistano nel database.')
        return false
      }
    }
    
    console.log('✅ Connessione a Supabase riuscita!')
    return true
    
  } catch (error) {
    console.error('❌ Errore critico connessione Supabase:', error)
    return false
  }
}

/**
 * Testa se le tabelle esistono
 * @returns Promise<{investors: boolean, lois: boolean}>
 */
export async function testTablesExistence(): Promise<{investors: boolean, lois: boolean}> {
  const result = { investors: false, lois: false }
  
  try {
    // Test tabella fundops_investors (tabella effettiva)
    const { error: investorsError } = await supabase
      .from('fundops_investors')
      .select('id')
      .limit(1)
    
    if (investorsError) {
      // Fallback a investors per retrocompatibilità
      const { error: investorsError2 } = await supabase
        .from('investors')
        .select('id')
        .limit(1)
      result.investors = !investorsError2
    } else {
      result.investors = true
    }
    
    // Test tabella fundops_lois (tabella effettiva)
    const { error: loisError } = await supabase
      .from('fundops_lois')
      .select('id')
      .limit(1)
    
    if (loisError) {
      // Fallback a lois per retrocompatibilità
      const { error: loisError2 } = await supabase
        .from('lois')
        .select('id')
        .limit(1)
      result.lois = !loisError2
    } else {
      result.lois = true
    }
    
    console.log('📋 Stato tabelle:', result)
    return result
    
  } catch (error) {
    console.error('❌ Errore nel test delle tabelle:', error)
    return result
  }
}

/**
 * Inizializza il database con dati di esempio se vuoto
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Inizializzazione database...')
    
    // Controlla se ci sono già investitori
    const { data: existingInvestors, error: investorsError } = await supabase
      .from('investors')
      .select('id')
      .limit(1)
    
    if (investorsError) {
      console.error('❌ Errore nel controllo investitori:', investorsError)
      return
    }
    
    // Se non ci sono investitori, inserisci dati di esempio
    if (!existingInvestors || existingInvestors.length === 0) {
      console.log('📝 Inserimento dati di esempio...')
      
      const sampleInvestors = [
        {
          name: 'Marco Rossi',
          email: 'marco.rossi@venturecapital.it',
          phone: '+39 333 123 4567',
          company: 'Venture Capital Partners',
          position: 'Managing Partner',
          status: 'active' as const,
          category: 'vc' as const,
          notes: 'Interessato a progetti fintech e AI. Molto reattivo.',
          total_invested: 500000,
          number_of_investments: 1,
          preferred_contact_method: 'email' as const,
          investor_type: 'business_development' as const,
          motivation: 'Interessato a progetti innovativi nel settore fintech con potenziale di crescita internazionale.',
          linkedin: 'https://linkedin.com/in/marco-rossi-vc'
        },
        {
          name: 'Anna Bianchi',
          email: 'anna.bianchi@angelgroup.com',
          phone: '+39 347 987 6543',
          company: 'Angel Group Milano',
          position: 'Angel Investor',
          status: 'active' as const,
          category: 'angel' as const,
          notes: 'Ex-founder di startup tech. Esperta in go-to-market.',
          total_invested: 300000,
          number_of_investments: 1,
          preferred_contact_method: 'meeting' as const,
          investor_type: 'customer' as const,
          motivation: 'Vuole supportare startup tech italiane con la sua esperienza imprenditoriale e network.',
          linkedin: 'https://linkedin.com/in/anna-bianchi-angel'
        }
      ]
      
      const { error: insertError } = await supabase
        .from('investors')
        .insert(sampleInvestors)
      
      if (insertError) {
        console.error('❌ Errore nell\'inserimento dati di esempio:', insertError)
      } else {
        console.log('✅ Dati di esempio inseriti con successo!')
      }
    } else {
      console.log('ℹ️ Database già popolato, nessuna inizializzazione necessaria')
    }
    
  } catch (error) {
    console.error('❌ Errore nell\'inizializzazione:', error)
  }
}
