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
