"""Monta un video workout nello stile UN: taglia le clip, applica la LUT, mette le scritte.

Uso: python3 video/monta_workout.py <video_log.mp4> <schema.json> <uscita.mp4>
Serve ffmpeg. Lo schema è descritto in video/README.md (esempio: video/esempio_upper_body.json).
"""
import json, os, subprocess, sys, tempfile

QUI = os.path.dirname(os.path.abspath(__file__))
LUT = os.path.join(QUI, 'UN_Workout_Look.cube')
BOLD = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
SEMI = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
SY, BY = 165, 210  # scritte sopra la testa: riga piccola e riga grande


def durata(path):
    return float(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))


def scritta(testo, s, e, y, size, font):
    testo = testo.replace('\\', '\\\\').replace("'", "’").replace(':', '\\:')
    a = f"if(lt(t,{s:.3f}+0.3),(t-{s:.3f})/0.3,if(gt(t,{e:.3f}-0.3),({e:.3f}-t)/0.3,1))"
    return (f"drawtext=fontfile={font}:text='{testo}':fontsize={size}:fontcolor=white:"
            f"shadowcolor=black@0.35:shadowx=0:shadowy=2:x=(w-text_w)/2:y={y}:"
            f"enable='between(t,{s:.3f},{e:.3f})':alpha='{a}'")


def main(src, schema_path, out):
    schema = json.load(open(schema_path))
    lut = os.path.join(QUI, schema.get('lut', 'UN_Workout_Look.cube'))
    tmp = tempfile.mkdtemp()
    # 1) ogni clip a parte (il 4K tutto insieme esaurisce la memoria)
    parti = []
    for i, c in enumerate(schema['clip']):
        p = os.path.join(tmp, f'part{i}.mp4')
        vf = (f"fps=30,crop=1728:3072:{c.get('x', 216)}:{c.get('y', 576)},scale=1080:1920:flags=lanczos,"
              f"lut3d={lut},vignette={schema.get('vignette', 'PI/5')},format=yuv420p")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c['da']), '-t', str(c['a'] - c['da']),
                        '-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', p],
                       check=True)
        parti.append(p)
    # 2) tempi delle clip nel video finale
    tempi, t = [], 0
    for p in parti:
        d = durata(p)
        tempi.append((t, t + d))
        t += d
    totale = t
    # 3) scritte
    voci = []
    intro = schema.get('intro')
    for i, c in enumerate(schema['clip']):
        s, e = tempi[i]
        if i == 0 and intro:
            fine_intro = s + intro.get('durata', 2.9)
            if intro.get('piccolo'):
                voci.append(scritta(intro['piccolo'], s + 0.2, fine_intro, SY, 30, SEMI))
            voci.append(scritta(intro['grande'], s + 0.2, fine_intro, BY, 56, BOLD))
            s = fine_intro + 0.1
        if c.get('finale'):
            meta = s + (e - s) / 2
            voci.append(scritta(c['grande'], s + 0.1, meta, BY, 56, BOLD))
            if c.get('sotto'):
                voci.append(scritta(c['sotto'], s + 0.1, meta, BY + 80, 30, SEMI))
            voci.append(scritta(c['finale'], meta + 0.1, totale + 1, BY, 56, BOLD))
            if c.get('finale_sotto'):
                voci.append(scritta(c['finale_sotto'], meta + 0.1, totale + 1, BY + 80, 30, SEMI))
            continue
        if c.get('piccolo'):
            voci.append(scritta(c['piccolo'], s, e, SY, 30, SEMI))
        if c.get('grande'):
            voci.append(scritta(c['grande'], s, e, BY, 52, BOLD))
    filtro = os.path.join(tmp, 'filtro.txt')
    open(filtro, 'w').write('[0:v]' + ','.join(voci + [f'fade=t=out:st={totale - 1:.2f}:d=1', 'format=yuv420p']) + '[out]')
    lista = os.path.join(tmp, 'lista.txt')
    open(lista, 'w').write(''.join(f"file '{p}'\n" for p in parti))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
                    '-filter_complex_script', filtro, '-map', '[out]', '-c:v', 'libx264', '-crf', '19',
                    '-preset', 'medium', '-movflags', '+faststart', out], check=True)
    print(f'{out}: {totale:.1f} secondi')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
