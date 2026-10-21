# Input: CF.mp4 / WF.mp4 (inquadratura intera 1080x1920 già colorata) e le pose di pose.py. Tempi e segmenti vanno aggiornati per ogni video.
# Uso: python confronto_clone.py <cartella> <variante 1|2|3> <uscita.mp4>  (1 = rallentatore con linee, 2 = fermo immagine, 3 = pulito)
# Effetto "clone": stessa inquadratura, sinistra = registrazione W, destra = registrazione C.
import json, subprocess, sys, cv2, numpy as np
D, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
def frames(p):
    cap = cv2.VideoCapture(p); fs = []
    while True:
        ok, f = cap.read()
        if not ok: return fs
        fs.append(f)
FC, FW = frames(f'{D}/CF.mp4'), frames(f'{D}/WF.mp4')
OFFC, OFFW = 1.0, 24.0            # inizio di CF.mp4 / WF.mp4 nel video originale
PC = json.load(open(f'{D}/C.pose.json'))['frames']; PW = json.load(open(f'{D}/W.pose.json'))['frames']
# pose calcolate sui ritagli 900x3200 (C da x=1030, W da x=70, y=400) -> coordinate 1080x1920
def pose(P, t, off0, cx):
    i = round((t - off0) * 30)
    pts = [P[j] for j in range(max(0, i-2), min(len(P), i+3)) if P[j]]
    if not pts: return None
    a = np.mean(np.array(pts)[:, :, :2], axis=0)
    return np.stack([(cx + a[:, 0] * 900) / 2, (400 + a[:, 1] * 3200) / 2], 1)
pc = lambda t: pose(PC, t, 2.5, 1030)
pw = lambda t: pose(PW, t, 24.0, 70)
GREEN, RED = (90, 200, 70), (60, 60, 235)
BONES = [(11, 12), (23, 24), (11, 23), (12, 24), (11, 13), (13, 15), (12, 14), (14, 16), (23, 25), (25, 27), (24, 26), (26, 28)]
def draw(img, pf, t, col, trail=True, sp=1):
    p = pf(t)
    if p is None: return
    if trail:
        tr = [pf(t - k / 30 * sp) for k in range(24, -1, -1)]
        tr = [((q[15] + q[16]) / 2).astype(int) for q in tr if q is not None]
        for k in range(1, len(tr)):
            a = k / len(tr); ov = img.copy()
            cv2.line(ov, tuple(tr[k-1]), tuple(tr[k]), col, 5, cv2.LINE_AA)
            cv2.addWeighted(ov, a, img, 1 - a, 0, img)
    for a, b in BONES:
        cv2.line(img, tuple(p[a].astype(int)), tuple(p[b].astype(int)), col, 5, cv2.LINE_AA)
    sh, hp = (p[11] + p[12]) / 2, (p[23] + p[24]) / 2
    cv2.line(img, tuple(sh.astype(int)), tuple(hp.astype(int)), col, 9, cv2.LINE_AA)
    for j in (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28):
        cv2.circle(img, tuple(p[j].astype(int)), 8, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(img, tuple(p[j].astype(int)), 8, col, 2, cv2.LINE_AA)
X = np.arange(1080, dtype=np.float32)
def boundary(tc, tw):
    c, w = pc(tc), pw(tw)
    lo = w[:, 0].max() if w is not None else 440
    hi = c[:, 0].min() if c is not None else 540
    return float(np.clip((lo + hi) / 2, 450, 520))
def get(F, off, t): return F[min(max(round((t - off) * 30), 0), len(F) - 1)]
def mix(tc, tw, edge):
    m = np.clip((X - edge) / 50 + 0.5, 0, 1)[None, :, None]
    return (get(FW, OFFW, tw) * (1 - m) + get(FC, OFFC, tc) * m).astype(np.uint8)
# --- segmenti comuni ---
INTRO = dict(kind='intro', c=(1.3, 5.5), wipe=(4.5, 5.0), woff=22.1)   # entra il "giusto", poi compare il clone
REAL = dict(kind='play', c=(8.2, 17.0), w=28.55, sp=1)                  # sincronizzati sul primo swing in alto
END = dict(kind='play', c=(15.9, 19.0), w=34.75, sp=1)
V = {
 '1': [INTRO, REAL, dict(kind='play', c=(10.0, 12.5), w=30.25, sp=0.5, lines=True),
       dict(kind='play', c=(13.9, 15.9), w=32.75, sp=0.5, lines=True), END],
 '2': [INTRO, REAL, dict(kind='freeze', c=11.15, w=31.1, dur=2.8), dict(kind='freeze', c=14.65, w=33.7, dur=2.8),
       dict(kind='freeze', c=15.45, w=34.7, dur=2.8), END],
 '3': [INTRO, dict(kind='play', c=(8.2, 20.5), w=28.55, sp=1),
       dict(kind='play', c=(10.6, 12.6), w=30.6, sp=0.5), END],
}[variant]
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1080x1920', '-r', '30', '-i', '-',
                       '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
times, T = [], 0.0
edge_s = 480.0
for s in V:
    n0 = 0
    if s['kind'] == 'intro':
        a, b = s['c']; n = round((b - a) * 30)
        for k in range(n):
            tc = a + k / 30; tw = tc + s['woff']
            w0, w1 = s['wipe']
            if tc < w0: fr = get(FC, OFFC, tc).copy()
            else:
                e = boundary(tc, tw); edge = min(e, (tc - w0) / (w1 - w0) * e)
                fr = mix(tc, tw, edge)
            ff.stdin.write(fr.tobytes())
    elif s['kind'] == 'play':
        a, b = s['c']; off = s['w'] - a; n = round((b - a) * 30 / s['sp'])
        for k in range(n):
            tc = a + k / 30 * s['sp']; tw = tc + off
            edge_s = 0.8 * edge_s + 0.2 * boundary(tc, tw)
            fr = mix(tc, tw, edge_s)
            if s.get('lines'):
                draw(fr, pw, tw, RED, sp=s['sp']); draw(fr, pc, tc, GREEN, sp=s['sp'])
            ff.stdin.write(fr.tobytes())
    else:  # fermo immagine con linee
        n = round(s['dur'] * 30)
        fr = mix(s['c'], s['w'], boundary(s['c'], s['w']))
        draw(fr, pw, s['w'], RED, trail=False); draw(fr, pc, s['c'], GREEN, trail=False)
        for k in range(n): ff.stdin.write(fr.tobytes())
    times.append(round(T, 3)); T += n / 30
ff.stdin.close(); ff.wait()
times.append(round(T, 3)); json.dump(times, open(out + '.times.json', 'w')); print(variant, times)
