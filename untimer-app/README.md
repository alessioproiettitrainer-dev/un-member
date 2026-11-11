# UN-TIMER per Android, iPhone e iPad

App Capacitor che impacchetta la cartella `../untimer` (il timer web) dentro l'app. Niente sito da tenere online.

## Ricostruire il pacchetto (dopo ogni modifica al timer)
1. Alza `versionCode` (+1) e `versionName` in `android/app/build.gradle` (Google rifiuta lo stesso numero due volte).
2. Serve: Node 18+, JDK 21, Android SDK (`platforms;android-36`, `build-tools;36.0.0`) con `ANDROID_HOME` o `android/local.properties` (`sdk.dir=...`).
3. Metti `android/keystore.properties` (MAI su git) con `storeFile`, `storePassword`, `keyAlias=untimer`, `keyPassword`: la chiave `untimer-upload.jks` ce l'ha Alessio.
4. `npm install` poi `npm run bundle` → `android/app/build/outputs/bundle/release/app-release.aab` (da caricare su Play Console). Per un APK di prova: `cd android && ./gradlew assembleRelease`.

## Note
- Nome pacchetto: `com.uncoach.untimer`. Firma di caricamento: SHA-256 `52:87:29:F8:7C:F8:50:45:8A:53:37:F7:74:EC:3C:7F:77:4E:49:AC:A3:9A:CA:FD:3F:B9:37:83:36:49:0E:A2`.
- Plugin: keep-awake (schermo acceso), text-to-speech (voce del telefono: nella WebView quella del browser non c'è).
- `MainActivity`: suoni senza tocco (`setMediaPlaybackRequiresUserGesture(false)`).
- Icone e schermata di avvio: logo UN + TIMER (rigenerate con uno script Playwright dalla sessione del 6/11).
- Se Maven Central risponde 429: in `android/build.gradle` c'è già la copia di Google come primo repository.

## iPhone e iPad (cartella `ios/`)
- Stesso nome pacchetto `com.uncoach.untimer`, iPhone + iPad (iOS 15+), ruota su iPad.
- `AppDelegate.swift`: sessione audio "playback" + "mixWithOthers" (si sente col silenzioso, non ferma la musica).
- Si costruisce solo su Mac: lo fa GitHub (`.github/workflows/untimer-ios.yml`). A ogni modifica: costruzione di prova.
  Per caricare su TestFlight/App Store: Actions → "UN-TIMER iOS" → Run workflow → carica = si (servono i segreti Apple, vedi `untimer-store/APP-STORE.md`).

## Aggiornamenti automatici (GitHub)
- Android: `.github/workflows/untimer-android.yml` costruisce, firma (chiave dai segreti) e carica su Google Play. Avvio: etichetta `git tag untimer-android-N && git push origin untimer-android-N` (test chiuso) o `untimer-android-prod-N` (produzione).
- iOS: etichetta `untimer-ios-N` → firma e TestFlight.
- Configurazione una tantum: `untimer-store/AGGIORNAMENTI-AUTOMATICI.md`. In locale `versionCode` resta quello di `build.gradle` (o `-Pvc=N`).
