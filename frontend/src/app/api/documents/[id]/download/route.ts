import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { driveFetch } from "@/lib/googleDrive";

const BUCKET = "fundops-documents";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authorizeCompanyAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  companyId: string
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return err(profileError.message, 500);
  if (profile?.is_active === false) return err("Forbidden", 403);

  const isStaff =
    profile?.role_global === "imment_admin" || profile?.role_global === "imment_operator";
  if (isStaff) return null;

  const { data: seat, error: seatError } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .maybeSingle();
  if (seatError) return err(seatError.message, 500);
  if (!seat) return err("Forbidden", 403);
  return null;
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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  const { id } = await params;
  if (!id) {
    return err("ID documento richiesto", 400);
  }

  const { data: document, error: docError } = await supabase
    .from("fundops_documents")
    .select("id, company_id, file_path, mime_type, title")
    .eq("id", id)
    .in("status", ["active", "uploaded", "ready"])
    .maybeSingle();

  if (docError || !document) {
    return err("Documento non trovato", 404);
  }

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, document.company_id);
  if (unauthorized) return unauthorized;

  if (document.file_path.startsWith("gdrive:")) {
    const driveFileId = document.file_path.slice("gdrive:".length).trim();
    if (!driveFileId) {
      return err("Percorso documento Drive non valido", 400);
    }

    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`);
    url.searchParams.set("fields", "webViewLink,webContentLink");
    url.searchParams.set("supportsAllDrives", "true");

    const res = await driveFetch(document.company_id, url.toString());
    const payload = (await res.json().catch(() => null)) as
      | { webViewLink?: string; webContentLink?: string; error?: { message?: string } }
      | null;

    if (!res.ok) {
      if (res.status === 401) {
        return err("Drive connection expired. Reconnect.", 401);
      }
      return err(payload?.error?.message || "Errore recupero link Drive", 500);
    }

    const targetUrl = payload?.webContentLink || payload?.webViewLink || null;
    if (!targetUrl) {
      return err("File Drive non disponibile", 404);
    }

    return json(200, { url: targetUrl });
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

  return json(200, { url: signedUrlData.signedUrl });
}
