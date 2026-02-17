import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

const BUCKET = "fundops-documents";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/documents/[id]/download
 * Auth required. RLS on fundops_documents enforces access.
 * Returns signed URL (60s) for secure download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  const { id } = await params;
  if (!id) {
    return err("ID documento richiesto", 400);
  }

  const { data: document, error: docError } = await supabaseAuth
    .from("fundops_documents")
    .select("id, file_path, mime_type, title")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (docError || !document) {
    return err("Documento non trovato", 404);
  }

  if (!supabaseServer) {
    return err("Configurazione server mancante", 500);
  }

  const { data: signedUrlData, error: urlError } = await supabaseServer.storage
    .from(BUCKET)
    .createSignedUrl(document.file_path, 60);

  if (urlError || !signedUrlData?.signedUrl) {
    console.error("[documents/download] createSignedUrl:", urlError);
    return err("Errore nella generazione dell'URL di download", 500);
  }

  return new Response(
    JSON.stringify({ url: signedUrlData.signedUrl }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
