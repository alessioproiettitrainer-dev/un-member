# UN-TIMER

App a sé, gratuita: timer EMOM, AMRAP, AFAP e IT (Interval Timer). Niente server, niente account, niente video.
Non fa parte di UN-MEMBER: l'unico collegamento è il link esterno alla prova gratuita (sezione "Workout" e fine timer).

- File statici: `index.html`, `timer.js`, `timer.css`, `sw.js` (offline), `manifest.json`, icone.
- Prova in locale: `python3 -m http.server 4100 --directory untimer` → http://localhost:4100
- Pubblicazione: qualsiasi hosting statico gratuito (Render "Static Site" con cartella `untimer`, GitHub Pages, Netlify).
- Android: si impacchetta per il Play Store come TWA (Bubblewrap) dal sito pubblicato.
- Nome: costante `NAME` in `timer.js` + `index.html` + `manifest.json`.
