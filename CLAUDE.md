# Uncoach – note per Claude

## Montaggio video

Quando ti chiedo di montare, modificare, sottotitolare o fare grafiche per un video, usa sempre questi strumenti
(li installa `.claude/hooks/video-tools.sh` a ogni avvio di sessione; log in `/tmp/video-tools-setup.log`):

- **HyperFrames** per sottotitoli, grafiche e animazioni: parti dalla skill `hyperframes`, che sceglie il flusso giusto
  (`embedded-captions` per i sottotitoli, `talking-head-recut` per le grafiche sopra un video parlato,
  `motion-graphics` per titoli e card, `general-video` per il resto).
  GSAP: se `cdn.jsdelivr.net` è bloccato, copia `~/.cache/video-tools/gsap.min.js` nel progetto e punta lo `<script>` lì.
- **FFmpeg** per tagli, jump cut, zoom, unione di clip e audio.
- **yt-dlp** per scaricare Reel di riferimento (serve `www.instagram.com` tra gli Allowed domains dell'ambiente).
- **faster-whisper** (modello `large-v3`, lingua `it`) per trascrivere con i tempi delle parole; **MediaPipe** per seguire il corpo
  (es. muscoli illuminati sugli esercizi).
- **Watch** (skill `watch`, pacchetto `watch-skill`) per analizzare un video di riferimento (cosa si dice, cosa si vede,
  ordine dei passaggi) e trasformare un metodo/tutorial in una skill. Con `GEMINI_API_KEY` (Google AI Studio, gratis)
  capisce meglio audio e immagini: la chiave va nei secret dell'ambiente, **mai incollata in chat**; serve anche
  `generativelanguage.googleapis.com` negli Allowed domains. Senza chiave lavora in locale (sottotitoli + Whisper).
- Script già pronti in `tools/video/`: `uncoach_edit.py` (sottotitoli + grafiche, 5 versioni), `yap.py` (stile yapping),
  `muscles.py` (muscoli coinvolti sopra il corpo).

Video da Google Drive: scaricali con
`curl -sSL "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`
(il connettore Drive accetta solo file sotto i 10 MB).

### Stile Uncoach
- Font **Montserrat Black**; colori **bianco, arancione `#FF6A00`, nero**; niente logo.
- Mai tagliare il video se non lo chiedo; nello stile yapping invece togli pause e ripetizioni.
- CTA abituale: **"Commenta 7"** per una settimana gratis del programma/membership (solo se ha senso nel video).
- Muscoli e benefici di un esercizio: verificali sulla variante che faccio (es. in piedi vs sdraiato) prima di scriverli.
- Contenuti di altri creator solo come riferimento di stile, non da ripubblicare.

### Libreria effetti di riferimento
Effetti che mi piacciono. Quando montiamo un video e uno di questi può servire, usalo; se non è chiaro se
ci sta, chiedimelo prima con una domanda breve. Prima di usarne uno, scarica il Reel con yt-dlp (o dalla copia
su Drive, se c'è) e guardalo: la descrizione qui sotto va completata la prima volta che lo vedi.

Fonte 1: https://www.instagram.com/reel/DekNPnCiNW5/ (Andreas Massouras, "20 video effects Claude can create").
Copia del video vista il 21/10 (caricata da me in chat). Il Reel è anche un **formato** riutilizzabile:
- parla in camera, in alto titolo in due box rossi ("20 video effects / Claude can create");
- ai lati del viso una lista numerata in due colonne (1-10 / 11-20), la voce corrente evidenziata in un box colorato;
- la demo di ogni effetto in una card con angoli arrotondati al centro-basso, con un pallino numerato in alto a sinistra;
- parte bassa sfocata; outro scurito con CTA grande "Comment EFFECTS" in box e icona Instagram.
Per me: stesso schema con arancione `#FF6A00` al posto del rosso (es. "5 esercizi per…", "3 errori…") e CTA "Commenta 7". Strumenti: FFmpeg (filtri) per gli effetti sul girato, HyperFrames/GSAP per testo e transizioni,
MediaPipe / rimozione sfondo (`hyperframes remove-background`) dove serve separare il soggetto.

| Effetto | Cosa fa | Come | Quando usarlo nei miei video |
|---|---|---|---|
| Crash zoom | zoom a scatto rapido sul viso/oggetto | scale+crop animati (FFmpeg `zoompan` o keyframes HyperFrames) | punchline, numero importante, "commenta 7" |
| Text behind | scritta enorme (nel Reel "CLAUDE" rossa) dietro al soggetto | maschera del soggetto (remove-background) + testo tra sfondo e soggetto | titolo/hook dell'esercizio |
| Flash cut | silhouette piena colorata del soggetto (rossa nel Reel) per pochi frame al taglio | overlay colore con fade brevissimo | cambio esercizio, jump cut d'impatto |
| Thermal cam | termocamera: soggetto giallo/arancio su fondo viola-blu | `format=gray` + `lut`/`pseudocolor` | far vedere "dove brucia" un muscolo |
| Whip pan | transizione a frusta con motion blur | traslazione veloce + `tmix`/blur direzionale | passaggio tra due clip/esercizi |
| Freeze frame | fermo immagine con testo/frecce | `tpad=stop_mode=clone` o frame ripetuto | spiegare la posizione corretta |
| Slit-scan | distorsione temporale a strisce | ogni riga/colonna da un frame diverso (script numpy) | intro creativa, movimento fluido |
| VHS rewind | riavvolgimento stile VHS | `reverse` + rumore, scanlines, aberrazione cromatica | "rivediamolo", rifare un errore |
| Screen push | la nuova clip spinge fuori la vecchia | due layer traslati (`xfade=slideleft` o GSAP) | sequenza di esercizi in un circuito |
| X-ray | negativo azzurro-bianco luminoso, tipo radiografia | negativo + contrasto + glow (+ muscoli evidenziati, `tools/video/muscles.py`) | muscoli coinvolti |
| Iris wipe | tutto nero tranne un cerchio sul viso che si apre/chiude | maschera circolare animata (`geq`/GSAP clip-path) | inizio/fine video, focus su un dettaglio |
| Film burn | lampo di luce calda giallo-arancio che brucia l'immagine | overlay arancione/luce additivo con fade | transizione "emozionale", outro |
| Wigglegram | effetto stereo che oscilla | 2-3 frame vicini alternati in loop + leggero shift | posa finale, foto/progressi |
| Glitch slice | strisce orizzontali spostate | `crop`/`overlay` a fette + RGB shift | hook, cambio argomento netto |
| Barrel roll | rotazione a 360° in transizione | `rotate` animato + zoom | transizione energica tra due clip |
| Night vision | verde fosforo con vignetta circolare (binocolo) | `colorchannelmixer` verde + rumore + vignetta | contenuti "allenamento all'alba/notte", ironici |
| Ratio switch | bande nere che stringono il formato (letterbox) | crop/pad animati | prima/dopo, "zoom out" sul contesto |
| Datamosh | pixel che "colano" tra due clip | rimozione I-frame (ffmpeg + bitstream) o simulazione con blend a blocchi | transizione molto stilizzata, da usare raramente |
| Fisheye | lente grandangolo bombata | `lenscorrection` / `v360` | momenti comici, primo piano |
| Pixel reveal | mosaico a pixel grossi che si risolve nell'immagine | `scale` down/up animato (`neighbor`) | svelare risultato, esercizio "segreto" |

Fonte 2: Reel "17 video effects Claude can create" (@tenfoldmarc), copia vista il 21/10 (caricata in chat).
Formato: titolo in alto giallo minuscolo bold ("17 video effects / claude can create"); nome dell'effetto grande in basso
a sinistra con contatore "01/17"; sfondo reale, look scuro e caldo; outro con sottotitoli karaoke gialli e mockup del
profilo Instagram con CTA "comment STUDIO". Per me: giallo → arancione `#FF6A00`, contatore tipo "03/05".

| Effetto | Cosa fa | Quando usarlo nei miei video |
|---|---|---|
| Orbit | card/clip che girano intorno al soggetto | varianti di un esercizio attorno a me |
| Couch wall | parete di foto/schermate dietro il soggetto | progressi clienti, recensioni |
| UI world | lo sfondo diventa un'interfaccia chiara (chat/app), io dentro | parlare della app/membership Uncoach |
| Frame break | video dentro una cornice (telefono) e il soggetto ne esce | hook, esercizio che "esce" dallo schermo |
| Digital zoom | punch-in digitale a scatti | enfasi, alternativa al crash zoom |
| Phone mockup | mockup di telefono con UI che entra di lato | mostrare la app, il programma, la chat |
| Checklist | card con spunte che si spuntano una alla volta | benefici, errori da evitare, "come farlo" |
| Headline wall | ritagli/titoli/post-it attorno alla testa | miti del fitness, frasi che senti in palestra |
| Zoom-through cut | zoom dentro un elemento che porta alla scena dopo | transizione tra parlato ed esercizio |
| Chart grow | grafico a linea che si disegna con punto luminoso | progressi, ladder/ripetizioni che salgono |
| Pull-back reveal | zoom indietro: il video era dentro una finestra/app | CTA verso la app, "ecco il programma" |
| Green screen | soggetto scontornato in un riquadro su fondo scuro | intro, cambio scena |
| Paper cut | collage di carta: lettere ritagliate, scarabocchi, me scontornato con bordo bianco | contenuti leggeri/ironici, titoli |
| Doodle boil | contorno disegnato a mano che "vibra" attorno al soggetto + scintille | evidenziare me o un muscolo, hook |
| Vertigo | dolly zoom (sfondo che si allarga mentre io resto fermo) | momento "wow", rivelazione |
| Cover story | titolo enorme serif tipo copertina di rivista | apertura di una serie, titolo forte |
| Glass type | testo su vetro smerigliato/trasparente | citazioni, frasi chiave eleganti |

Fonte 3: Reel sulla skill "Watch" (@promptalluso), copia vista il 21/10 (caricata in chat).
Formato "tutorial a passi" pulito: parla in camera, sottotitoli 1-2 parole bianchi bold al centro con la parola chiave in
**corsivo serif** (es. "detto,", "immagini.", "esempi,"); hook in alto bianco bold + riga in corsivo serif ("(ora fa il
lavoro al posto tuo)"); card bianche stile app a metà-basso che mostrano ogni passo con etichetta scura "1 · Installa…",
"2 · …"; piccole icone (logo/app) che compaiono sopra la testa; outro scurito con icona Instagram e chip "Commenta VIDEO".
Per me: card bianche con etichetta arancione, corsivo serif solo per le parole chiave, utile per "3 passi per…" e
spiegare la app/membership.

Fonte 4: Reel "Effect of the Day" (@corbinsylk), copia vista il 21/10 (caricata in chat), solo musica.
Formato: registrazione dello schermo dell'app Claude in cui scrive un comando (`/match-cut`, `/shutter-strike`…) e subito
dopo il risultato a tutto schermo; finale con griglia "Effect of the Day – 20 effects" e CTA "Comment STACK".

| Effetto | Cosa fa | Quando usarlo nei miei video |
|---|---|---|
| Match cut | pagina di testo che scorre, una parola evidenziata in un box colorato resta ferma mentre il testo cambia | frase chiave/parola tormentone ("costanza"), aprire un tema |
| Shutter strike | scatti fotografici: foto/card che compaiono con flash e si impilano come polaroid | mostrare più esercizi o clienti in sequenza veloce |
| Screen push digital | testo enorme a pixel/LED su fondo scuro che scorre ("All in one prompt") | hook, numeri ("100%"), slogan |
| Liquid glass graph | card di vetro smerigliato con grafico che sale e percentuale che conta (69%) | progressi, forza/carichi che salgono, % di miglioramento |
| Pixel drop | particelle/pixel che cadono e riempiono un riquadro, parola sotto ("detail") | costruire un risultato "un pezzo alla volta", costanza |
| Over-the-shoulder zoom | zoom leggero mentre accanto alla spalla spuntano card "prima/dopo" con cifre ($3.200 → $32.000) | prima/dopo (kg, misure, ripetizioni), risultati clienti |
