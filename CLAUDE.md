# UN-MEMBER — contesto del progetto

## 1. Cos'è l'app
- PWA di allenamento di **Alessio** (UN-COACH, coach di kettlebell e calisthenics). Il proprietario non è un programmatore: parlagli **in italiano**, con spiegazioni semplici e passi concreti.
- Per chi si allena a casa o al parco con kettlebell, TRX o corpo libero.
- **Oggi:** la settimana dell'utente e l'allenamento del giorno.
- **Allenamenti:**
  - "Kettlebell Volume 1/2/3" (1 kettlebell, principianti);
  - "Programma del mese" (ciclo mensile, 2 kettlebell, intermedi e avanzati);
  - TRX BASE;
  - sezioni per categoria (kettlebell/trx/calisthenics) e tutorial.
- **Player:** video di ogni esercizio, timer e voce. Blocchi intervalli, EMOM, AMRAP e a tempo.
- **Community:** chat di gruppo e messaggi privati. Il coach scrive dall'account "UN-COACH".
- **Progressi:** calendario, peso, foto prima/dopo, record e "Test livelli" (Base, Bronzo, Argento, Oro, Elite).
- **Cibo:** contacalorie e macro.
- **Accesso:**
  - prova gratuita di 7 giorni all'iscrizione (una per email);
  - poi abbonamento con i piani in Impostazioni (per esempio "Solo allenamenti" o "Allenamenti + alimentazione"). Prezzi e link di pagamento si gestiscono dal pannello: non so con certezza quali siano quelli attivi oggi.
  - il pagamento avviene fuori dall'app, tramite link esterno (le ricevute arrivano da Stripe). L'accesso lo attiva l'admin a mano dal pannello, anche pre-attivando un'email.
  - pagamenti e nutrizione dei clienti "veri" restano su **Kalos**, il gestionale esterno.

## 2. Tecnologie
- **Server:** Node ≥18 + Express (`server.js`). Database: un file JSON, `data/db.json`, sul disco persistente di Render.
- **Frontend:** JavaScript vanilla, senza framework né build. È una PWA con service worker.
- **Hosting:** Render, piano starter con disco. Ogni push su `main` viene pubblicato in automatico in 2-3 minuti.
- **Email:** Gmail via nodemailer (SMTP) e imapflow + mailparser per leggere le risposte (`mailer.js`, `inbox.js`).
- **Kalos:** solo lettura (`kalos.js`).
- **Video:** mp4 caricati in `data/uploads`. Strumenti di taglio in Python/ffmpeg in `tools/video/` (faster-whisper, opencv).

## 3. Struttura
- **`server.js`:** tutte le API.
  - `/api/auth`, `/api/me/*`, `/api/community/*`, `/api/admin/*` (header `x-admin-key`);
  - email automatiche, campagne, `/disiscriviti`, messaggi automatici del coach.
- **`mails.js`:** testi delle email della prova (2° giorno, 4° giorno, ultimo giorno, "tutto ok?" dopo la fine).
- **`followups.js`:** email "Ci manchi".
- **`mailer.js`, `inbox.js`, `kalos.js`:** invio email, lettura delle risposte, lettura da Kalos.
- **`seed.js`:** crea dati iniziali solo se il db non esiste.
- **`public/`:**
  - `app.js` (app membri e router `#/…`), `player.js` (player degli allenamenti), `engine.js` (calcolo degli step);
  - `admin.html` + `admin.js` + `admin.css` (pannello `/admin`);
  - `style.css`, `sw.js`, `lavori.html` (pagina "Stiamo lavorando per voi" quando il server risponde 502), `img/` (foto del coach, logo UN-COACH, schermate della pagina della prova).
- **`tools/video/`:** pipeline dei video (vedi sezione 5).
- **`untimer/`:** UN-TIMER, **app separata** (Alessio: "non c'entra niente con UN-MEMBER"), statica, gratuita, offline. EMOM (intervallo libero, più intervalli/recuperi a giro; Death EMOM: round infiniti fino a STOP, scala di ripetizioni facoltativa, risultato = giri chiusi), AMRAP (+1 giro con tempi, workout scritto, alla fine giri + giro non finito), AFAP (esercizi con rip, +1/+5/+10, spunta, time cap), HIIT (lavoro/recupero × round × serie; chiave interna `it`). Timer salvati sul telefono + Diario automatico (`ut_log`, data, ora, risultato). Unico legame: link esterno alla prova (`utm_source=untimer`). Nome deciso: **UN-TIMER**. Due lingue, decise da Alessio (Impostazioni → Lingua e voce, `T('it','en')`): **romano** (registrazioni di Alessio del 6/11 in `untimer/voce/`, pulite e tagliate, elencate in `AUDIO` e in `sw.js`; `esfatto-1/2/3` sono copie di giroemom-2, lavoro-3, afap-1; senza audio il telefono legge `COACH.it`), **inglese** (UI in inglese, frasi slang americano, mp3 generati con Piper, voce maschile "bryce" (la più chiara al test di trascrizione), in `untimer/voce/en/`, elencati anche in `sw.js`). Frasi in `COACH.rm/it/en`, stessa posizione nelle tre lingue; AMRAP: "manca solo 'n giro" calcolato dal ritmo medio dei giri. `untimer-store/`: guida Play Store, testi della scheda, immagini, frasi da registrare.

## 4. Come si avvia e si pubblica
- **In locale:** `npm install`, poi `ADMIN_KEY=test123 PORT=3000 node server.js`. Pannello: `http://localhost:3000/admin`.
  - Prima dei test fai un backup di `data/db.json` e rimettilo alla fine: il db locale non va nel repository.
- **Test visivi:** Playwright in `/opt/node22/lib/node_modules/playwright/index.mjs`. Chromium headless non riproduce i video H.264: usa copie `.webm`.
- **Deploy:** `git push origin main`, poi Render pubblica da solo.
  - Le modifiche visibili ai clienti vanno mostrate ad Alessio con screenshot da telefono (390x844) **prima** del push. Nel frattempo si lavora su un ramo.
- **Variabili d'ambiente:** su Render (Environment), mai nel codice: il repository è pubblico. L'elenco è nella sezione 9.
- **Chiamate al server vero dalla sessione:** `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node -e "fetch(...)"` con header `x-admin-key`. Prendi la chiave da `.env` (`ADMIN_KEY`); se il file non c'è, chiedila ad Alessio. Non scriverla in nessun file che va su git.

## 5. Decisioni prese (non rimetterle in discussione)
- **Player come quello di KBMH (l'app di Vadim):**
  - niente schermo intero;
  - timer su una riga;
  - riquadro video 4:3;
  - sezione "Dopo" con miniatura;
  - nessuna scritta sopra il video;
  - nel recupero schermo nero, niente sfocato.
- **Schermo sempre acceso nel player:** `keepAwake()` in `player.js` (Wake Lock rinnovato a ogni ritorno in primo piano, tocco e ogni 15 s; su iPhone o se manca, video muto `public/nosleep.mp4` in loop).
- **EMOM con 2-3 esercizi nello stesso minuto:** riquadro diviso in colonne, i video girano tutti insieme (anche su iPhone, in prova: se i telefoni vecchi scattano si torna a un video alla volta togliendolo in `splitOf`). Con 4+ esercizi un video alla volta, minimo 8 s ciascuno.
- **Schermi larghi (≥760px in orizzontale: PC, tablet, TV, telefono girato):** player a 3 colonne (timer e testo a sinistra, video al centro, "Prossimi" a destra, `upList()`), pagine fino a 1100px. Tasto 📺 = istruzioni per trasmettere (duplica schermo / Trasmetti di Chrome). Tastiera: spazio = Fatto, P = pausa, frecce = avanti/indietro; anche tasti multimediali Bluetooth. Il telefono in verticale resta com'era.
- **EMOM:** niente tasto "Fatto". Gli esercizi girano in loop. A 15 secondi dalla fine compare l'anteprima del prossimo esercizio.
- **Video:**
  - 4:3, 1280x960, in `video` e in `videoBox`;
  - inquadratura larga con lo sfondo, luce e colore uguali per tutti (`tools/video/color_ref.json`);
  - loop senza "doppia immagine": `reframe.py` + `seam.py`;
  - il server non ricomprime le clip: caricare con `?raw=1`, altrimenti Render va in crash di memoria.
- **Video da Drive:** ogni originale si scarica una volta sola. Subito si tiene una copia "master" (2560 px) in `/home/user/vids/master/` e si cancella il 4K. Riscaricare spesso dallo stesso Drive blocca i download per circa 24 ore.
- **Clienti Kalos ↔ app:** si collegano **solo per email identica**, mai per nome. Kalos è **solo lettura**: mai modificare, mai aprire chat o schede.
- **Email automatiche** (partono dall'app ogni mattina alle 10, dalla Gmail uncoach.info):
  - prova: 2° giorno, 4° giorno, ultimo giorno, "tutto ok?" 2-4 giorni dopo la fine;
  - "Ci manchi" a chi non apre l'app da più di 3 giorni: la prima dopo 4 giorni, poi ogni 7, al massimo 6 di fila, con 6 testi a rotazione (`followupMail` in Impostazioni);
  - ogni email ha "Cancellati qui" (`/disiscriviti`, lista `db.unsubscribed`), che vale anche per le campagne.
- **Email a gruppi:** si fanno con `POST /api/admin/campaign`. La stessa etichetta non arriva due volte alla stessa persona. **Mostra sempre il testo ad Alessio prima di inviare.**
- **Risposte dei clienti:** si leggono da `GET /api/admin/replies` e si risponde con `POST /api/admin/reply`, sempre dopo l'ok di Alessio.
  - Una settimana di prova in più (`/users/:id/extra-week`) va solo a chi ha avuto problemi o non è riuscito a provare: **massimo 2 a persona**.
- **Messaggi del coach nella chat privata:** benvenuto con il video e l'invito alla community, poi 3° e 6° giorno (`coachMsg0/3/6`).
  - Le risposte dei membri fanno partire un'email di avviso a uncoach.info. Il nome dell'account resta "UN-COACH".
- **Programmi:** ogni programma ha `equipment` (kb1/kb2/trx/bar/band/bw) e `category`. Allenamenti mostra righe che scorrono di lato e mette in fondo i programmi per cui manca l'attrezzatura.
- **Primo accesso:** questionario → programma consigliato (`quizRecommend`). L'attrezzatura si cambia dal Profilo.
- **Pagina della prova** `#/prova` (pubblicità Meta e TikTok):
  - salva la provenienza utm in `u.source`; nel pannello c'è il riquadro "Da dove arrivano";
  - la testimonianza compare solo se `settings.provaTestimonial.text` è valorizzato. **Mai inventare testimonianze.**
- **Prova finita / scaduti:** solo la schermata per abbonarsi (`paywallView`, senza barra in basso), ricontrollo dell'accesso a ogni ritorno nell'app (`hasAccessNow`).
- **Programmi a fasi:** `p.stages` (es. [4,4,4]); con le fasi il campo `week` degli allenamenti è il numero della fase, che si ripete per le sue settimane (`stageOf` in server.js e app.js). Categoria `quick` = "20 Minuti Training".
- **Descrizioni:** ogni esercizio ha `cues` (come si esegue, 1-2 frasi) e `muscles` (muscoli coinvolti), in stile KBMH: brevi. Il vecchio testo è in `cuesOld`. Ogni programma ha in fondo alla descrizione "Cosa allena: … / Cosa non c'è: …". **Quando Alessio aggiunge esercizi o programmi nuovi, scrivi anche questi testi** (guarda gli esercizi usati nei workout).
- **Quality Test** (`public/qtest.js`): la fotocamera conta le ripetizioni valide di piegamenti, trazioni strict, toes to bar strict e burpee 5' (il complex resta a mano). MediaPipe Pose gira sul telefono (libreria da `node_modules/@mediapipe/tasks-vision` servita su `/vendor/mediapipe`, modello da storage.googleapis.com), il video non esce dal telefono. Prima 1 ripetizione di riferimento, che può solo rendere più severi i minimi fissi. Alla fine la card (post 4:5 / storia 9:16) → Community, Profilo (foto `kind: 'qtest'` con `qt`, precompila "Nuovo test" dello stesso giorno), Condividi. Per ora visibile solo a coach, admin e a chi apre un link con `?qtest=1`.
- **Membri:** possono cancellare da soli l'account (Profilo → "Elimina il mio account").
- **Traduzione automatica del browser:** bloccata (notranslate).

## 6. Regole e convenzioni
- **Testi:** tutti in italiano, tono diretto e amichevole (romano leggero, "daje"). La firma è "Alessio".
- **Design:**
  - tema scuro (`--bg #0c0c0e`), arancione `--accent #ff7a00`, font **Montserrat**, titoli in maiuscolo;
  - mobile-first, niente scroll orizzontale della pagina.
- **Codice:** vanilla JS, stile compatto come quello che c'è già. Commenti brevi in italiano. Nessuna dipendenza nuova senza motivo.
- **Segreti e dati dei clienti:** mai segreti nel codice o in questo file, mai dati dei clienti nel repository. Nei mockup usa solo dati inventati.
- **Non toccare senza chiedere:** prezzi, durata della prova, email automatiche, messaggi del coach.
- **Commit:** niente identificativi del modello nei commit.
- **Risparmio:** se un lavoro ripetitivo può girare dentro l'app (server Render) invece che in una sessione di Claude, proponilo.

## 7. Bug noti e cose in sospeso
- **Pagina della prova:** ordine attuale saluto con foto → schermate → modulo (online dal 4/11). Proposta non ancora fatta: pulsante "Inizia la prova gratis ↓" sotto il saluto.
- **Proposta non ancora fatta:** quando un membro cancella l'account, toglierlo in automatico anche dalle email.
- **Video ancora da girare** (oggi ci sono quelli vecchi verticali): elastici, Bear Crawl/Cat/Ape/Kong, Quod Gecko, Quod Press Jump, Half Swop, High Bridge, Lateral/Drop/Switch Lunge, Hollow Pullover/Tuck/Negative, L-Leg/Straddle Lift, stretching, circles, Split Squat KT/2KT, Bulgarian Goblet, 360 Press, Big Halo, Goblet Twist, ATW Lunge, Deadlift 2KT Outside, Renegade Row + Push Up, EMOM Clean+Press/Squat.
  - Da rifare: Knee L-Sit, Clean 1 Arm SX, Push Press 1H SX.
  - Circa 40 tenute hanno ancora un piccolo salto nel loop.
- **UN-TIMER (sul ramo, non ancora su main):** da fare: Render Static Site (publish dir `untimer`), account Play 25 $ (test chiuso 12 persone × 14 giorni), pacchetto TWA + `assetlinks.json`, email di contatto in `privacy.html`.
- **In programma:** nuovi programmi TRX e calisthenics, testimonianza vera per la pagina della prova (testo e foto li manda Alessio).
- **Quality Test da provare dal telefono:** piegamenti e burpee provati su video veri (14/14 e 15/16); trazioni e toes to bar senza video di prova. Da decidere: aprirlo a tutti, eventuale livello sulla card.
- **Da verificare:** che la tastiera del telefono non copra il pulsante della pagina della prova dentro i browser di Instagram e TikTok. Non si poteva simulare: deve controllarlo Alessio dal telefono.

## 8. Istruzioni per le prossime sessioni
- Leggi questo file prima di iniziare.
- Lavora in locale. Per le modifiche visibili mostra gli screenshot e aspetta l'ok prima del push su `main`.
- A fine lavoro, se è cambiato qualcosa di importante (decisioni, file nuovi, cose in sospeso), aggiorna questo file restando sintetico.

## 9. Accessi
Le chiavi vere sono in `.env` (cartella principale del progetto, escluso da git con `.gitignore`). `.env.example` ha gli stessi nomi con i valori vuoti. Quelle di produzione sono su Render → Environment. Attenzione: la sessione cloud è temporanea e un clone nuovo non ha `.env`. Se manca, chiedi le chiavi ad Alessio.
- `ADMIN_KEY`: chiave del pannello `/admin` e delle API admin (header `x-admin-key`).
- `GMAIL_USER`: Gmail da cui partono e a cui arrivano le email dell'app (uncoach.info). È anche l'account del coach se `settings.coachEmail` non è impostato.
- `GMAIL_APP_PASSWORD`: "password per le app" di Google, per spedire (SMTP) e leggere le risposte (IMAP).
- `MAIL_FROM_NAME`: nome del mittente (vuoto = "Alessio · UN-MEMBER").
- `MAIL_DAILY_CAP`: massimo di email al giorno (vuoto = 450).
- `KALOS_EMAIL`, `KALOS_PASSWORD`: login a Kalos per leggere ogni giorno la lista low ticket (solo lettura).
- `PUBLIC_URL`, `APP_URL`: indirizzo pubblico dell'app, usato nei link delle email.
- `UNSUB_SECRET`: firma dei link "Cancellati qui" (vuoto = si usa `ADMIN_KEY`).
- `PORT`: porta del server (Render la imposta da solo; in locale 3000).
- Pagamenti: nessuna chiave. I piani sono link esterni messi in Impostazioni, non c'è un collegamento API a Stripe.
- Database: nessuna credenziale. È il file `data/db.json` sul disco di Render.
