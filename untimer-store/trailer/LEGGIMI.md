# Trailer UN-TIMER (storia 1080x1920, 24,8 s)
- `UN-TIMER-trailer.mp4`: il video finito (app vera che gira, voce di Alessio, base ritmata sintetizzata, finale "Cerco 12 beta tester Android").
- Per rifarlo: servi una cartella con `scena.html` + un link `app` → `untimer/`, avvia un server (`python3 -m http.server 4200`), `node registra.mjs` (Playwright, salva i fotogrammi in `frames/`), poi la base (script Python nella sessione del 6/11) e `audio.sh`, infine ffmpeg: fotogrammi 30 fps + audio.wav → mp4 H.264.
- Dati nel video (diario, timer salvati) inventati.

## Versione 2 (28 s) — `UN-TIMER-trailer-v2.mp4`
Aggancio "POV: 9° minuto dell'AMRAP… quanti giri hai fatto? 💀" + voce "Mi sa che facevi più giri de mi nonna", logo che sbatte con timbro "GRATIS. PER SEMPRE.", telefono che entra, scritte parola per parola, zoom sui tocchi, lampi e whoosh tra le scene, "GRATIS. E sarà sempre gratis." + niente pubblicità / account / offline, finale beta tester.
File: `scena-v2.html` (animazioni guidate da `render(t)`), `registra-v2.mjs` (fotogrammi + `timeline.json` degli effetti), `audio-v2.py` (base, effetti e voce sintetizzati in Python, ducking), poi loudnorm -14 LUFS e ffmpeg.
