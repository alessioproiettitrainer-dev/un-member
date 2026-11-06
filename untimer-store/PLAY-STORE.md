# UN-TIMER su Android (Google Play)

## I passi, in ordine

1. **Mettere online l'app (gratis, 5 minuti, lo fa Alessio da Render)**
   - Render → New → **Static Site** → repository `un-member`.
   - Branch: `claude/timer-app-free-xnnk01` (finché non la uniamo a `main`).
   - Build Command: `echo ok` · Publish Directory: `untimer`.
   - Nome: `un-timer` → indirizzo `https://un-timer.onrender.com`. Il piano "Static Site" è gratuito e non tocca UN-MEMBER.
   - Più avanti si può dare un dominio suo (es. timer.uncoach.it).
2. **Account sviluppatore Google Play**: play.google.com/console → 25 $ una volta sola, con documento d'identità.
   - Account **personale** nuovo: Google chiede un **test chiuso con almeno 12 persone per 14 giorni** prima di poter pubblicare per tutti. Vanno benissimo clienti e community (serve solo il loro indirizzo Gmail).
3. **Pacchetto Android**: lo genero io dal sito online (TWA: l'app Android apre il sito a schermo intero, senza barra del browser). Ne escono:
   - il file `.aab` da caricare sul Play Store;
   - la **chiave di firma**: va conservata per sempre (serve per ogni aggiornamento);
   - il file `assetlinks.json`, che metto io in `untimer/.well-known/`.
4. **Scheda dello store**: testi qui sotto + immagini in questa cartella.
5. Test chiuso 14 giorni → richiesta di pubblicazione → revisione Google (qualche giorno).

Gli aggiornamenti dei timer dopo la pubblicazione **non richiedono** un nuovo pacchetto: basta aggiornare il sito.

## Scheda dello store

**Nome:** UN-TIMER

**Descrizione breve (max 80):**
Timer gratis per EMOM, AMRAP, AFAP e HIIT. Con il coach che ti spinge, in romano.

**Descrizione completa:**
UN-TIMER è il timer per i tuoi workout, fatto da Alessio · UN-COACH. Gratis, senza account e senza pubblicità.

EMOM – Ogni 30, 45, 60, 90 secondi o quanto vuoi tu. Metti più intervalli in un giro (minuto 1 swing, minuto 2 burpees, minuto 3 recupero…) e scegli i round.

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
**Privacy:** `https://<indirizzo-del-sito>/privacy.html` (manca l'email di contatto: va scritta in `untimer/privacy.html`)
**Sicurezza dei dati:** nessun dato raccolto né condiviso.

## Immagini (in questa cartella)
- `icona-512.png` – icona 512x512
- `feature-1024x500.png` – immagine in evidenza
- `1-home.png` … `5-diario.png` – schermate telefono 1080x2160 (dati di esempio inventati)
