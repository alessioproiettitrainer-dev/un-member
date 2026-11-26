#!/bin/bash
# costruzione del sito un-timer.onrender.com (Render Static Site: comando "bash untimer-site/build.sh", cartella "untimer-dist")
set -e
O=untimer-dist # cartella di uscita: NON public/, quella è di UN-MEMBER
rm -rf "$O" && mkdir "$O"
cp -r untimer-site/. "$O"/ && rm -f "$O"/build.sh
cp -r untimer "$O"/app && cp untimer/privacy.html "$O"/privacy.html
# aggiornamento automatico delle app iPhone/Android: zip della cartella untimer + latest.json
# MIN = versione minima dell'app dello store che può usare questo contenuto (alzarla se il timer usa plugin nuovi)
MIN=1.3
V=$(echo "${RENDER_GIT_COMMIT:-$(git rev-parse HEAD 2>/dev/null || date +%s)}" | cut -c1-10)
mkdir -p "$O"/update
python3 - "$V" "$MIN" "$O" <<'PY'
import sys, os, zipfile, hashlib, json
v, mn, o = sys.argv[1:4]
z = f'{o}/update/web-{v}.zip'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    for root, _, files in os.walk('untimer'):
        for n in sorted(files):
            if n == '.DS_Store': continue
            p = os.path.join(root, n); f.write(p, os.path.relpath(p, 'untimer'))
h = hashlib.sha256(open(z, 'rb').read()).hexdigest()
json.dump({'version': v, 'url': f'https://un-timer.onrender.com/update/web-{v}.zip', 'checksum': h, 'min': mn}, open(f'{o}/update/latest.json', 'w'))
print('aggiornamento app:', v, os.path.getsize(z) // 1024, 'KB')
PY
