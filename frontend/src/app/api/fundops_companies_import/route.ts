import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleContext, isGlobalFundopsRole } from "@/lib/companyAccess";

interface ImportRow {
  name: string; // Required
  legal_name?: string; // Opzionale
  vat_number?: string;
  email?: string;
  pec?: string;
  settore?: string;
  website?: string;
  profilo_linkedin?: string;
  notes?: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: Array<{ index: number; reason: string }>;
  errors: Array<{ index: number; reason: string }>;
  results?: Array<{
    index: number;
    action: 'inserted' | 'updated' | 'skipped';
    match_strategy?: string;
    company_id?: string;
    warnings?: string[];
    errors?: string[];
  }>;
}

/**
 * Trova duplicato nel DB
 * Priorità: 1) vat_number (exact) → 2) name (ILIKE)
 */
async function findDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ImportRow
): Promise<{ id: string; matchType: string } | null> {
  // 1. vat_number (exact match, se presente e valido)
  if (row.vat_number && row.vat_number.trim() && row.vat_number.length === 11) {
    const { data } = await supabase
      .from('fundops_companies')
      .select('id')
      .eq('vat_number', row.vat_number.trim())
      .maybeSingle();
    
    if (data) {
      return { id: data.id, matchType: 'vat_number' };
    }
  }

  // 2. name (case-insensitive, ILIKE)
  if (row.name && row.name.trim()) {
    const { data } = await supabase
      .from('fundops_companies')
      .select('id')
      .ilike('name', row.name.trim())
      .maybeSingle();
    
    if (data) {
      return { id: data.id, matchType: 'name' };
    }
  }

  return null;
}

/**
 * POST - Importa aziende da CSV
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

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }
    if (!isGlobalFundopsRole(roleContext.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { rows } = body;

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
      results: [],
    };

    // Processa ogni riga
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ImportRow;
      const rowIndex = i + 1; // 1-based per report

      // Validazione base
      if (!row.name || row.name.trim() === '') {
        result.errors.push({
          index: rowIndex,
          reason: 'Nome mancante',
        });
        result.skipped++;
        result.results!.push({
          index: rowIndex,
          action: 'skipped',
          errors: ['Nome mancante'],
        });
        continue;
      }

      // Normalizza campi (aggiorna solo campi non-null in arrivo)
      // IMPORTANTE: aggiungi solo campi che esistono nella tabella per evitare errori
      const normalizedData: Record<string, string> = {
        updated_at: new Date().toISOString(),
      };

      // Campi base (sempre presenti)
      if (row.name?.trim()) {
        normalizedData.name = row.name.trim();
      }
      if (row.legal_name?.trim()) {
        normalizedData.legal_name = row.legal_name.trim();
      } else if (row.name?.trim()) {
        // Duplica name in legal_name se non presente
        normalizedData.legal_name = row.name.trim();
      }
      if (row.vat_number?.trim() && row.vat_number.length === 11) {
        normalizedData.vat_number = row.vat_number.trim();
      }

      // Campi opzionali (aggiungi solo se hanno valore, evita di aggiungere campi null)
      // Nota: questi campi potrebbero non esistere nella tabella se la migration non è stata eseguita
      // In quel caso, l'errore verrà gestito nel catch
      if (row.email?.trim()) {
        normalizedData.email = row.email.trim().toLowerCase();
      }
      if (row.pec?.trim()) {
        normalizedData.pec = row.pec.trim().toLowerCase();
      }
      if (row.settore?.trim()) {
        normalizedData.settore = row.settore.trim();
      }
      if (row.website?.trim()) {
        normalizedData.website = row.website.trim();
      }
      if (row.profilo_linkedin?.trim()) {
        normalizedData.profilo_linkedin = row.profilo_linkedin.trim();
      }
      if (row.notes?.trim()) {
        normalizedData.notes = row.notes.trim();
      }

      // Cerca duplicato nel DB
      const duplicate = await findDuplicate(supabase, row);
      const rowWarnings: string[] = [];
      const rowErrors: string[] = [];

      if (duplicate) {
        // UPDATE esistente: aggiorna solo campi non-null
        const { error: updateError, data: updatedData } = await supabase
          .from('fundops_companies')
          .update(normalizedData)
          .eq('id', duplicate.id)
          .select('id')
          .single();

        if (updateError) {
          const errorMsg = `Errore aggiornamento: ${updateError.message}`;
          result.errors.push({
            index: rowIndex,
            reason: errorMsg,
          });
          rowErrors.push(errorMsg);
          result.skipped++;
          result.results!.push({
            index: rowIndex,
            action: 'skipped',
            match_strategy: duplicate.matchType,
            errors: rowErrors,
          });
        } else {
          result.updated++;
          result.results!.push({
            index: rowIndex,
            action: 'updated',
            match_strategy: duplicate.matchType,
            company_id: updatedData?.id,
            warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
          });
        }
      } else {
        // INSERT nuovo: tutti i campi richiesti
        const insertData: Record<string, string> = {
          name: row.name.trim(), // name è required
          created_at: new Date().toISOString(),
        };
        
        // Duplica name in legal_name se non presente
        if (row.legal_name?.trim()) {
          insertData.legal_name = row.legal_name.trim();
        } else {
          insertData.legal_name = insertData.name;
        }
        
        // Aggiungi vat_number se valido
        if (row.vat_number?.trim() && row.vat_number.length === 11) {
          insertData.vat_number = row.vat_number.trim();
        }
        
        // Aggiungi altri campi opzionali solo se hanno valore
        // Nota: questi campi potrebbero non esistere nella tabella se la migration non è stata eseguita
        if (row.email?.trim()) {
          insertData.email = row.email.trim().toLowerCase();
        }
        if (row.pec?.trim()) {
          insertData.pec = row.pec.trim().toLowerCase();
        }
        if (row.settore?.trim()) {
          insertData.settore = row.settore.trim();
        }
        if (row.website?.trim()) {
          insertData.website = row.website.trim();
        }
        if (row.profilo_linkedin?.trim()) {
          insertData.profilo_linkedin = row.profilo_linkedin.trim();
        }
        if (row.notes?.trim()) {
          insertData.notes = row.notes.trim();
        }

        const { error: insertError, data: insertedData } = await supabase
          .from('fundops_companies')
          .insert(insertData)
          .select('id')
          .single();

        if (insertError) {
          const errorMsg = `Errore inserimento: ${insertError.message}`;
          result.errors.push({
            index: rowIndex,
            reason: errorMsg,
          });
          rowErrors.push(errorMsg);
          result.skipped++;
          result.results!.push({
            index: rowIndex,
            action: 'skipped',
            errors: rowErrors,
          });
        } else {
          result.inserted++;
          result.results!.push({
            index: rowIndex,
            action: 'inserted',
            company_id: insertedData?.id,
            warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
          });
        }
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('Error in companies import endpoint:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
