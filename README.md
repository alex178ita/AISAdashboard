# AISA · KPI Dashboard (React + Vite, deploy su Vercel)

Dashboard pubblica dei KPI dei flussi Make.com di AISA. Legge i tab **pubblicati**
del Google Sheet «AISA - KPI Log» — nessun backend, nessuna credenziale, nessun
dato personale esposto.

## 1. Prepara il Google Sheet

### a) Crea il tab `email_stats` (aggregati, senza indirizzi)
Aggiungi un nuovo tab chiamato `email_stats`. In A1 scrivi `date`, in B1 `event_type`, poi:

In A2:

    =ARRAYFORMULA(IF(email_events!B2:B="";"";LEFT(email_events!A2:A;10)))

In B2:

    =ARRAYFORMULA(IF(email_events!B2:B="";"";email_events!B2:B))

Una riga per evento, solo data e tipo. Niente email degli utenti; il conteggio lo fa la dashboard.

### b) Pubblica SOLO i tre tab necessari
File → Condividi → **Pubblica sul web** → nel primo menu scegli il singolo tab
(NON "Intero documento"), nel secondo scegli **CSV** → Pubblica. Ripeti per:

- `runs`
- `firecrawl`
- `email_stats`

⚠️ NON pubblicare il tab `email_events`: contiene gli indirizzi dei destinatari.

Copia i tre URL generati (finiscono con `...output=csv`).

## 2. Configura il progetto
Apri `src/config.js` e incolla i tre URL nelle costanti
`RUNS_CSV_URL`, `FIRECRAWL_CSV_URL`, `EMAIL_STATS_CSV_URL`.

## 3. Deploy su Vercel
Strada consigliata (da GitHub):
1. Crea un repository e carica questa cartella.
2. Su vercel.com → Add New → Project → importa il repo.
3. Framework preset: **Vite** (rilevato in automatico). Deploy.

In alternativa da terminale: `npm i -g vercel && vercel` dentro questa cartella.

Test locale: `npm install && npm run dev`.

## Note
- Deduplica automatica per `execution_id` (K1 riappende gli stessi log ogni ora).
- Auto-refresh ogni 5 minuti (configurabile in `src/config.js`).
- La pagina ha `noindex`: non verrà indicizzata dai motori, ma il link resta
  pubblico — condividilo solo con chi deve vederlo. Per protezione con password
  serve Vercel Pro (Deployment Protection).
- I CSV pubblicati da Google si aggiornano con qualche minuto di ritardo
  rispetto al foglio: è normale.
