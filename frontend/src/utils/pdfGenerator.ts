import { LOIDocumentData, generateLOIDocument } from './loiDocumentTemplate';

/**
 * Genera e scarica il documento LOI come file HTML
 * (Per ora salviamo come HTML, poi integreremo jsPDF o html2pdf per PDF vero)
 */
export const downloadLOIAsHTML = (data: LOIDocumentData) => {
  const htmlContent = generateLOIDocument(data);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `LOI_${data.loiNumber}_${data.investorName.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Apre il documento LOI in una nuova finestra per anteprima
 */
export const previewLOIDocument = (data: LOIDocumentData) => {
  const htmlContent = generateLOIDocument(data);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }
};

/**
 * Genera PDF usando il browser (stampa)
 * L'utente può stampare o salvare come PDF dal dialogo di stampa
 */
export const printLOIDocument = (data: LOIDocumentData) => {
  const htmlContent = generateLOIDocument(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Aspetta che il contenuto sia caricato prima di stampare
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
};

/**
 * Genera PDF usando html2pdf (da implementare con la libreria)
 * Per ora è un placeholder
 */
export const generatePDF = async (data: LOIDocumentData): Promise<void> => {
  // TODO: Implementare con html2pdf.js o jsPDF
  // Per ora usa il metodo di stampa
  printLOIDocument(data);
};

/**
 * Copia il contenuto HTML negli appunti
 */
export const copyLOIToClipboard = async (data: LOIDocumentData): Promise<boolean> => {
  const htmlContent = generateLOIDocument(data);
  try {
    await navigator.clipboard.writeText(htmlContent);
    return true;
  } catch (err) {
    console.error('Errore durante la copia negli appunti:', err);
    return false;
  }
};

