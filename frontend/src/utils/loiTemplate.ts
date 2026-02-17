import { LOI } from '../types/loi';

export const generateLOIDocument = (loi: LOI): string => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
  };

  const getSFPClassDescription = (sfpClass: string): string => {
    const descriptions = {
      A: 'Classe A (sconto 20%)',
      B: 'Classe B (sconto 15%)',
      C: 'Classe C (sconto 10%)'
    };
    return descriptions[sfpClass as keyof typeof descriptions] || sfpClass;
  };

  const getStatusDescription = (status: string): string => {
    const descriptions = {
      draft: 'Bozza',
      sent: 'Inviata',
      signed: 'Firmata',
      expired: 'Scaduta',
      rejected: 'Rifiutata'
    };
    return descriptions[status as keyof typeof descriptions] || status;
  };

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${loi.title}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo-placeholder {
            background-color: #f5f5f5;
            border: 2px dashed #ccc;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
            color: #666;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            margin: 10px 0;
        }
        .date-location {
            text-align: right;
            margin: 20px 0;
            font-style: italic;
        }
        .subject {
            font-weight: bold;
            margin: 20px 0;
        }
        .salutation {
            margin: 20px 0;
        }
        .content {
            margin: 20px 0;
        }
        .section-title {
            font-weight: bold;
            margin: 20px 0 10px 0;
            color: #2563eb;
        }
        .highlight {
            background-color: #fef3cd;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .table th, .table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .signature-section {
            margin-top: 60px;
            page-break-inside: avoid;
        }
        .signature-box {
            border: 1px solid #333;
            padding: 20px;
            margin: 20px 0;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            margin: 10px 0;
            padding: 5px 0;
        }
        .footer {
            margin-top: 40px;
            font-size: 12px;
            color: #666;
        }
        .company-details {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        @media print {
            body { padding: 20px; }
            .signature-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-placeholder">Logo</div>
        <div class="title">${loi.title}</div>
        <div class="company-name">${loi.companyFullName}</div>
    </div>

    <div class="date-location">
        ${loi.companyCity}, ${formatDate(loi.subscriptionDate)}
    </div>

    <div class="subject">
        Oggetto: Lettera d'intenti "non vincolante" per Acquisto SFP (Strumenti Finanziari Partecipativi).
    </div>

    <div class="salutation">
        Gentilissimo ${loi.investorName},
    </div>

    <div class="content">
        <p>Le scrivo per condividere le modalità di acquisto degli SFP (Strumenti Finanziari Partecipativi) per la nostra Società.</p>

        <div class="section-title">Premessa</div>
        <p><span class="highlight">${loi.companyName}</span> (di seguito anche "Startup") si sta preparando per l'emissione di SFP convertibili al <span class="highlight">${loi.conversionDate}</span>, secondo quanto disciplinato nel Regolamento.</p>

        <div class="section-title">Valore Massimo SFP</div>
        <p>L'ammontare massimo complessivo del Valore degli SFP che possono essere emessi a norma del Regolamento è pari a <span class="highlight">${formatCurrency(loi.maxTotalValue)}</span>.</p>

        <div class="section-title">Ticket Size</div>
        <p>Il ticket-size previsto per l'acquisto degli SFP è di <span class="highlight">${formatCurrency(loi.ticketSize)}</span> o multipli.</p>

        <div class="section-title">Sconti per Acquisizione</div>
        <p>È previsto uno sconto del <span class="highlight">${loi.discountPercentage}%</span> per le sottoscrizioni di <span class="highlight">${getSFPClassDescription(loi.sfpClass)}</span> entro il <span class="highlight">${formatDate(loi.subscriptionDeadline)}</span>.</p>
        <p>Lo sconto si applica alla futura valuation per quote di categoria B come disciplinate nell'attuale statuto sociale.</p>

        <div class="section-title">Obiettivo SFP</div>
        <p>L'obiettivo degli SFP è di individuare Investor che possano partecipare attivamente alla crescita della Società e di reperire risorse finanziarie.</p>

        <div class="section-title">Benefici Fiscali</div>
        <p><span class="highlight">${loi.companyName}</span> è una Startup Innovativa. Gli SFP sottoscritti beneficiano di agevolazioni fiscali ai sensi del Decreto Legge 18 ottobre 2012, n.179 e L. 162/2024, incluso un credito d'imposta (cod. tributo 7076) utilizzabile per ridurre IRPEF o IRES o compensare altre imposte dovute.</p>

        <table class="table">
            <caption><strong>Esempio Sconto SFP</strong></caption>
            <tr>
                <th>Valore SFP</th>
                <th>Sconto</th>
                <th>Valore SFP al momento della conversione</th>
            </tr>
            <tr>
                <td>${formatCurrency(loi.sfpValue)}</td>
                <td>${loi.discountPercentage}%</td>
                <td>${formatCurrency(loi.sfpValue * (1 + loi.discountPercentage / 100))}</td>
            </tr>
        </table>

        <table class="table">
            <caption><strong>Esempio Beneficio Fiscale</strong></caption>
            <tr>
                <th>Beneficio fiscale</th>
                <th>Valore beneficio fiscale</th>
            </tr>
            <tr>
                <td>${loi.taxBenefitPercentage}% di ${formatCurrency(loi.sfpValue)}</td>
                <td>${formatCurrency(loi.taxBenefitValue)}</td>
            </tr>
        </table>

        <div class="section-title">Modalità di sottoscrizione</div>
        <p>Gli SFP potranno essere sottoscritti con le modalità previste dal Regolamento.</p>

        <div class="section-title">Documentazione informativa</div>
        <p>Alla sottoscrizione della presente Lettera d'Intenti, l'Investitore riceverà dall'Organo Amministrativo di ${loi.companyName}:</p>
        <ul>
            <li>a) Visura camerale aggiornata;</li>
            <li>b) Investor deck.</li>
        </ul>

        <div class="section-title">Attività successive</div>
        <ol>
            <li>a) Firma della presente LOI "non vincolante".</li>
            <li>b) Condivisione Documentazione Informativa.</li>
            <li>c) Conferma da parte dell'organo amministrativo di ${loi.companyName}.</li>
            <li>d) Versamento importo investimento tramite bonifico bancario sul conto corrente intestato a ${loi.companyName}: ${loi.bankAccount || 'Da comunicare'}</li>
            <li>e) Rilascio Certificato degli SFP sottoscritti.</li>
        </ol>

        <div class="section-title">Accordo di riservatezza</div>
        <p>L'Investitore si impegna a mantenere la riservatezza delle informazioni ricevute per un periodo di ${loi.confidentialityPeriod} mesi.</p>

        <div class="section-title">Controversie</div>
        <p>Il foro competente per le controversie è il <span class="highlight">${loi.competentCourt}</span>.</p>
        <p>Il Team di ${loi.companyName} è a disposizione per eventuali chiarimenti.</p>

        <div class="salutation">
            Cordiali Saluti,
        </div>

        <div class="company-details">
            <p><strong>${loi.companyName}</strong></p>
            <p>Sede legale: ${loi.companyLegalAddress}</p>
            <p>CAP: ${loi.companyCAP} - ${loi.companyCity}</p>
            <p>N. iscrizione e codice fiscale: ${loi.companyRegistration}</p>
            <p>Capitale sociale: ${loi.companyCapital}</p>
            <p>P.IVA: ${loi.companyVAT}</p>
        </div>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div class="logo-placeholder">Logo</div>
            <div style="text-align: right; margin: 20px 0;">
                <p><strong>${loi.companyName}</strong></p>
                <p>Nome e Cognome | CEO</p>
            </div>
            <div class="signature-line">Firma</div>
        </div>

        <div style="margin-top: 40px;">
            <p><strong>Per Accettazione</strong></p>
            <p>(L'Investitore)</p>
        </div>

        <div style="margin-top: 20px;">
            <p>Città: <span class="signature-line" style="display: inline-block; width: 200px;"></span></p>
            <p>li <span class="signature-line" style="display: inline-block; width: 100px;"></span> /2025</p>
        </div>

        <div style="margin-top: 20px;">
            <p>Nome e Cognome: <span class="signature-line" style="display: inline-block; width: 300px;"></span></p>
            <p>Nato a <span class="signature-line" style="display: inline-block; width: 150px;"></span> (__), il <span class="signature-line" style="display: inline-block; width: 100px;"></span></p>
            <p>C.F.: <span class="signature-line" style="display: inline-block; width: 200px;"></span></p>
            <p>Firma: <span class="signature-line" style="display: inline-block; width: 300px;"></span></p>
        </div>
    </div>

    <div class="footer">
        <p><strong>Informazioni LOI:</strong></p>
        <p>Numero: ${loi.loiNumber}</p>
        <p>Status: ${getStatusDescription(loi.status)}</p>
        <p>Creata il: ${formatDate(loi.createdAt)}</p>
        ${loi.loiSentDate ? `<p>Inviata il: ${formatDate(loi.loiSentDate)}</p>` : ''}
        ${loi.loiSignedDate ? `<p>Firmata il: ${formatDate(loi.loiSignedDate)}</p>` : ''}
        <p>Scadenza: ${formatDate(loi.loiExpiryDate)}</p>
    </div>
</body>
</html>
  `;
};

export const generateLOIPDF = async (loi: LOI): Promise<Blob> => {
  const htmlContent = generateLOIDocument(loi);
  
  // In una implementazione reale, useresti una libreria come jsPDF o Puppeteer
  // Per ora restituiamo un blob HTML che può essere stampato come PDF
  const blob = new Blob([htmlContent], { type: 'text/html' });
  return blob;
};

export const downloadLOI = (loi: LOI): void => {
  const htmlContent = generateLOIDocument(loi);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${loi.loiNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
