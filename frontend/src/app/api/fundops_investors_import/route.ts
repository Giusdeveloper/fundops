import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface ImportRow {
  full_name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  investor_type_raw?: string;
  source_type_raw?: string;
  client_company_raw?: string; // CSV "Company" = Cliente Imment
  investor_company_name_raw?: string; // CSV "Ragione Sociale"
  notes_final?: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: Array<{ index: number; reason: string }>;
  errors: Array<{ index: number; reason: string }>;
}

/**
 * Normalizza investor_type_raw in enum
 */
function normalizeInvestorType(raw: string | undefined | null): string | null {
  if (!raw) return null;
  
  const normalized = raw.toLowerCase().trim();
  
  if (normalized.includes('customer')) return 'customer';
  if (normalized.includes('exit')) return 'exit';
  if (normalized.includes('business')) return 'business_development';
  if (normalized.includes('influencer')) return 'influencer';
  if (normalized.includes('professional')) return 'professionals';
  
  return 'other';
}

/**
 * Determina se investor è azienda
 */
function isCompanyInvestor(
  investorTypeRaw?: string,
  sourceTypeRaw?: string
): boolean {
  const investorType = investorTypeRaw?.toLowerCase().trim() || '';
  const sourceType = sourceTypeRaw?.toLowerCase().trim() || '';
  
  const companyKeywords = ['azienda', 'company', 'corporate', 'institutional'];
  
  return (
    companyKeywords.some(kw => investorType.includes(kw)) ||
    companyKeywords.some(kw => sourceType.includes(kw))
  );
}

/**
 * Match Cliente Imment con fundops_companies
 */
async function matchClientCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientCompanyRaw: string | undefined | null,
  companyCache: Map<string, string | null>
): Promise<{ client_company_id: string | null; client_name: string | null; warning?: string }> {
  if (!clientCompanyRaw || !clientCompanyRaw.trim()) {
    return { client_company_id: null, client_name: null };
  }

  const normalized = clientCompanyRaw.trim();
  
  // Controlla cache
  if (companyCache.has(normalized)) {
    const cachedId = companyCache.get(normalized) ?? null;
    return {
      client_company_id: cachedId,
      client_name: cachedId ? null : normalized,
      warning: cachedId ? undefined : 'Cliente Imment non trovato in fundops_companies',
    };
  }

  // Query case-insensitive su name o legal_name
  const { data, error } = await supabase
    .from('fundops_companies')
    .select('id, name, legal_name')
    .or(`name.ilike.%${normalized}%,legal_name.ilike.%${normalized}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error matching client company:', error);
    companyCache.set(normalized, null);
    return {
      client_company_id: null,
      client_name: normalized,
      warning: 'Errore nella ricerca del cliente',
    };
  }

  if (data) {
    companyCache.set(normalized, data.id);
    return {
      client_company_id: data.id,
      client_name: null,
    };
  }

  // Non trovato
  companyCache.set(normalized, null);
  return {
    client_company_id: null,
    client_name: normalized,
    warning: 'Cliente Imment non trovato in fundops_companies',
  };
}

/**
 * Trova duplicati nel DB (ordine di priorità)
 */
async function findDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  row: ImportRow
): Promise<{ id: string; matchType: string } | null> {
  // 1. company_id + email (se email presente)
  if (row.email && row.email.trim() && row.email.includes('@')) {
    const { data } = await supabase
      .from('fundops_investors')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', row.email.trim().toLowerCase())
      .maybeSingle();
    
    if (data) {
      return { id: data.id, matchType: 'email' };
    }
  }

  // 2. company_id + full_name + linkedin
  if (row.full_name && row.linkedin && row.linkedin.trim()) {
    const { data } = await supabase
      .from('fundops_investors')
      .select('id')
      .eq('company_id', companyId)
      .eq('full_name', row.full_name.trim())
      .eq('linkedin', row.linkedin.trim())
      .maybeSingle();
    
    if (data) {
      return { id: data.id, matchType: 'name+linkedin' };
    }
  }

  // 3. company_id + full_name + phone
  if (row.full_name && row.phone && row.phone.trim()) {
    const { data } = await supabase
      .from('fundops_investors')
      .select('id')
      .eq('company_id', companyId)
      .eq('full_name', row.full_name.trim())
      .eq('phone', row.phone.trim())
      .maybeSingle();
    
    if (data) {
      return { id: data.id, matchType: 'name+phone' };
    }
  }

  // 4. company_id + full_name (solo se email assente - LOW CONFIDENCE)
  // Non facciamo match automatico su solo nome per evitare falsi positivi
  // Se email mancante, inseriamo nuovo e aggiungiamo warning

  return null;
}

/**
 * POST - Importa investitori da CSV
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, rows } = body;

    if (!companyId || companyId.trim() === '') {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const normalizedCompanyId = companyId.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }
    const hasAccess = await canAccessCompany(supabase, user.id, normalizedCompanyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'rows array is required and must not be empty' },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      warnings: [],
      errors: [],
    };

    // Cache per match client companies (batch lookup)
    const companyCache = new Map<string, string | null>();
    
    // Estrai set unico di client_company_raw per batch lookup
    const uniqueClientCompanies = new Set<string>();
    rows.forEach((row: ImportRow) => {
      if (row.client_company_raw && row.client_company_raw.trim()) {
        uniqueClientCompanies.add(row.client_company_raw.trim());
      }
    });

    // Batch lookup per client companies
    if (uniqueClientCompanies.size > 0) {
      const companyNames = Array.from(uniqueClientCompanies);
      // Query con OR per tutti i nomi
      const { data: companies, error: companiesError } = await supabase
        .from('fundops_companies')
        .select('id, name, legal_name');

      if (!companiesError && companies) {
        // Match case-insensitive in memoria
        companyNames.forEach((searchName) => {
          const normalizedSearch = searchName.toLowerCase();
          const matched = companies.find(
            (c) =>
              c.name?.toLowerCase().includes(normalizedSearch) ||
              c.legal_name?.toLowerCase().includes(normalizedSearch) ||
              normalizedSearch.includes(c.name?.toLowerCase() || '') ||
              normalizedSearch.includes(c.legal_name?.toLowerCase() || '')
          );
          companyCache.set(searchName, matched?.id || null);
        });
      }
    }

    // Processa ogni riga
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ImportRow;
      const rowIndex = i + 1; // 1-based per report

      // Validazione base
      if (!row.full_name || row.full_name.trim() === '') {
        result.errors.push({
          index: rowIndex,
          reason: 'Nome mancante',
        });
        result.skipped++;
        continue;
      }

      // Determina se investor è azienda
      const isCompany = isCompanyInvestor(row.investor_type_raw, row.source_type_raw);

      // Match Cliente Imment
      const clientMatch = await matchClientCompany(
        supabase,
        row.client_company_raw,
        companyCache
      );
      if (clientMatch.warning) {
        result.warnings.push({
          index: rowIndex,
          reason: clientMatch.warning,
        });
      }

      // Ragione sociale solo se investor è azienda
      let investorCompanyName: string | null = null;
      if (isCompany && row.investor_company_name_raw) {
        investorCompanyName = row.investor_company_name_raw.trim();
      } else if (!isCompany && row.investor_company_name_raw) {
        result.warnings.push({
          index: rowIndex,
          reason: 'Ragione sociale ignorata (investor persona fisica)',
        });
      }

      // Normalizza campi
      const normalizedData: Record<string, string | null> = {
        company_id: normalizedCompanyId,
        full_name: row.full_name.trim(),
        email: row.email?.trim().toLowerCase() || null,
        phone: row.phone?.trim() || null,
        linkedin: row.linkedin?.trim() || null,
        notes: row.notes_final?.trim() || null,
        investor_type: normalizeInvestorType(row.investor_type_raw),
        source_type: row.source_type_raw?.trim() || null,
        client_company_id: clientMatch.client_company_id,
        client_name: clientMatch.client_name,
        investor_company_name: investorCompanyName,
        updated_at: new Date().toISOString(),
      };

      // Warning per email mancante
      if (!normalizedData.email) {
        result.warnings.push({
          index: rowIndex,
          reason: 'Email mancante (dedupe debole)',
        });
      }

      // Cerca duplicato nel DB
      const duplicate = await findDuplicate(supabase, normalizedCompanyId, row);

      if (duplicate) {
        // UPDATE esistente
        if (duplicate.matchType === 'name_only') {
          result.warnings.push({
            index: rowIndex,
            reason: `Match solo per nome (bassa confidenza)`,
          });
        }

        const { error: updateError } = await supabase
          .from('fundops_investors')
          .update(normalizedData)
          .eq('id', duplicate.id);

        if (updateError) {
          result.errors.push({
            index: rowIndex,
            reason: `Errore aggiornamento: ${updateError.message}`,
          });
          result.skipped++;
        } else {
          result.updated++;
        }
      } else {
        // INSERT nuovo
        // Se email mancante e match solo per nome, aggiungi warning ma inserisci
        if (!normalizedData.email) {
          result.warnings.push({
            index: rowIndex,
            reason: 'Dedupe debole (solo nome) - inserito nuovo record',
          });
        }

        normalizedData.created_at = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('fundops_investors')
          .insert(normalizedData);

        if (insertError) {
          result.errors.push({
            index: rowIndex,
            reason: `Errore inserimento: ${insertError.message}`,
          });
          result.skipped++;
        } else {
          result.inserted++;
        }
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('Error in import endpoint:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
