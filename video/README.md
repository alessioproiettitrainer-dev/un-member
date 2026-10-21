# Video workout in stile UN

Tutto quello che serve per montare i video workout girati in casa sempre con lo stesso look.

- `UN_Workout_Look.cube`: LUT colore (caldo, spento, ombre ambra). **Solo per video girati in Log** sullo Xiaomi 15T Pro.
- `monta_workout.py`: taglia le clip, applica la LUT e la vignettatura, mette le scritte e la dissolvenza finale.
- `esempio_upper_body.json`: lo schema del primo video (Upper body 18', EMOM piramidale).

## Come si gira
Pro → video, 4K 30 fps, **Log**, 1x, tempo 1/50, ISO 100-400, WB 5500K, stabilizzatore spento.
Telefono sul treppiede vicino alla finestra, a circa 1 m da terra, dritto. Luci di casa spente, tende chiuse.

## Come si monta
```
python3 video/monta_workout.py video_log.mp4 schema.json uscita.mp4
```
Il video si scarica da Google Drive con
`curl -L -o video.mp4 "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`.

Schema (`schema.json`):
- `intro`: `piccolo` e `grande`, mostrati sui primi ~3 secondi della prima clip.
- `clip`: in ordine. `da`/`a` in secondi del video originale, `x` = spostamento del ritaglio
  (0-432, più alto = inquadratura più a destra; ritaglio 1728x3072 da 2160x3840, `y` di default 576).
  `piccolo` (es. "MINUTO 1") e `grande` (es. "6 x GORILLA ROW + ROW").
- Ultima clip con `finale`: prima `grande` + `sotto`, poi `finale`, poi dissolvenza al nero.

## Regole di stile
- Esercizi: **2 ripetizioni** per esercizio. Se ci sono varianti, usare quella indicata dal proprietario.
- Scritte bianche Inter, centrate, **sopra la testa** (mai sul viso). Nomi degli esercizi in inglese, il resto in **italiano**.
- Finale: "RIPETI PER N ROUND" + "ripetizioni e maggiori info nella didascalia", poi "SALVA E PROVALO".
- Niente nome Instagram e niente audio (la musica la mette il proprietario su Instagram).

## Video di confronto (giusto vs sbagliato)
Split screen: sinistra giusto (linee verdi), destra sbagliato (linee rosse), con rallentatore 0,5x e linee del corpo.
Strumenti: `pose.py` (posizioni del corpo) e `confronto_split.py` (montaggio). Scritte con lo stesso stile, etichette
"CHI LO SA FARE" (verde) e "CHI IMPROVVISA" (rosso). Tecnica ed errori dello swing: `swing_hardstyle.md`.
