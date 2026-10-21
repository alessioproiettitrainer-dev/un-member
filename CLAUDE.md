# Note per Claude

- Parla in italiano con il proprietario (coach, non programmatore): spiegazioni semplici, passi concreti.
- **Risparmio di utilizzo di Claude**: quando un lavoro ripetitivo può girare dentro l'app (server su Render) invece che in una sessione o attività programmata di Claude, proponilo sempre e dillo esplicitamente. Esempi già fatti: lettura giornaliera da Kalos (`kalos.js`), email della prova e campagne inviate dall'app via Gmail (`mailer.js`, `mails.js`).
- Kalos (gestionale esterno, non nostro): **solo lettura**, mai modificare, mai aprire chat o schede. Il collegamento fa solo login + lista low ticket.
- Clienti Kalos ↔ app: si collegano **solo per email identica**, mai per nome.
- Segreti (ADMIN_KEY, credenziali Kalos e Gmail) solo nelle variabili d'ambiente di Render, mai nel codice: il repository è pubblico.
- Email a gruppi di persone (eventi, inviti): crea una campagna con `POST /api/admin/campaign` (`label`, `subject`, `body`, `htmlBody`, `recipients: [{email, name}]`, `{nome}` nel testo). La stessa etichetta non rimanda mai a chi l'ha già ricevuta. Mostra sempre il testo al proprietario prima di inviare.
