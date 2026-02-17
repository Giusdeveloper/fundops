import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface LoiReceiptData {
  companyName: string;
  legalName: string;
  signedName: string;
  investorEmail: string;
  signedAt: string;
  loiId?: string;
}

export async function generateLoiReceiptPdf(data: LoiReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - 60;

  page.drawText("Attestazione di sottoscrizione non vincolante (LOI)", {
    x: 50,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 20;
  page.drawText("Firma elettronica semplice", {
    x: 50,
    y,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 20;

  page.drawText("Imment – Smart Equity", {
    x: 50,
    y,
    size: 10,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 40;

  if (data.loiId) {
    page.drawText("LOI ID", { x: 50, y, size: 10, font: fontBold, color: rgb(0, 0, 0) });
    y -= 16;
    page.drawText(data.loiId, { x: 50, y, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });
    y -= 20;
  }
  page.drawText("Azienda", { x: 50, y, size: 10, font: fontBold, color: rgb(0, 0, 0) });
  y -= 16;
  page.drawText(data.companyName, { x: 50, y, size: 10, font: font, color: rgb(0, 0, 0) });
  y -= 14;
  if (data.legalName !== data.companyName) {
    page.drawText(`Ragione sociale: ${data.legalName}`, {
      x: 50,
      y,
      size: 9,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  }
  y -= 16;

  page.drawText("Firmatario", { x: 50, y, size: 10, font: fontBold, color: rgb(0, 0, 0) });
  y -= 16;
  page.drawText(`Nome: ${data.signedName}`, { x: 50, y, size: 10, font: font, color: rgb(0, 0, 0) });
  y -= 14;
  page.drawText(`Email: ${data.investorEmail}`, { x: 50, y, size: 10, font: font, color: rgb(0, 0, 0) });
  y -= 14;
  page.drawText(`Data e ora firma: ${data.signedAt}`, {
    x: 50,
    y,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  page.drawText(
    "Attestazione di sottoscrizione non vincolante (LOI) – firma elettronica semplice. " +
      "L'impegno espresso è di natura non vincolante fino alla sottoscrizione formale.",
    {
      x: 50,
      y,
      size: 9,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth: width - 100,
    }
  );
  y -= 50;

  page.drawText(`Generato il ${new Date().toLocaleDateString("it-IT")}`, {
    x: 50,
    y,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdfDoc.save();
}
