export interface LOIDocumentData {
  // Dati Investitore
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorCompany?: string;
  investorAddress?: string;
  investorVAT?: string;
  
  // Logo
  logoUrl?: string;
  
  // Dati LOI
  loiNumber: string;
  loiDate: string;
  expiryDate: string;
  
  // Dati Finanziari SFP
  sfpClass: 'A' | 'B' | 'C';
  sfpValue: number;
  discountPercentage: number;
  maxTotalValue: number;
  
  // Dati Azienda
  companyName: string;
  companyFullName: string;
  companyAddress: string;
  companyCity: string;
  companyCAP: string;
  companyProvince: string;
  companyVAT: string;
  companyCapital: string;
  companyRegistration: string;
  companyREA: string;
  companyEmail: string;
  companyPEC: string;
  companyCEO: string;
  companyTribunale: string;
  
  // Termini
  conversionDate: string;
  paymentTerms: string;
  
  // Date Sconti (per il template)
  dataSconto20?: string;
  dataSconto15?: string;
  dataSconto10?: string;
  
  // Note
  notes?: string;
}

export const generateLOIDocument = (data: LOIDocumentData): string => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '__/__/____';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Calcola l'anno dalla data del documento
  const anno = data.loiDate ? new Date(data.loiDate).getFullYear() : new Date().getFullYear();
  
  // Date di sconto (default se non fornite)
  const dataSconto20 = data.dataSconto20 || '15/03/2025';
  const dataSconto15 = data.dataSconto15 || '30/04/2025';
  const dataSconto10 = data.dataSconto10 || '30/06/2025';

  // Calcola il valore alla conversione (ticketSize + sconto%)
  const valoreConversione = data.sfpValue * (1 + (data.discountPercentage / 100));

  // Calcola il beneficio fiscale (30% del valore SFP)
  const beneficioFiscale = data.sfpValue * 0.3;


  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lettera d'Intenti - SFP ${anno}</title>
    <style>
        @page {
            margin: 2cm;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            color: #000;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-size: 11pt;
            background-color: white;
        }
        
        .logo-container {
            text-align: center;
            margin-bottom: 40px;
            margin-top: 20px;
        }
        
        .logo {
            display: inline-block;
            padding: 15px 40px;
            background-color: #d3d3d3;
            border-radius: 8px;
            font-weight: bold;
            font-size: 18pt;
        }
        
        .logo-image {
            max-height: 60px;
            max-width: 200px;
            object-fit: contain;
            margin-bottom: 10px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }
        
        h1 {
            text-align: center;
            font-size: 18pt;
            margin-bottom: 10px;
            margin-top: 20px;
            font-weight: normal;
        }
        
        .subtitle {
            text-align: center;
            font-size: 11pt;
            margin-bottom: 50px;
            margin-top: 10px;
        }
        
        .date-location {
            margin-bottom: 40px;
        }
        
        .section-title {
            color: #4472C4;
            font-size: 12pt;
            margin-top: 30px;
            margin-bottom: 15px;
            font-weight: normal;
        }
        
        .object {
            font-weight: bold;
            margin-bottom: 20px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        table, th, td {
            border: 1px solid #000;
        }
        
        th, td {
            padding: 10px;
            text-align: left;
        }
        
        th {
            background-color: #d3d3d3;
            font-weight: bold;
        }
        
        .example-table {
            width: auto;
            margin: 20px 0;
        }
        
        .example-table td {
            padding: 8px 12px;
        }
        
        .footer {
            font-size: 8pt;
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            line-height: 1.4;
        }
        
        .signature-section {
            margin-top: 60px;
            page-break-before: always;
        }
        
        .signature-block {
            margin-top: 40px;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 300px;
            margin-left: 10px;
        }
        
        ul {
            margin-left: 30px;
        }
        
        li {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <!-- Pagina 1 -->
    <div class="logo-container">
        ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo ${data.companyName}" class="logo-image" />` : '<div class="logo">Logo</div>'}
    </div>
    
    <h1>Lettera d'intenti</h1>
    <div class="subtitle">
        <span id="nomeSocietaHeader">${data.companyName}</span> Startup Innovativa, SFP <span id="anno">${anno}</span>
    </div>
    
    <div class="date-location">
        <span id="cittaHeader">${data.companyAddress.split(',')[1]?.trim() || 'Roma'}</span>, <span id="dataDocumentoHeader">${formatDate(data.loiDate)}</span>
    </div>
    
    <p class="object">
        <strong>Oggetto:</strong> Lettera d'intenti "non vincolante" per Acquisto SFP (Strumenti Finanziari Partecipativi).
    </p>
    
    <p>Gentilissimo Investitore,</p>
    
    <p>Le scrivo per condividere le modalità di acquisto degli SFP (Strumenti Finanziari Partecipativi) per la nostra Società.</p>
    
    <h2 class="section-title">Premessa</h2>
    
    <p><span class="nomeSocieta">${data.companyName}</span> (di seguito anche "Startup") sta predisponendo le attività per l'emissione di SFP (Strumenti Finanziari Partecipativi) convertibili al <span id="dataConversioneText">${data.conversionDate}</span> o anticipatamente ai sensi del relativo regolamento predisposto a disciplina della conversione (il "<strong>Regolamento</strong>").</p>
    
    <p>L'ammontare massimo complessivo del Valore degli SFP che possono essere emessi a norma del Regolamento è pari a <span id="importoMassimoText">${formatCurrency(150000)}</span>.</p>
    
    <p>Il ticket-size previsto per l'acquisto degli SFP è di <span id="ticketSizeText">${formatCurrency(data.sfpValue)}</span> o multipli.</p>
    
    <p>L'acquisto degli SFP prevede:</p>
    <ul>
        <li>uno sconto del <strong>20%</strong> per le sottoscrizioni effettuate entro il <span id="dataSconto20Text1">${dataSconto20}</span> sulla futura valuation per quote di categoria B come disciplinate nell'attuale statuto sociale;</li>
        <li>uno sconto del <strong>15%</strong> per le sottoscrizioni effettuate oltre il <span id="dataSconto20Text2">${dataSconto20}</span> ed entro il <span id="dataSconto15Text1">${dataSconto15}</span> sulla futura valuation per quote di categoria B come disciplinate nell'attuale statuto sociale;</li>
        <li>uno sconto del <strong>10%</strong> per le sottoscrizioni effettuate oltre il <span id="dataSconto15Text2">${dataSconto15}</span> sulla futura valuation per quote di categoria B come disciplinate nell'attuale statuto sociale.</li>
    </ul>
    
    <div class="footer">
        <span class="nomeSocieta">${data.companyName}</span> | Sede legale: <span class="indirizzo">${data.companyAddress}</span> | Iscritta al Registro Imprese della CCIAA DI <span class="citta">${data.companyAddress.split(',')[1]?.trim() || 'Roma'}</span><br>
        N. iscrizione e codice fiscale: <span class="numeroIscrizione">${data.companyVAT}</span> | Capitale sociale: sottoscritto <span class="capitaleSottoscritto">${data.companyCapital}</span> versato <span class="capitaleVersato">${data.companyCapital}</span> (i.v).<br>
        P.IVA: <span class="piva">${data.companyVAT}</span> | <span class="emailPec">info@${data.companyName.toLowerCase().replace(/\s+/g, '')}.it</span>
    </div>
    
    <!-- Pagina 2 -->
    <div style="page-break-before: always;">
        <div class="logo-container">
            ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo ${data.companyName}" class="logo-image" />` : '<div class="logo">Logo</div>'}
        </div>
        
        <h3>Riepilogo Classi e Sconti SFP</h3>
        
        <table>
            <thead>
                <tr>
                    <th>Classe SFP</th>
                    <th>Classe A</th>
                    <th>Classe B</th>
                    <th>Classe C</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Data sottoscrizione</strong></td>
                    <td>entro il <span id="dataSconto20Table">${dataSconto20}</span></td>
                    <td>entro il <span id="dataSconto15Table">${dataSconto15}</span></td>
                    <td>oltre il <span id="dataSconto10Table">${dataSconto10}</span></td>
                </tr>
                <tr>
                    <td><strong>Sconto</strong></td>
                    <td><strong>20%</strong></td>
                    <td><strong>15%</strong></td>
                    <td><strong>10%</strong></td>
                </tr>
                <tr>
                    <td><strong>Bonus</strong></td>
                    <td colspan="3">È previsto un extra sconto del 5% da aggiungere agli SFP di Classe A in caso di sottoscrizione entro i primi 5 giorni dalla data di pubblicazione del Regolamento.</td>
                </tr>
            </tbody>
        </table>
        
        <p>L'obiettivo degli SFP è di individuare Investor che possano partecipare attivamente alla crescita della Società e di reperire risorse finanziarie.</p>
        
        <p><span class="nomeSocieta">${data.companyName}</span> è una Startup Innovativa, pertanto i sottoscrittori di SFP potranno beneficiare nel futuro aumento di capitale delle <strong>agevolazioni fiscali</strong> previste dall'art. 29 del Decreto Legge 18 ottobre 2012, n.179 e ss.mm, nonché del credito d'imposta (<strong>cod. tributo 7076</strong>) previsto dall'art. 2 della L. 162/2024, relativo all'eccedenza non detraibile, utilizzabile non solo in diminuzione di IRPEF o IRES ma anche in compensazione di altre imposte dovute.</p>
        
        <table class="example-table">
            <caption style="text-align: left; font-weight: bold; margin-bottom: 10px;">Esempio Sconto SFP</caption>
            <tr>
                <td><strong>Valore SFP</strong><br><em>Prezzo pagato per l'acquisto di SFP</em></td>
                <td><span id="ticketSizeExample">${formatCurrency(data.sfpValue)}</span></td>
            </tr>
            <tr>
                <td><strong>Sconto</strong><br><em>Maggior valore dell'investimento al momento della conversione</em></td>
                <td>${data.discountPercentage}%</td>
            </tr>
            <tr>
                <td><strong>Valore SFP al momento della conversione</strong><br><em>Valore SFP maggiorato del ${data.discountPercentage}%</em></td>
                <td><span id="valoreConversione">${formatCurrency(valoreConversione)}</span></td>
            </tr>
        </table>
        
        <table class="example-table">
            <caption style="text-align: left; font-weight: bold; margin-bottom: 10px;">Esempio Beneficio Fiscale SFP</caption>
            <tr>
                <td><strong>Beneficio fiscale</strong><br><em>Importo detraibile all'imposta lorda sul reddito</em></td>
                <td>30%</td>
            </tr>
            <tr>
                <td><strong>Valore beneficio fiscale</strong><br><em>30% di <span id="ticketSizeFiscale">${formatCurrency(data.sfpValue)}</span></em></td>
                <td><span id="beneficioFiscale">${formatCurrency(beneficioFiscale)}</span></td>
            </tr>
        </table>
        
        <h2 class="section-title">Modalità di sottoscrizione</h2>
        
        <p>Gli SFP potranno essere sottoscritti con le modalità previste dal Regolamento.</p>
        
        <div class="footer">
            <span class="nomeSocieta">${data.companyName}</span> | Sede legale: <span class="indirizzo">${data.companyAddress}</span> | Iscritta al Registro Imprese della CCIAA DI <span class="citta">${data.companyAddress.split(',')[1]?.trim() || 'Roma'}</span><br>
            N. iscrizione e codice fiscale: <span class="numeroIscrizione">${data.companyVAT}</span> | Capitale sociale: sottoscritto <span class="capitaleSottoscritto">${data.companyCapital}</span> versato <span class="capitaleVersato">${data.companyCapital}</span> (i.v).<br>
            P.IVA: <span class="piva">${data.companyVAT}</span> | <span class="emailPec">info@${data.companyName.toLowerCase().replace(/\s+/g, '')}.it</span>
        </div>
    </div>
    
    <!-- Pagina 3 -->
    <div style="page-break-before: always;">
        <div class="logo-container">
            ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo ${data.companyName}" class="logo-image" />` : '<div class="logo">Logo</div>'}
        </div>
        
        <h2 class="section-title">Documentazione informativa</h2>
        
        <p>Alla sottoscrizione della presente Lettera d'Intenti, l'Investitore riceverà dall'Organo Amministrativo di <span class="nomeSocieta">${data.companyName}</span>:</p>
        
        <ol type="a">
            <li>Visura camerale aggiornata;</li>
            <li>Pitch deck.</li>
        </ol>
        
        <h2 class="section-title">Attività successive</h2>
        
        <ol type="a">
            <li>Firma della presente LOI "non vincolante".</li>
            <li>Condivisione Documentazione Informativa.</li>
            <li>Conferma da parte dell'organo amministrativo di <span class="nomeSocieta">${data.companyName}</span>.</li>
            <li>Versamento importo investimento tramite bonifico bancario sul conto corrente intestato a <span class="nomeSocieta">${data.companyName}</span>, che verrà comunicato, con <em>Versamento in conto aumento di capitale - SFP <span class="nomeSocieta">${data.companyName}</span> ${data.investorName}</em>.</li>
            <li>Rilascio Certificato degli SFP sottoscritti, relativo alla quietanza di pagamento e titolo per la conversione degli strumenti.</li>
        </ol>
        
        <h2 class="section-title">Accordo di riservatezza</h2>
        
        <p>Con la firma del presente documento l'Investitore si impegna per i successivi 24 mesi a non diffondere le informazioni, di qualsivoglia natura, relative alla Società che gli verranno trasmesse dall'Organo Amministrativo della medesima e che non siano di pubblico dominio alla data della loro divulgazione o che siano state acquisite dall'Investitore indipendentemente dall'Organo Amministrativo e senza violazione di alcun impegno di confidenzialità e/o di prescrizione di legge.</p>
        
        <p>Tutti i documenti trasmessi da <span class="nomeSocieta">${data.companyName}</span> all'Investitore (tra i quali a titolo esemplificativo e non esaustivo: corrispondenza, eventuali pareri, ecc.) avranno natura strettamente confidenziale e con la sottoscrizione della presente Lettera d'Intenti l'Investitore si impegna a non divulgarne a terzi il contenuto, senza la preventiva autorizzazione di <span class="nomeSocieta">${data.companyName}</span>.</p>
        
        <h2 class="section-title">Controversie</h2>
        
        <p>Per tutte le controversie relative e/o connesse all'interpretazione e/o esecuzione della presente Lettera di Intenti il Foro competente in via esclusiva sarà il Tribunale di <span id="tribunaleCompetente">Roma</span>.</p>
        
        <p>Il Team di <span class="nomeSocieta">${data.companyName}</span> è a Sua completa disposizione per qualsiasi ulteriore chiarimento. Nella speranza di averLa come nostro futuro socio, colgo l'occasione per ringraziarLa, per il tempo che ci ha dedicato.</p>
        
        <p>Cordiali Saluti,</p>
        
        <div class="footer">
            <span class="nomeSocieta">${data.companyName}</span> | Sede legale: <span class="indirizzo">${data.companyAddress}</span> | Iscritta al Registro Imprese della CCIAA DI <span class="citta">${data.companyAddress.split(',')[1]?.trim() || 'Roma'}</span><br>
            N. iscrizione e codice fiscale: <span class="numeroIscrizione">${data.companyVAT}</span> | Capitale sociale: sottoscritto <span class="capitaleSottoscritto">${data.companyCapital}</span> versato <span class="capitaleVersato">${data.companyCapital}</span> (i.v).<br>
            P.IVA: <span class="piva">${data.companyVAT}</span> | <span class="emailPec">info@${data.companyName.toLowerCase().replace(/\s+/g, '')}.it</span>
        </div>
    </div>
    
    <!-- Pagina 4 - Firme -->
    <div style="page-break-before: always;">
        <div class="logo-container">
            ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo ${data.companyName}" class="logo-image" />` : '<div class="logo">Logo</div>'}
        </div>
        
        <div class="signature-section">
            <p><span class="nomeSocieta">${data.companyName}</span><br>
            <span id="nomeCEOText">CEO</span> | CEO</p>
            
            <p><em>Firma</em> <span class="signature-line"></span></p>
            
            <div class="signature-block">
                <p><strong>Per Accettazione</strong><br>
                <em>(L'Investitore)</em></p>
                
                <p>Città <span class="signature-line"></span>, lì ___/___/2025</p>
                
                <p>Nome e Cognome</p>
                <p><span class="signature-line" style="min-width: 400px;">${data.investorName}</span></p>
                
                <p>Nato a <span class="signature-line" style="min-width: 200px;"></span> (___), il <span class="signature-line" style="min-width: 150px;"></span></p>
                
                <p>C.F. <span class="signature-line" style="min-width: 300px;"></span></p>
                
                <p>Firma <span class="signature-line" style="min-width: 300px;"></span></p>
            </div>
        </div>
        
        <div class="footer">
            <span class="nomeSocieta">${data.companyName}</span> | Sede legale: <span class="indirizzo">${data.companyAddress}</span> | Iscritta al Registro Imprese della CCIAA DI <span class="citta">${data.companyAddress.split(',')[1]?.trim() || 'Roma'}</span><br>
            N. iscrizione e codice fiscale: <span class="numeroIscrizione">${data.companyVAT}</span> | Capitale sociale: sottoscritto <span class="capitaleSottoscritto">${data.companyCapital}</span> versato <span class="capitaleVersato">${data.companyCapital}</span> (i.v).<br>
            P.IVA: <span class="piva">${data.companyVAT}</span> | <span class="emailPec">info@${data.companyName.toLowerCase().replace(/\s+/g, '')}.it</span>
        </div>
    </div>
</body>
</html>
  `.trim();
};

