import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface Update {
  investor_id: string;
  company_id: string;
  match_type: "manual" | "exact" | "normalized";
}

interface ApplyRequest {
  companyId: string;
  updates: Update[];
  force?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body: ApplyRequest = await request.json();
    const normalizedCompanyId = body.companyId?.trim();

    if (!normalizedCompanyId) {
      return NextResponse.json(
        { error: "companyId è richiesto" },
        { status: 400 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }
    const hasAccess = await canAccessCompany(supabase, user.id, normalizedCompanyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validazione payload
    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { error: "updates deve essere un array non vuoto" },
        { status: 400 }
      );
    }

    // Verifica accesso esplicito anche alle company target presenti negli update
    const targetCompanyIds = Array.from(
      new Set(
        body.updates
          .map((u) => (typeof u.company_id === "string" ? u.company_id.trim() : ""))
          .filter((id) => id.length > 0)
      )
    );

    for (const targetCompanyId of targetCompanyIds) {
      const hasTargetAccess = await canAccessCompany(
        supabase,
        user.id,
        targetCompanyId,
        roleContext
      );
      if (!hasTargetAccess) {
        return NextResponse.json(
          { error: `Forbidden for target companyId: ${targetCompanyId}` },
          { status: 403 }
        );
      }
    }

    const force = body.force === true;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ investor_id: string; reason: string }> = [];

    // Processa ogni update
    for (const update of body.updates) {
      const normalizedTargetCompanyId =
        typeof update.company_id === "string" ? update.company_id.trim() : "";

      // Validazione update
      if (!update.investor_id || !normalizedTargetCompanyId || !update.match_type) {
        errors.push({
          investor_id: update.investor_id || "unknown",
          reason: "Campi mancanti: investor_id, company_id, match_type sono richiesti",
        });
        skipped++;
        continue;
      }

      if (!["manual", "exact", "normalized"].includes(update.match_type)) {
        errors.push({
          investor_id: update.investor_id,
          reason: `match_type invalido: ${update.match_type}`,
        });
        skipped++;
        continue;
      }

      try {
        // Costruisci query update
        const updateData: Record<string, string> = {
          client_company_id: normalizedTargetCompanyId,
          client_company_match_type: update.match_type,
          client_company_matched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        let query = supabase
          .from("fundops_investors")
          .update(updateData)
          .eq("id", update.investor_id)
          .eq("company_id", normalizedCompanyId);

        // Se force è false, aggiorna solo se client_company_id è NULL
        if (!force) {
          query = query.is("client_company_id", null);
        }

        const { error: updateError, data } = await query.select("id").maybeSingle();

        if (updateError) {
          errors.push({
            investor_id: update.investor_id,
            reason: `Errore database: ${updateError.message}`,
          });
          skipped++;
          continue;
        }

        // Se non trovato o già aggiornato (quando force=false)
        if (!data) {
          errors.push({
            investor_id: update.investor_id,
            reason: force
              ? "Investitore non trovato"
              : "Investitore già ha client_company_id impostato (usa force=true per sovrascrivere)",
          });
          skipped++;
          continue;
        }

        updated++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Errore sconosciuto";
        errors.push({
          investor_id: update.investor_id,
          reason: `Errore: ${message}`,
        });
        skipped++;
      }
    }

    return NextResponse.json({
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore interno del server";
    console.error("Error in apply:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
