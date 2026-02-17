# Templates LOI

Questa cartella contiene i template PDF per la generazione delle Lettere d'Intenti.

## Struttura

- `loi-template.pdf` - Template master per la generazione delle LOI
- Altri template possono essere aggiunti qui

## Utilizzo

I template possono essere referenziati nel codice usando il path relativo:
- Da API routes: `/templates/loi-template.pdf`
- Da componenti server: `public/templates/loi-template.pdf`

## Note

- I file in `public/` sono serviti staticamente da Next.js
- Accessibili via URL: `http://localhost:3001/templates/loi-template.pdf`
- Non includere dati sensibili nei template
