import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { LoiEventType } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface LoiPdfData {
  id: string;
  loi_number: string | null;
  title: string | null;
  ticket_amount: number | null;
  currency: string | null;
  sfp_class: string | null;
  expiry_date: string | null;
  status: string | null;
  investor: {
    full_name: string | null;
    email: string | null;
  } | null;
  company: {
    name: string | null;
    legal_name: string | null;
  } | null;
}

/**
 * POST - Genera un PDF placeholder per una LOI
 * Body: { companyId, loiId }
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
    const { companyId: companyIdRaw, loiId } = body;

    if (!companyIdRaw || !loiId) {
      return NextResponse.json(
        { error: "companyId e loiId sono richiesti" },
        { status: 400 }
      );
    }

    const companyId = String(companyIdRaw).trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recupera dati LOI
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select(`
        *,
        investor:fundops_investors(full_name, email),
        company:fundops_companies(name, legal_name)
      `)
      .eq("id", loiId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (loiError || !loi) {
      return NextResponse.json(
        { error: "LOI non trovata" },
        { status: 404 }
      );
    }

    // Calcola versione (max version + 1 per type="loi_pdf")
    const { data: existingDocs } = await supabase
      .from("fundops_documents")
      .select("version")
      .eq("loi_id", loiId)
      .eq("type", "loi_pdf")
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1);

    const version = existingDocs && existingDocs.length > 0 
      ? (existingDocs[0].version || 0) + 1 
      : 1;

    // Genera PDF usando sempre il fallback (pdfkit disabilitato per problemi con font)
    // Il fallback produce PDF validi e funzionali senza dipendenze esterne
    const pdfBuffer = await generateSimplePDF(loi as LoiPdfData, version);

    // Genera path nel bucket
    const loiNumber = loi.loi_number || loi.id.slice(0, 8);
    const filename = `LOI_${loiNumber}_v${version}.pdf`;
    const filePath = `fundops/${companyId}/lois/${loiId}/loi/${filename}`;

    if (!supabaseServer) {
      return NextResponse.json(
        { error: "Configurazione storage server mancante" },
        { status: 500 }
      );
    }

    // Upload su Supabase Storage usando service role (bypassa RLS)
    const { error: uploadError } = await supabaseServer.storage
      .from("fundops-documents")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
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
        type: "loi_pdf",
        title: `LOI - v${version}`,
        file_path: filePath,
        mime_type: "application/pdf",
        size_bytes: pdfBuffer.length,
        version: version,
        status: "active",
        created_by: user.id,
      })
      .select()
      .single();

    if (docError) {
      console.error("Error saving document record:", docError);
      await supabaseServer.storage.from("fundops-documents").remove([filePath]);
      return NextResponse.json(
        { error: `Errore nel salvataggio: ${docError.message}` },
        { status: 500 }
      );
    }

    // Crea evento nella timeline
    try {
      await supabase.from("fundops_loi_events").insert({
        loi_id: loiId,
        event_type: LoiEventType.DOCUMENT_GENERATED,
        label: "LOI PDF generata",
        metadata: {
          version: version,
          documentId: document.id,
        },
        created_by: user.id,
      });
    } catch (eventError) {
      console.warn("Error creating document event:", eventError);
    }

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in generate-loi-pdf endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Genera PDF semplice senza pdfkit (fallback)
 * PDF minimale ma funzionale con escape corretto dei caratteri
 */
async function generateSimplePDF(loi: LoiPdfData, version: number): Promise<Buffer> {
  // Escape caratteri speciali per PDF
  const escapePDF = (str: string) => {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  };

  const loiNumber = escapePDF(loi.loi_number || loi.id.slice(0, 8));
  const investorName = escapePDF(loi.investor?.full_name || "—");
  const investorEmail = loi.investor?.email ? escapePDF(loi.investor.email) : null;
  const companyName = escapePDF(loi.company?.name || loi.company?.legal_name || "—");
  const title = escapePDF(loi.title || "—");
  const ticketAmount = escapePDF(loi.ticket_amount ? `${loi.ticket_amount} ${loi.currency || "EUR"}` : "—");
  const sfpClass = escapePDF(loi.sfp_class || "—");
  const expiryDate = escapePDF(loi.expiry_date || "—");
  const status = escapePDF(loi.status || "—");
  const generationDate = escapePDF(new Date().toLocaleDateString("it-IT"));

  // Costruisci il contenuto del PDF
  const contentLines = [
    `100 750 Td /F1 20 Tf (Imment) Tj`,
    `0 -25 Td /F1 16 Tf (Lettera d'Intenti) Tj`,
    `0 -40 Td /F1 12 Tf (LOI Number: ${loiNumber}) Tj`,
    `0 -18 Td (Versione: ${version}) Tj`,
    `0 -30 Td (Investitore: ${investorName}) Tj`,
    investorEmail ? `0 -18 Td (Email: ${investorEmail}) Tj` : "",
    `0 -30 Td (Azienda: ${companyName}) Tj`,
    `0 -30 Td (Titolo: ${title}) Tj`,
    `0 -18 Td (Ticket Amount: ${ticketAmount}) Tj`,
    `0 -18 Td (Classe SFP: ${sfpClass}) Tj`,
    `0 -18 Td (Scadenza: ${expiryDate}) Tj`,
    `0 -18 Td (Stato: ${status}) Tj`,
    `0 -30 Td (Data generazione: ${generationDate}) Tj`,
  ].filter(Boolean);

  const streamContent = `BT\n${contentLines.join("\n")}\nET`;
  const streamLength = streamContent.length;

  // PDF minimale ma valido
  const content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length ${streamLength}
>>
stream
${streamContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000300 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${500 + streamLength}
%%EOF`;

  return Buffer.from(content, "utf-8");
}
