import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";
import { PDFDocument, PDFTextField, degrees, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

interface CompanyData {
  legal_name?: string | null;
  vat_number?: string | null;
  address?: string | null;
}

interface InvestorData {
  full_name?: string | null;
  email?: string | null;
}

/**
 * GET /api/lois/[id]/signers/[signer_id]/pdf
 * Genera PDF LOI per un signer specifico usando il template fornito
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; signer_id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id: loiId, signer_id: signerId } = await params;

    if (!loiId || !signerId) {
      return NextResponse.json(
        { error: "loi_id e signer_id sono richiesti" },
        { status: 400 }
      );
    }

    // 1. Recupera LOI master con dati company
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select(`
        id,
        company_id,
        round_name,
        title,
        master_expires_at,
        premessa_text,
        modalita_text,
        condizioni_text,
        regolamento_ref,
        pdf_template_key,
        pdf_template_version,
        fundops_companies:company_id (
          id,
          name,
          legal_name,
          vat_number,
          address
        )
      `)
      .eq("id", loiId)
      .single();

    if (loiError || !loi) {
      return NextResponse.json(
        { error: "LOI non trovata" },
        { status: 404 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, loi.company_id, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Recupera signer con dati investitore
    const { data: signer, error: signerError } = await supabase
      .from("fundops_loi_signers")
      .select(`
        id,
        loi_id,
        investor_id,
        status,
        soft_commitment_at,
        hard_signed_at,
        expires_at_override,
        indicative_amount,
        fundops_investors:investor_id (
          id,
          full_name,
          email,
          phone,
          category,
          type
        )
      `)
      .eq("id", signerId)
      .eq("loi_id", loiId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signer non trovato o non appartiene alla LOI" },
        { status: 404 }
      );
    }

    // 3. Verifica che signer non sia revoked
    if (signer.status === "revoked") {
      return NextResponse.json(
        { error: "Impossibile generare PDF per signer revocato" },
        { status: 400 }
      );
    }

    // 4. Determina template PDF da usare
    const templateKey = loi.pdf_template_key || "TEMPLATE_Lettera Intenti SFP 2025.pdf";
    const templatePath = path.join(process.cwd(), "public", "templates", templateKey);

    // Verifica che il template esista
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: `Template PDF non trovato: ${templateKey}` },
        { status: 404 }
      );
    }

    // 5. Carica template PDF
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // 6. Ottieni font standard
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 7. Prepara dati dinamici
    const company = loi.fundops_companies as CompanyData | null;
    const investor = signer.fundops_investors as InvestorData | null;

    // Data firma: usa hard_signed_at se presente, altrimenti soft_commitment_at
    const signDate = signer.hard_signed_at || signer.soft_commitment_at;
    const signDateFormatted = signDate
      ? new Date(signDate).toLocaleDateString("it-IT", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // Stato firma
    let statusText = "";
    switch (signer.status) {
      case "signed":
        statusText = "Firmata";
        break;
      case "accepted":
        statusText = "Accettata";
        break;
      case "invited":
        statusText = "In attesa di firma";
        break;
      case "expired":
        statusText = "Scaduta";
        break;
      default:
        statusText = "";
    }

    // Importo indicativo (solo se presente)
    const amountText = signer.indicative_amount
      ? `${signer.indicative_amount.toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR`
      : null;

    // Scadenza effettiva
    const effectiveExpiry = signer.expires_at_override || loi.master_expires_at;
    const expiryFormatted = effectiveExpiry
      ? new Date(effectiveExpiry).toLocaleDateString("it-IT", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // 8. Prova a compilare form fields (AcroForm) se presenti nel template
    let useManualPositioning = true;
    try {
      const form = pdfDoc.getForm();
      const formFields = form.getFields();
      
      // Se il template ha form fields, prova a compilarli
      if (formFields.length > 0) {
        // Mappa dei campi comuni (adatta in base al tuo template)
        const fieldMap: Record<string, string> = {};
        
        // Dati società
        if (company?.legal_name) fieldMap["company_legal_name"] = company.legal_name;
        if (company?.address) fieldMap["company_address"] = company.address;
        if (company?.vat_number) fieldMap["company_vat"] = company.vat_number;
        
        // Dati investitore
        if (investor?.full_name) fieldMap["investor_name"] = investor.full_name;
        if (investor?.email) fieldMap["investor_email"] = investor.email;
        
        // Testi LOI
        if (loi.premessa_text) fieldMap["premessa"] = loi.premessa_text;
        if (loi.modalita_text) fieldMap["modalita"] = loi.modalita_text;
        if (loi.condizioni_text) fieldMap["condizioni"] = loi.condizioni_text;
        if (loi.regolamento_ref) fieldMap["regolamento"] = loi.regolamento_ref;
        
        // Importo e date
        if (amountText) fieldMap["importo"] = amountText;
        if (signDateFormatted) fieldMap["data_firma"] = signDateFormatted;
        if (expiryFormatted) fieldMap["scadenza"] = expiryFormatted;
        
        // Compila i campi disponibili
        let fieldsFilled = 0;
        formFields.forEach((field) => {
          const fieldName = field.getName().toLowerCase();
          for (const [key, value] of Object.entries(fieldMap)) {
            if (fieldName.includes(key.toLowerCase())) {
              try {
                if (field instanceof PDFTextField) {
                  field.setText(value);
                  fieldsFilled++;
                } else if (field.constructor.name === "PDFCheckBox") {
                  // Gestisci checkbox se necessario
                }
              } catch (err) {
                // Ignora errori di compilazione campo (campo potrebbe non esistere)
                console.warn(`Impossibile compilare campo ${fieldName}:`, err);
              }
            }
          }
        });
        
        // Se almeno alcuni campi sono stati compilati, usa form fields
        if (fieldsFilled > 0) {
          useManualPositioning = false;
        }
      }
    } catch (formError) {
      // Se la compilazione form fields fallisce, continua con posizionamento manuale
      console.warn("Errore nella compilazione form fields, uso posizionamento manuale:", formError);
      useManualPositioning = true;
    }

    // 9. Se non ci sono form fields o la compilazione è fallita, usa posizionamento manuale
    // NOTA: Le coordinate devono essere regolate in base al template specifico
    if (useManualPositioning) {

    // 8. Aggiungi testo al PDF (posizionamento manuale)
    // NOTA: Le coordinate sono in punti (72 DPI). Dovrai regolare in base al template.
    // Per un'implementazione completa, usa un template con form fields o un sistema di coordinate preciso.

    // Titolo: "Lettera di Intenti" (centrato in alto)
    firstPage.drawText("Lettera di Intenti", {
      x: width / 2 - 60,
      y: height - 50,
      size: 18,
      font: helveticaBoldFont,
    });

    // Dati società (in alto a sinistra)
    let yPos = height - 100;
    if (company?.legal_name) {
      firstPage.drawText(`Ragione sociale: ${company.legal_name}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }
    if (company?.address) {
      firstPage.drawText(`Sede: ${company.address}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }
    if (company?.vat_number) {
      firstPage.drawText(`P.IVA: ${company.vat_number}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }

    // Premessa (se presente)
    if (loi.premessa_text) {
      yPos -= 20;
      firstPage.drawText("PREMESSA", {
        x: 50,
        y: yPos,
        size: 12,
        font: helveticaBoldFont,
      });
      yPos -= 20;
      // Dividi testo in righe (semplificato)
      const premessaLines = wrapText(loi.premessa_text, 80);
      premessaLines.forEach((line: string) => {
        if (yPos > 100) {
          firstPage.drawText(line, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
          });
          yPos -= 12;
        }
      });
    }

    // Modalità / Regolamento SFP
    if (loi.modalita_text || loi.regolamento_ref) {
      yPos -= 20;
      firstPage.drawText("MODALITÀ / REGOLAMENTO SFP", {
        x: 50,
        y: yPos,
        size: 12,
        font: helveticaBoldFont,
      });
      yPos -= 20;
      if (loi.modalita_text) {
        const modalitaLines = wrapText(loi.modalita_text, 80);
        modalitaLines.forEach((line: string) => {
          if (yPos > 100) {
            firstPage.drawText(line, {
              x: 50,
              y: yPos,
              size: 10,
              font: helveticaFont,
            });
            yPos -= 12;
          }
        });
      }
      if (loi.regolamento_ref) {
        yPos -= 10;
        firstPage.drawText(`Riferimento: ${loi.regolamento_ref}`, {
          x: 50,
          y: yPos,
          size: 10,
          font: helveticaFont,
        });
        yPos -= 15;
      }
    }

    // Condizioni sintetiche
    if (loi.condizioni_text) {
      yPos -= 20;
      firstPage.drawText("CONDIZIONI SINTETICHE", {
        x: 50,
        y: yPos,
        size: 12,
        font: helveticaBoldFont,
      });
      yPos -= 20;
      const condizioniLines = wrapText(loi.condizioni_text, 80);
      condizioniLines.forEach((line: string) => {
        if (yPos > 100) {
          firstPage.drawText(line, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
          });
          yPos -= 12;
        }
      });
    }

    // Chiarezza soft commitment
    yPos -= 20;
    const softCommitmentText =
      "La presente Lettera di Intenti costituisce un impegno non vincolante (soft commitment), subordinato all'avvio della fase di Issuing e all'emissione degli SFP.";
    const commitmentLines = wrapText(softCommitmentText, 80);
    commitmentLines.forEach((line: string) => {
      if (yPos > 100) {
        firstPage.drawText(line, {
          x: 50,
          y: yPos,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPos -= 12;
      }
    });

    // SEZIONE FIRMA INVESTITORE (in basso)
    yPos = 200;
    firstPage.drawText("SEZIONE FIRMA INVESTITORE", {
      x: 50,
      y: yPos,
      size: 12,
      font: helveticaBoldFont,
    });
    yPos -= 25;

    // Dati investitore
    if (investor?.full_name) {
      firstPage.drawText(`Nome / Ragione sociale: ${investor.full_name}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }
    // CF / P.IVA investitore (se disponibile nei dati)
    // NOTA: potresti dover aggiungere questi campi a fundops_investors
    yPos -= 10;
    if (investor?.email) {
      firstPage.drawText(`Email: ${investor.email}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }

    // Importo indicativo (solo se presente)
    if (amountText) {
      yPos -= 10;
      firstPage.drawText(`Importo indicativo: ${amountText}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }

    // Data firma
    if (signDateFormatted) {
      yPos -= 10;
      firstPage.drawText(`Data firma: ${signDateFormatted}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
      yPos -= 15;
    }

    // Stato firma
    if (statusText) {
      yPos -= 10;
      firstPage.drawText(`Stato: ${statusText}`, {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
      });
    }

      // Watermark per stati expired/revoked
      if (signer.status === "expired" || signer.status === "revoked") {
        const watermarkText =
          signer.status === "expired" ? "SCADUTA" : "REVOCATA";
        firstPage.drawText(watermarkText, {
          x: width / 2 - 40,
          y: height / 2,
          size: 48,
          font: helveticaBoldFont,
          color: rgb(0.9, 0.9, 0.9),
          rotate: degrees(45),
          opacity: 0.3,
        });
      }
    }

    // 10. Genera PDF finale
    const pdfBytes = await pdfDoc.save();

    // 10. Restituisci PDF come response
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="LOI_${loiId.slice(0, 8)}_${signerId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error generating LOI PDF:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Helper per wrappare testo in righe di lunghezza massima
 */
function wrapText(text: string, maxLength: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + word).length <= maxLength) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
