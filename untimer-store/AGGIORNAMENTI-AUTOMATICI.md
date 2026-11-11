# UN-TIMER: aggiornamenti automatici su Google Play e App Store

Dopo questa configurazione (una volta sola), ogni aggiornamento lo carica GitHub con un clic: costruisce l'app, la firma e la manda agli store. Nessuno deve più caricare file a mano.

## Prima cosa: la prima versione va caricata a mano
Google non permette di caricare la **primissima** versione di un'app nuova in automatico. Se non l'hai ancora fatto: Play Console → Test chiuso → carica `untimer-release-1.1.aab`. Dalla seconda in poi fa tutto GitHub.

## Google Play: l'"account di servizio" (circa 10 minuti, una volta sola)
È un utente "robot" a cui dai il permesso di caricare le versioni.

1. Vai su **console.cloud.google.com** (stesso account Google di Play Console) → in alto **Seleziona un progetto** → **Nuovo progetto** → nome `untimer` → Crea.
2. Menu ☰ → **API e servizi** → **Libreria** → cerca **Google Play Android Developer API** → **Abilita**.
3. Menu ☰ → **IAM e amministrazione** → **Account di servizio** → **Crea account di servizio** → nome `github-untimer` → Crea e continua → (ruolo: salta) → Fine.
4. Clicca sull'account appena creato → scheda **Chiavi** → **Aggiungi chiave** → **Crea nuova chiave** → **JSON** → si scarica un file `.json`. **Tienilo segreto.**
5. Copia l'indirizzo email dell'account di servizio (tipo `github-untimer@untimer-xxxx.iam.gserviceaccount.com`).
6. Vai su **Play Console** → **Utenti e autorizzazioni** → **Invita nuovi utenti** → incolla quell'email → scheda **Autorizzazioni app** → aggiungi **UN-TIMER** → spunta **Rilascia nei canali di test** e **Rilascia app in produzione** (e "Visualizza informazioni app") → **Invita utente** → Invia.

## I segreti su GitHub
github.com/alessioproiettitrainer-dev/un-member → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crea:
- `UNTIMER_KEY_PASSWORD` e `UNTIMER_KEYSTORE_B64`: i valori sono nel file `SEGRETI-GITHUB-UNTIMER.txt` che ti ho mandato.
- `PLAY_SERVICE_ACCOUNT_JSON`: apri il file `.json` con un editor di testo e incolla **tutto** il contenuto.
- Per Apple (quando avrai l'account): `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (vedi `APP-STORE-E-PC.md`).

## Da quel momento
- **Android:** GitHub → Actions → **UN-TIMER Android** → Run workflow → traccia `alpha` (test chiuso) oppure `production` → in circa 5 minuti è su Google Play. Il numero di versione lo mette GitHub da solo (100 + numero dell'avvio).
- **iPhone/iPad:** GitHub → Actions → **UN-TIMER iOS** → Run workflow → carica = `si` → arriva su TestFlight.
- Oppure dimmi "aggiorna" e li avvio io.
