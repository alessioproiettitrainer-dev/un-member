# UN-MEMBER

App di allenamento per membri: programmi con video demo e timer che vanno da soli (EMOM, AMRAP, AFAP, round a tempo, serie), profilo personale con calendario, challenge, progressi (peso e foto prima/dopo) e conta calorie. Tu gestisci tutto dal pannello admin.

## Avvio

```bash
npm install
node seed.js            # solo la prima volta: crea dati di esempio
ADMIN_KEY=la-tua-chiave-segreta npm start
```

- App membri: http://localhost:3000 (ci si iscrive con nome, email e password)
- Pannello admin: http://localhost:3000/admin (entri con `ADMIN_KEY`)

Sul telefono si installa come un'app: dal browser, "Aggiungi a schermata Home".

## Pannello admin

| Sezione | Cosa fai |
|---|---|
| Programmi | Programmi **base** (sempre disponibili) e **cicli** (partono da una data e durano N settimane: 4–6). I cicli futuri restano nascosti finché non partono, quelli finiti vanno in "Cicli passati" |
| Esercizi & video | Video demo (file o link YouTube/Drive/Vimeo), indicazioni tecniche, varianti più facile/difficile, **ritmo per ripetizione** |
| Bacheca | **Challenge** (es. 100 push-up al giorno, 8.000 passi) e **consigli lifestyle**, con date di inizio e fine |
| Membri | Abbonamenti (+1/+3/+6 mesi, +1 anno, revoca), pre-attivazione per email, calorie e macro impostati dal coach |
| Staff | Account dei delegati (email + password) |
| Impostazioni | Nome dell'app, frase, **logo**, link al sito per l'abbonamento, email di assistenza |

### Abbonamenti (pagamenti sul tuo sito con Stripe)

I pagamenti restano sul tuo sito. Nell'app ogni membro ha una **data di scadenza**:

1. Arriva un pagamento su Stripe. Tu o un delegato cercate l'email del cliente in **Membri** e premete +1 mese, +3 mesi, +6 mesi o +1 anno. Se l'accesso è ancora attivo i mesi si sommano alla scadenza attuale.
2. Il cliente non si è ancora iscritto all'app? Usate **Pre-attiva un'email**: quando si iscrive con quella email trova l'accesso già attivo.
3. Chi non ha un abbonamento attivo vede solo una schermata con il link al tuo sito e il tasto "Ho già pagato, ricontrolla". Progressi e storico restano salvati anche quando scade.
4. Filtri: In attesa, In scadenza (7 giorni), Scaduti, Attivi. Ogni attivazione registra chi l'ha fatta e quando.

**Delegati (staff)**: li crei nella sezione Staff. Entrano in `/admin` con email e password e vedono **solo Membri**: attivano accessi e impostano la nutrizione. Non possono modificare programmi, esercizi o impostazioni, né eliminare membri.

### Calorie e macro

Il membro inserisce nel profilo peso, altezza, sesso, anno di nascita, obiettivo e i giorni in cui si allena. Le calorie si calcolano con la formula Mifflin-St Jeor, moltiplicata per un fattore che dipende dagli allenamenti a settimana: 0 → 1,2 · 1–2 → 1,375 · 3–4 → 1,55 · 5–6 → 1,725 · 7 → 1,9. Poi si aggiunge −400 kcal per dimagrire o +300 per la massa.

I macro sono in percentuale e diventano grammi (4 kcal/g per proteine e carboidrati, 9 per i grassi):
- **Il membro sceglie**: preset (Bilanciato 30/40/30, Più proteine 40/35/25, Low carb 35/25/40, Più carboidrati 25/50/25) o percentuali libere che fanno 100.
- **Il coach imposta**: dall'admin (Membri → Nutrizione) scegli kcal fisse o calcolo automatico, le percentuali e una nota. Il membro le vede bloccate con scritto "Impostati dal tuo coach". "Lascia scegliere al membro" gli restituisce la scelta.

Nel diario del cibo si scrivono le kcal oppure solo i grammi dei macro (le kcal le calcola l'app).

### Video lunghi da YouTube, Google Drive o Vimeo

I video lunghi non serve caricarli sull'app: basta il link.
- **Blocco "Video"** in un allenamento (es. una lezione da seguire o una spiegazione): incolli il link e scrivi la durata indicativa. Nel player il video si guarda dentro l'app, c'è il tasto "Apri a schermo intero", e con "Fatto" si passa al blocco dopo.
- **Esercizi**: al posto del file caricato puoi mettere un link. YouTube e Vimeo girano in loop senza audio come i video caricati, Drive si avvia con un tocco. Se ci sono sia il file sia il link, vince il file.
- **Consigli in bacheca**: campo video opzionale.

Su Google Drive il file va condiviso con "Chiunque abbia il link". Su YouTube puoi pubblicare i video come "Non in elenco": non compaiono nelle ricerche e li vede solo chi ha il link.

### Il ritmo per ripetizione (AMRAP e AFAP)

Per ogni esercizio scrivi quante ripetizioni ci sono nel video demo (es. 7 swing in un video di 7 s): l'app calcola il ritmo (1 s a ripetizione). In alternativa scrivi direttamente i secondi per ripetizione (swing 1, push-up 1,5…).

Nell'AMRAP e nell'AFAP il player fa il **giro guidato**: mostra il numero di ripetizione che sale (1, 2, 3… 50) al ritmo dell'esercizio, il video riparte in sincrono, poi passa da solo all'esercizio dopo e conta i round. Chi va più veloce preme "Fatto ›" e passa subito al prossimo. Nell'AMRAP il risultato salvato è tipo "4 round + 12 rip", nell'AFAP il tempo.

Nelle ripetizioni dei blocchi puoi scrivere `20`, `8-12` (conta 8), `5 + 5` (conta 10) o un tempo come `30s` / `1 min`.

## App membri

- **Oggi**: giorni da membro, calendario della settimana (giorni scelti cerchiati, allenamenti fatti in arancione), prossimo allenamento, challenge con pulsanti +5/+10/+25 e giorni completati, consigli.
- **Allenamenti**: ciclo in corso (con "settimana 2 di 4"), programmi base, cicli passati. "Segui questo programma" lo imposta come proprio.
- **Progressi**: totali, peso con grafico, foto prima/dopo (private: le vede solo il membro), storico allenamenti.
- **Cibo**: calorie e macro del giorno con barre di proteine, carboidrati e grassi, pasti della giornata, "aggiungi di nuovo" per i cibi frequenti, scelta dei macro.
- **Profilo**: stato dell'abbonamento con link per rinnovare, giorni di allenamento, peso, altezza e dati per le calorie.

## File

- `server.js`: server, account (password cifrate, sessione con cookie), API membri e admin
- `data/db.json`: tutti i dati · `data/private/`: foto dei membri · `data/uploads/`: video, logo, copertine (basta fare il backup di `data/`)
- `public/engine.js`: trasforma un allenamento in step a tempo, calcola il ritmo
- `public/player.js`: il player
- `public/app.js`: app membri · `public/admin.js`: pannello admin

## Per andare online

**Render (consigliato per partire)**: carica il progetto su un repository GitHub, poi su render.com → New → Blueprint → scegli il repository. Il file `render.yaml` configura tutto, compreso il disco permanente per `data/`. La chiave admin generata la trovi in Render → Environment → `ADMIN_KEY`. Render ti dà un indirizzo https (es. `un-member.onrender.com`) e puoi collegare un tuo dominio (es. `app.tuosito.it`).

**Installare sul telefono (Android, anche Xiaomi)**: apri l'indirizzo con Chrome → menu ⋮ → "Installa app" / "Aggiungi a schermata Home". Sugli Xiaomi, se l'icona non compare: Impostazioni → App → Gestisci app → Chrome → Altre autorizzazioni → "Scorciatoie schermata Home" → Consenti.

Server sempre acceso con Node 18+ e spazio per i video (una VPS da pochi euro al mese), HTTPS obbligatorio (password e foto), `ADMIN_KEY` impostata, backup regolari di `data/` e `uploads/`. Con molti iscritti conviene passare il database a PostgreSQL e i video su un CDN.

## Prossimi passi possibili

- Attivazione automatica da Stripe (webhook: il pagamento sul sito attiva l'app da solo, senza delegato)
- Reset della password via email
- Ricerca alimenti con banca dati e codice a barre per il conta calorie
- Notifiche push nei giorni di allenamento
- Pubblicazione su App Store / Google Play (Capacitor)
