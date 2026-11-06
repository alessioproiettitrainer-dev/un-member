# UN-TIMER su iPhone, iPad e PC

## iPhone e iPad (App Store)
L'app iOS è già pronta in `untimer-app/ios/`: stessa app di Android (timer dentro l'app, offline, la tua voce e quella inglese), per iPhone **e** iPad. Su iPad si gira in orizzontale: timer gigante a sinistra, lista e pulsanti a destra.

**Non serve un Mac:** la costruisce GitHub su un Mac suo, gratis (il repository è pubblico). A ogni modifica fa già una costruzione di prova.

### Cosa serve da te
1. **Apple Developer Program**: developer.apple.com/programs → iscrizione come persona, **99 $ l'anno**, con il tuo ID Apple (meglio con l'autenticazione a due fattori attiva). Apple verifica in 1-2 giorni.
2. **App Store Connect** (appstoreconnect.apple.com) → App → **+** → Nuova app:
   - Piattaforma iOS · Nome **UN-TIMER** · Lingua principale Italiano · ID bundle **com.uncoach.untimer** (se non c'è nell'elenco: developer.apple.com → Certificates, IDs & Profiles → Identifiers → + → App IDs → `com.uncoach.untimer`) · SKU `untimer`.
3. **Chiave API** per far caricare l'app a GitHub: App Store Connect → Utenti e accessi → Integrazioni → **Chiavi API di App Store Connect** → genera, ruolo **App Manager**. Scarica il file `.p8` (si scarica UNA volta sola) e annota **Key ID** e **Issuer ID**. Il **Team ID** è in developer.apple.com → Membership.
4. Mandami Team ID, Key ID, Issuer ID e il file `.p8`. Oppure li metti tu su GitHub → repository `un-member` → Settings → Secrets and variables → Actions → New repository secret:
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (tutto il testo del file .p8).
5. Poi: GitHub → Actions → "UN-TIMER iOS" → **Run workflow** → carica = `si`. In 10-15 minuti l'app arriva su **TestFlight** (la provi sul tuo iPhone/iPad con l'app TestFlight).
6. Scheda dello store (testi e risposte uguali a Google, vedi `PLAY-STORE.md`) + screenshot (te li preparo nelle misure Apple quando arriviamo lì) → **Invia per la revisione** (1-3 giorni). Apple non chiede il test di 14 giorni.

### Cose da sapere
- **Privacy su App Store Connect:** "Raccolta dati" → **Nessun dato raccolto**. Serve comunque il link alla pagina privacy (la stessa di Google).
- **Età:** 4+. **Prezzo:** Gratis.
- **Rischio da conoscere:** Apple a volte non accetta link che portano a un abbonamento venduto fuori dall'App Store (il "Prova gratis" di UN-MEMBER). Se lo contestano, nella versione iPhone/iPad togliamo quel link in 5 minuti e la ricarichiamo.

## PC (Windows e Mac)
Il timer funziona già nel browser del PC (Chrome, Edge, Safari): tastiera inclusa (**spazio** = +1 giro o pausa, **P** = pausa) e schermata per schermi larghi. Va solo messo online:

1. **Sito (gratis):** Render → New → **Static Site** → repository `un-member` → Publish Directory `untimer` → nome `un-timer`. Indirizzo tipo `https://un-timer.onrender.com`. Fa anche da pagina privacy (`/privacy.html`) per Google e Apple.
2. **Installabile come app:** da Chrome o Edge sul PC compare l'icona "Installa UN-TIMER" nella barra degli indirizzi: si apre in una finestra sua, con l'icona nel menu Start / Dock, e funziona anche offline.
3. **Microsoft Store (facoltativo, gratis per gli sviluppatori singoli):** quando il sito è online, da pwabuilder.com genero il pacchetto per lo Store di Windows.

Il Mac App Store non serve: su Mac basta il sito installato da Chrome/Edge (o "Aggiungi al Dock" di Safari).
