# Trailer UN-TIMER (storia 1080x1920, 24,8 s)
- `UN-TIMER-trailer.mp4`: il video finito (app vera che gira, voce di Alessio, base ritmata sintetizzata, finale "Cerco 12 beta tester Android").
- Per rifarlo: servi una cartella con `scena.html` + un link `app` → `untimer/`, avvia un server (`python3 -m http.server 4200`), `node registra.mjs` (Playwright, salva i fotogrammi in `frames/`), poi la base (script Python nella sessione del 6/11) e `audio.sh`, infine ffmpeg: fotogrammi 30 fps + audio.wav → mp4 H.264.
- Dati nel video (diario, timer salvati) inventati.
