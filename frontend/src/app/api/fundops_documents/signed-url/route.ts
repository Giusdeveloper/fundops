import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * GET - Genera una signed URL per scaricare un documento
 * Query params: documentId, companyId
 * Usa client auth per RLS (company seat / investor / admin)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const companyIdRaw = searchParams.get("companyId");

    if (!documentId || !companyIdRaw) {
      return NextResponse.json(
        { error: "documentId e companyId sono richiesti" },
        { status: 400 }
      );
    }

    const companyId = companyIdRaw.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recupera il documento (RLS applica: company seat / investor / admin)
    const { data: document, error: docError } = await supabase
      .from("fundops_documents")
      .select("file_path, company_id, status")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Documento non trovato" },
        { status: 404 }
      );
    }

    if (!supabaseServer) {
      return NextResponse.json(
        { error: "Configurazione storage server mancante" },
        { status: 500 }
      );
    }

    // Genera signed URL usando service role (scadenza 60 minuti = 3600 secondi)
    const { data: signedUrlData, error: urlError } = await supabaseServer.storage
      .from("fundops-documents")
      .createSignedUrl(document.file_path, 3600);

    if (urlError || !signedUrlData) {
      console.error("Error generating signed URL:", urlError);
      return NextResponse.json(
        { error: "Errore nella generazione dell'URL" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        url: signedUrlData.signedUrl,
        expiresIn: 3600,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
