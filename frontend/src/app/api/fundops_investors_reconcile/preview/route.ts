import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * Normalizza nome company per matching
 * - lowercase
 * - remove punctuation: /[.,;:\-_\/]/g
 * - collapse spaces: /\s+/g -> ' '
 * - trim
 * - remove suffixes: srl, s.r.l, srls, spa, s.p.a, snc, sas (word boundary)
 */
function normalizeCompanyName(name: string): string {
  if (!name) return "";
  
  let normalized = name.toLowerCase().trim();
  
  // Remove punctuation
  normalized = normalized.replace(/[.,;:\-_\/]/g, "");
  
  // Collapse spaces
  normalized = normalized.replace(/\s+/g, " ");
  
  // Remove Italian company suffixes (word boundary)
  // Include anche varianti comuni: SB (Società Benefit), SRLS, ecc.
  const suffixes = [
    "srl", "s.r.l", "srls", "s.r.l.s", 
    "spa", "s.p.a", 
    "snc", "s.n.c",
    "sas", "s.a.s",
    "sb", "s.b", // Società Benefit
    "ss", "s.s", // Società Semplice
    "sc", "s.c", // Società Cooperativa
    "scarl", "s.c.a.r.l", // Società Cooperativa a Responsabilità Limitata
  ];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\b${suffix.replace(/\./g, "\\.")}\\b`, "gi");
    normalized = normalized.replace(regex, "").trim();
  }
  
  // Final trim and collapse spaces again
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

/**
 * Normalizza nome per exact match (rimuove suffissi anche qui)
 */
function normalizeForExactMatch(name: string): string {
  if (!name) return "";
  return normalizeCompanyName(name);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId è richiesto" },
        { status: 400 }
      );
    }
    const normalizedCompanyId = companyId.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }
    const hasAccess = await canAccessCompany(
      supabase,
      user.id,
      normalizedCompanyId,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Carica tutte le companies
    const { data: companies, error: companiesError } = await supabase
      .from("fundops_companies")
      .select("id, name");

    if (companiesError) {
      console.error("Error loading companies:", companiesError);
      return NextResponse.json(
        { error: "Errore nel caricamento delle companies" },
        { status: 500 }
      );
    }

    // 2. Costruisci mappe per matching
    const exactMap = new Map<string, { id: string; name: string }>();
    const exactMapNormalized = new Map<string, { id: string; name: string }>(); // Exact match senza suffissi
    const normMap = new Map<string, Array<{ id: string; name: string }>>();

    companies?.forEach((company) => {
      // Exact map: lowercase name (originale)
      const exactKey = company.name.toLowerCase().trim();
      if (exactKey && !exactMap.has(exactKey)) {
        exactMap.set(exactKey, { id: company.id, name: company.name });
      }

      // Exact map normalized: senza suffissi (per match più flessibile)
      const exactKeyNormalized = normalizeForExactMatch(company.name);
      if (exactKeyNormalized && !exactMapNormalized.has(exactKeyNormalized)) {
        exactMapNormalized.set(exactKeyNormalized, { id: company.id, name: company.name });
      }

      // Normalized map (per match fuzzy)
      const normKey = normalizeCompanyName(company.name);
      if (normKey) {
        if (!normMap.has(normKey)) {
          normMap.set(normKey, []);
        }
        normMap.get(normKey)!.push({ id: company.id, name: company.name });
      }
    });

    // 3. Carica investors con client_name non null
    const { data: investors, error: investorsError } = await supabase
      .from("fundops_investors")
      .select("id, full_name, client_name, client_company_id")
      .eq("company_id", normalizedCompanyId)
      .not("client_name", "is", null)
      .neq("client_name", "");

    if (investorsError) {
      console.error("Error loading investors:", investorsError);
      return NextResponse.json(
        { error: "Errore nel caricamento degli investitori" },
        { status: 500 }
      );
    }

    // 4. Processa ogni investor
    const results: Array<{
      investor_id: string;
      investor_name: string;
      client_name: string;
      status: "already_set" | "matched" | "not_found" | "ambiguous";
      match_type?: "exact" | "normalized";
      matched_company_id?: string;
      matched_company_name?: string;
      candidates?: Array<{ id: string; name: string }>;
    }> = [];

    let total = 0;
    let already_set = 0;
    let matched = 0;
    let not_found = 0;
    let ambiguous = 0;

    investors?.forEach((investor) => {
      total++;

      // Se già ha client_company_id -> already_set
      if (investor.client_company_id) {
        already_set++;
        results.push({
          investor_id: investor.id,
          investor_name: investor.full_name || "N/A",
          client_name: investor.client_name || "",
          status: "already_set",
        });
        return;
      }

      const clientName = investor.client_name || "";

      // Try exact match (originale)
      const exactKey = clientName.toLowerCase().trim();
      const exactMatch = exactMap.get(exactKey);

      if (exactMatch) {
        matched++;
        results.push({
          investor_id: investor.id,
          investor_name: investor.full_name || "N/A",
          client_name: clientName,
          status: "matched",
          match_type: "exact",
          matched_company_id: exactMatch.id,
          matched_company_name: exactMatch.name,
        });
        return;
      }

      // Try exact match normalized (senza suffissi) - più flessibile
      const exactKeyNormalized = normalizeForExactMatch(clientName);
      const exactMatchNormalized = exactMapNormalized.get(exactKeyNormalized);

      if (exactMatchNormalized) {
        matched++;
        results.push({
          investor_id: investor.id,
          investor_name: investor.full_name || "N/A",
          client_name: clientName,
          status: "matched",
          match_type: "exact",
          matched_company_id: exactMatchNormalized.id,
          matched_company_name: exactMatchNormalized.name,
        });
        return;
      }

      // Try normalized match (fuzzy, senza punteggiatura e suffissi)
      const normKey = normalizeCompanyName(clientName);
      const normMatches = normMap.get(normKey);

      if (normMatches && normMatches.length === 1) {
        matched++;
        results.push({
          investor_id: investor.id,
          investor_name: investor.full_name || "N/A",
          client_name: clientName,
          status: "matched",
          match_type: "normalized",
          matched_company_id: normMatches[0].id,
          matched_company_name: normMatches[0].name,
        });
        return;
      }

      if (normMatches && normMatches.length > 1) {
        ambiguous++;
        results.push({
          investor_id: investor.id,
          investor_name: investor.full_name || "N/A",
          client_name: clientName,
          status: "ambiguous",
          candidates: normMatches,
        });
        return;
      }

      // Try partial match con scoring: cerca se il nome normalizzato è contenuto o contiene un nome company
      // Utile per casi come "Working Mom Srl SB" vs "Working Mom", "MarshYellow Srl" vs "MarshYellow", "Feelers Srls" vs "Feelers"
      if (normKey && normKey.length > 3) {
        const partialMatches: Array<{ id: string; name: string; score: number }> = [];
        
        // Itera su tutte le companies normalizzate per trovare match parziali
        normMap.forEach((companyArray, normalizedCompanyName) => {
          let score = 0;
          
          // Match esatto dopo normalizzazione (dovrebbe essere già catturato sopra, ma per sicurezza)
          if (normalizedCompanyName === normKey) {
            score = 100;
          }
          // Il nome company contiene il nome investitore (es. "MarshYellow Srl" contiene "MarshYellow")
          else if (normalizedCompanyName.includes(normKey)) {
            // Calcola score basato sulla similarità (più lungo il match, migliore)
            score = (normKey.length / normalizedCompanyName.length) * 85;
          }
          // Il nome investitore contiene il nome company (es. "MarshYellow" contiene "MarshYellow Srl" dopo normalizzazione)
          else if (normKey.includes(normalizedCompanyName)) {
            score = (normalizedCompanyName.length / normKey.length) * 85;
          }
          // Match per "starts with" - molto comune (es. "Feelers Srls" vs "Feelers")
          else if (normalizedCompanyName.startsWith(normKey) || normKey.startsWith(normalizedCompanyName)) {
            const longer = Math.max(normalizedCompanyName.length, normKey.length);
            const shorter = Math.min(normalizedCompanyName.length, normKey.length);
            score = (shorter / longer) * 75;
          }
          // Match per similarità delle parole principali (split per spazio)
          else {
            const investorWords = normKey.split(/\s+/).filter(w => w.length > 2);
            const companyWords = normalizedCompanyName.split(/\s+/).filter(w => w.length > 2);
            
            if (investorWords.length > 0 && companyWords.length > 0) {
              // Conta quante parole principali corrispondono
              const matchingWords = investorWords.filter(iw => 
                companyWords.some(cw => cw.includes(iw) || iw.includes(cw))
              );
              
              if (matchingWords.length > 0) {
                // Score basato sulla percentuale di parole corrispondenti
                score = (matchingWords.length / Math.max(investorWords.length, companyWords.length)) * 65;
              }
            }
          }
          
          // Aggiungi solo se score è sufficientemente alto (minimo 50%)
          if (score >= 50) {
            companyArray.forEach(company => {
              const existing = partialMatches.find(c => c.id === company.id);
              if (!existing) {
                partialMatches.push({ id: company.id, name: company.name, score });
              } else if (score > existing.score) {
                existing.score = score;
              }
            });
          }
        });

        // Ordina per score decrescente
        partialMatches.sort((a, b) => b.score - a.score);

        if (partialMatches.length === 1) {
          matched++;
          results.push({
            investor_id: investor.id,
            investor_name: investor.full_name || "N/A",
            client_name: clientName,
            status: "matched",
            match_type: "normalized",
            matched_company_id: partialMatches[0].id,
            matched_company_name: partialMatches[0].name,
          });
          return;
        }

        if (partialMatches.length > 1) {
          // Se il primo match ha uno score molto più alto degli altri, considera solo quello
          if (partialMatches[0].score >= 70 && partialMatches[0].score > partialMatches[1].score + 15) {
            matched++;
            results.push({
              investor_id: investor.id,
              investor_name: investor.full_name || "N/A",
              client_name: clientName,
              status: "matched",
              match_type: "normalized",
              matched_company_id: partialMatches[0].id,
              matched_company_name: partialMatches[0].name,
            });
            return;
          }
          
          // Altrimenti è ambiguo
          ambiguous++;
          results.push({
            investor_id: investor.id,
            investor_name: investor.full_name || "N/A",
            client_name: clientName,
            status: "ambiguous",
            candidates: partialMatches.map(p => ({ id: p.id, name: p.name })),
          });
          return;
        }
      }

      // Not found
      not_found++;
      results.push({
        investor_id: investor.id,
        investor_name: investor.full_name || "N/A",
        client_name: clientName,
        status: "not_found",
      });
    });

    return NextResponse.json({
      total,
      already_set,
      matched,
      not_found,
      ambiguous,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore interno del server";
    console.error("Error in preview:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
