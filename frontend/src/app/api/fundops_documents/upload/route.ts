import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { LoiEventType } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * POST - Carica un documento per una LOI
 * multipart/form-data: file, companyId, loiId, type, title
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const companyIdRaw = formData.get("companyId") as string;
    const loiId = formData.get("loiId") as string;
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;

    if (!file || !companyIdRaw || !loiId || !type || !title) {
      return NextResponse.json(
        { error: "file, companyId, loiId, type e title sono richiesti" },
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

    if (type !== "attachment") {
      return NextResponse.json(
        { error: "type deve essere 'attachment'" },
        { status: 400 }
      );
    }

    // Verifica che la LOI appartenga alla company
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("id, loi_number")
      .eq("id", loiId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (loiError || !loi) {
      return NextResponse.json(
        { error: "LOI non trovata o non appartiene alla company" },
        { status: 404 }
      );
    }

    // Genera path nel bucket: fundops/<companyId>/lois/<loiId>/attachments/<filename>
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `fundops/${companyId}/lois/${loiId}/attachments/${timestamp}_${sanitizedFilename}`;

    // Converti File in ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!supabaseServer) {
      return NextResponse.json(
        { error: "Configurazione storage server mancante" },
        { status: 500 }
      );
    }

    // Upload su Supabase Storage usando service role (bypassa RLS)
    const { error: uploadError } = await supabaseServer.storage
      .from("fundops-documents")
      .upload(filePath, buffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: `Errore nel caricamento: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Salva record in fundops_documents
    const { data: document, error: docError } = await supabase
      .from("fundops_documents")
      .insert({
        company_id: companyId,
        loi_id: loiId,
        type: "attachment",
        title: title,
        file_path: filePath,
        mime_type: file.type || "application/pdf",
        size_bytes: file.size,
        version: 1,
        status: "active",
        created_by: user.id,
      })
      .select()
      .single();

    if (docError) {
      console.error("Error saving document record:", docError);
      // Prova a eliminare il file caricato se il record non viene salvato
      await supabaseServer.storage.from("fundops-documents").remove([filePath]);
      return NextResponse.json(
        { error: `Errore nel salvataggio del record: ${docError.message}` },
        { status: 500 }
      );
    }

    // Crea evento nella timeline
    try {
      await supabase.from("fundops_loi_events").insert({
        loi_id: loiId,
        event_type: LoiEventType.DOCUMENT_UPLOADED,
        label: "Documento caricato",
        metadata: {
          type: "attachment",
          title: title,
          version: 1,
          documentId: document.id,
        },
        created_by: user.id,
      });
    } catch (eventError) {
      console.warn("Error creating document event:", eventError);
      // Non bloccare se l'evento non viene creato
    }

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in upload endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
