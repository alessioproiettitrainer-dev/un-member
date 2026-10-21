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
Elenco preso dalla didascalia; il video non era scaricabile (`*.cdninstagram.com` bloccato): appena si può, guardalo e
aggiusta le descrizioni. Strumenti: FFmpeg (filtri) per gli effetti sul girato, HyperFrames/GSAP per testo e transizioni,
MediaPipe / rimozione sfondo (`hyperframes remove-background`) dove serve separare il soggetto.

| Effetto | Cosa fa | Come | Quando usarlo nei miei video |
|---|---|---|---|
| Crash zoom | zoom a scatto rapido sul viso/oggetto | scale+crop animati (FFmpeg `zoompan` o keyframes HyperFrames) | punchline, numero importante, "commenta 7" |
| Text behind | scritta dietro al soggetto | maschera del soggetto (remove-background) + testo tra sfondo e soggetto | titolo/hook dell'esercizio |
| Flash cut | lampo bianco/arancione di 2-3 frame al taglio | overlay colore con fade brevissimo | cambio esercizio, jump cut d'impatto |
| Thermal cam | look termocamera (falsi colori) | `format=gray` + `lut`/`pseudocolor` | far vedere "dove brucia" un muscolo |
| Whip pan | transizione a frusta con motion blur | traslazione veloce + `tmix`/blur direzionale | passaggio tra due clip/esercizi |
| Freeze frame | fermo immagine con testo/frecce | `tpad=stop_mode=clone` o frame ripetuto | spiegare la posizione corretta |
| Slit-scan | distorsione temporale a strisce | ogni riga/colonna da un frame diverso (script numpy) | intro creativa, movimento fluido |
| VHS rewind | riavvolgimento stile VHS | `reverse` + rumore, scanlines, aberrazione cromatica | "rivediamolo", rifare un errore |
| Screen push | la nuova clip spinge fuori la vecchia | due layer traslati (`xfade=slideleft` o GSAP) | sequenza di esercizi in un circuito |
| X-ray | effetto raggi X sul corpo | negativo + contrasto + glow (+ muscoli evidenziati, `tools/video/muscles.py`) | muscoli coinvolti |
| Iris wipe | cerchio che si apre/chiude | maschera circolare animata (`geq`/GSAP clip-path) | inizio/fine video, focus su un dettaglio |
| Film burn | bruciatura pellicola calda | overlay arancione/luce additivo con fade | transizione "emozionale", outro |
| Wigglegram | effetto stereo che oscilla | 2-3 frame vicini alternati in loop + leggero shift | posa finale, foto/progressi |
| Glitch slice | strisce orizzontali spostate | `crop`/`overlay` a fette + RGB shift | hook, cambio argomento netto |
| Barrel roll | rotazione a 360° in transizione | `rotate` animato + zoom | transizione energica tra due clip |
| Night vision | visione notturna verde | `colorchannelmixer` verde + rumore + vignetta | contenuti "allenamento all'alba/notte", ironici |
| Ratio switch | cambio formato (16:9 ↔ 9:16) a schermo | crop/pad animati | prima/dopo, "zoom out" sul contesto |
| Datamosh | pixel che "colano" tra due clip | rimozione I-frame (ffmpeg + bitstream) o simulazione con blend a blocchi | transizione molto stilizzata, da usare raramente |
| Fisheye | lente grandangolo bombata | `lenscorrection` / `v360` | momenti comici, primo piano |
| Pixel reveal | immagine che si rivela da pixel grossi | `scale` down/up animato (`neighbor`) | svelare risultato, esercizio "segreto" |
