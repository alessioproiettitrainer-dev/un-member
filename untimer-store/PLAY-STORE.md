# UN-TIMER su Android (Google Play)

## Come è fatta l'app Android
L'app ha **tutti i file del timer dentro** (Capacitor, cartella `untimer-app/`): niente sito da tenere online, funziona offline da subito.
- Nome pacchetto: `com.uncoach.untimer` (non si cambia più dopo il primo caricamento).
- Android 7 e successivi, target Android 16 (API 36), come chiede Google.
- Schermo acceso col sistema di Android, voce del telefono (nomi esercizi EMOM) con la sintesi vocale di Android.
- File da caricare: `untimer-release.aab` (te lo mando io). Per provarla sul telefono prima: `untimer-prova.apk`.

## La chiave di firma (IMPORTANTISSIMA)
- File `untimer-upload.jks` + password (te li mando a parte). **Salvali in 2 posti sicuri** (es. Google Drive personale + chiavetta). Mai su GitHub: il repository è pubblico.
- Serve per firmare **ogni aggiornamento**. Con "Firma dell'app di Google Play" (attiva di default) Google tiene la chiave vera; questa è la chiave di caricamento: se la perdi si può sostituire tramite l'assistenza Google, ma ci vogliono giorni.

## I passi, in ordine
1. **Account sviluppatore**: play.google.com/console → account **personale** → 25 $ una volta sola, documento d'identità e verifica del telefono. Google ci mette da qualche ora a qualche giorno a verificare.
2. **Crea app** → Nome "UN-TIMER", lingua predefinita Italiano, App (non gioco), Gratuita.
3. **Configura l'app** (lista "Configura l'app" nella Dashboard), risposte qui sotto.
4. **Scheda dello store**: testi e immagini qui sotto.
5. **Test chiuso** (obbligatorio per gli account personali nuovi): Test → Test chiuso → crea traccia → carica `untimer-release.aab` → aggiungi un elenco di tester con **almeno 12 indirizzi Gmail** → invia a revisione. I tester accettano dal link e devono **tenere l'app installata 14 giorni di fila**.
6. Dopo i 14 giorni: **Richiedi accesso alla produzione** (domande su com'è andato il test) → Produzione → nuova release con lo stesso `.aab` (o uno aggiornato) → revisione Google (di solito 1-7 giorni).

## Risposte per "Configura l'app"
- **Norme sulla privacy (URL):** serve una pagina online: `untimer/privacy.html` (manca l'email di contatto). Vedi in fondo dove pubblicarla.
- **Accesso all'app:** tutte le funzioni sono disponibili senza restrizioni (niente login).
- **Annunci:** No, l'app non contiene annunci.
- **Classificazione dei contenuti:** questionario IARC → categoria "Tutte le altre app" → rispondi **No** a tutto (niente violenza, sesso, droghe, gioco d'azzardo, contenuti generati dagli utenti, condivisione posizione, acquisti). Risultato atteso: PEGI 3 / Per tutti.
- **Pubblico di destinazione:** 18 anni e oltre (è un'app di allenamento; evita gli obblighi delle app per bambini). "Potrebbe attirare i bambini": No.
- **Sicurezza dei dati:** "L'app raccoglie o condivide dati utente?" → **No**. (Impostazioni, timer e diario restano solo sul telefono; nessun dato esce dall'app.) Crittografia in transito: non applicabile. Eliminazione dati: l'utente li cancella disinstallando l'app o dai dati dell'app.
- **App per enti pubblici:** No. **App finanziarie / sanitarie:** No (è fitness, non un dispositivo medico). **App di notizie:** No.
- **Categoria:** Salute e fitness. **Email di contatto:** quella che scegli (obbligatoria, visibile sullo store).

## Scheda dello store

**Nome:** UN-TIMER

**Descrizione breve (max 80):**
Timer gratis per EMOM, AMRAP, AFAP e HIIT. Con il coach che ti spinge, in romano.

**Descrizione completa:**
UN-TIMER è il timer per i tuoi workout, fatto da Alessio · UN-COACH. Gratis, senza account e senza pubblicità.

EMOM – Ogni 30, 45, 60, 90 secondi o quanto vuoi tu. Metti più intervalli in un giro (minuto 1 swing, minuto 2 burpees, minuto 3 recupero…) e scegli i round. Oppure Death EMOM: round infiniti finché non dici basta, con le ripetizioni che salgono a ogni giro.

AMRAP – Scegli il tempo, scrivi il workout e premi "+1 GIRO" a ogni giro. Alla fine segni anche cosa hai fatto del giro non finito.

AFAP – Scrivi gli esercizi con le ripetizioni (100 burpees, 50 swing…), segna man mano quante ne hai fatte e spunta quelli finiti. Time cap se vuoi.

HIIT – Lavoro e recupero per i round che vuoi. Puoi ripetere tutto più volte con un recupero tra le serie: 6 tabata di fila? Fatto.

In più:
• Voce in italiano e bip negli ultimi secondi
• Il coach che ti spinge nei momenti giusti ("Manca solo 'n giro, chiudilo!")
• Schermo sempre acceso durante il timer
• Salvi i tuoi timer preferiti
• Diario automatico: ogni workout con data, ora e risultato
• Funziona anche senza internet

Vuoi allenamenti già pronti, con video e programmi? Dentro l'app trovi la prova gratuita di UN-MEMBER.

**Categoria:** Salute e fitness · **Contenuti:** Per tutti · **Prezzo:** Gratis · **Pubblicità:** No
**Sicurezza dei dati:** nessun dato raccolto né condiviso.

## Immagini (in questa cartella)
- `icona-512.png` – icona 512x512
- `feature-1024x500.png` – immagine in evidenza
- `1-home.png` … `5-diario.png` – schermate telefono 1080x2160 (dati di esempio inventati)

## Store listing (English)
Su Play Console: "Aggiungi traduzioni" → Inglese (Stati Uniti), poi incolla questi testi.

**Name:** UN-TIMER

**Short description (max 80):**
Free EMOM, AMRAP, For Time & HIIT timer. With a coach that pushes you.

**Full description:**
UN-TIMER is the workout timer built by coach Alessio · UN-COACH. Free, no account, no ads.

EMOM – Every 30, 45, 60, 90 seconds or whatever you want. Stack multiple intervals in one round (minute 1 swings, minute 2 burpees, minute 3 rest…) and pick your rounds. Or go Death EMOM: endless rounds, reps climbing every round, until you call it.

AMRAP – Set the time, write the workout and tap "+1 ROUND" every round. At the end, log what you did of the unfinished round too.

AFAP / For Time – Write your exercises with reps (100 burpees, 50 swings…), log reps as you go and check off what's done. Time cap if you want one.

HIIT – Work and rest for as many rounds as you like. Repeat the whole thing with rest between sets: 6 Tabatas back to back? Done.

Plus:
• Voice coach that pushes you at the right moments ("One more round, close it out!")
• Beeps in the last seconds
• Screen stays on while the timer runs
• Save your favorite timers
• Automatic log: every workout with date, time and result
• Works offline
• English, or Italian with a Roman-dialect coach

**Category:** Health & Fitness · **Ads:** No · **Price:** Free

## Dove pubblicare la pagina privacy (Google vuole un link)
Una delle due:
- **Più semplice:** Render → New → Static Site → repository `un-member`, Publish Directory `untimer` (gratis) → link `https://<nome>.onrender.com/privacy.html`. Fa anche da versione web del timer.
- Oppure un **Documento Google** pubblico con lo stesso testo (Condividi → Chiunque abbia il link).
