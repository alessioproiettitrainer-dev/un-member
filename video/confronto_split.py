# Split screen giusto (sinistra, linee verdi) vs sbagliato (destra, linee rosse) con rallentatore.
# Input: C.mp4 / W.mp4 (meta 540x1920 già colorate) e C.pose.json / W.pose.json (da pose.py).
# I tempi in OFF e SEG vanno aggiornati per ogni video. Le scritte si aggiungono dopo con drawtext.
# Serve: pip install mediapipe opencv-python-headless (+ libegl1) e il modello pose_landmarker_heavy.task.
import json, subprocess, sys, cv2, numpy as np
D = sys.argv[1]; out = sys.argv[2]
C = cv2.VideoCapture(f'{D}/C.mp4'); W = cv2.VideoCapture(f'{D}/W.mp4')
def frames(cap):
    fs = []
    while True:
        ok, f = cap.read()
        if not ok: return fs
        fs.append(f)
FC, FW = frames(C), frames(W)
PC = json.load(open(f'{D}/C.pose.json'))['frames']; PW = json.load(open(f'{D}/W.pose.json'))['frames']
OFF = {'C': 2.5, 'W': 24.0}
GREEN, RED = (90, 200, 70), (60, 60, 235)  # BGR
# segmenti: (C da, C a, W da, W a, velocità, linee)
SEG = [(2.7, 4.7, 24.5, 26.5, 1, False),
       (8.2, 14.0, 28.55, 34.35, 1, False),
       (10.0, 12.5, 30.25, 32.75, 0.5, True),
       (13.9, 15.9, 32.75, 34.75, 0.5, True),
       (15.9, 18.4, 34.75, 37.25, 1, False)]
def pose(P, i):
    pts = [P[j] for j in range(max(0, i-2), min(len(P), i+3)) if P[j]]
    if not pts: return None
    return np.mean(np.array(pts)[:, :, :2], axis=0) * [540, 1920]
BONES = [(11, 12), (23, 24), (11, 23), (12, 24), (11, 13), (13, 15), (12, 14), (14, 16), (23, 25), (25, 27), (24, 26), (26, 28)]
def draw(img, P, i, col):
    p = pose(P, i)
    if p is None: return
    sh, hp = (p[11]+p[12])/2, (p[23]+p[24])/2
    # traccia del kettlebell (mani) negli ultimi fotogrammi
    trail = [pose(P, k) for k in range(max(0, i-24), i+1)]
    trail = [((t[15]+t[16])/2).astype(int) for t in trail if t is not None]
    for k in range(1, len(trail)):
        a = k / len(trail)
        ov = img.copy(); cv2.line(ov, tuple(trail[k-1]), tuple(trail[k]), col, 5, cv2.LINE_AA)
        cv2.addWeighted(ov, a, img, 1-a, 0, img)
    for a, b in BONES:
        cv2.line(img, tuple(p[a].astype(int)), tuple(p[b].astype(int)), col, 5, cv2.LINE_AA)
    cv2.line(img, tuple(sh.astype(int)), tuple(hp.astype(int)), col, 9, cv2.LINE_AA)  # busto
    for j in (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28):
        cv2.circle(img, tuple(p[j].astype(int)), 8, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(img, tuple(p[j].astype(int)), 8, col, 2, cv2.LINE_AA)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1080x1920', '-r', '30',
                       '-i', '-', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
times, t = [], 0.0
for cs, ce, ws, we, sp, lines in SEG:
    n = round((ce - cs) * 30 / sp)
    for k in range(n):
        ic = min(round((cs - OFF['C']) * 30 + k * sp), len(FC)-1)
        iw = min(round((ws - OFF['W']) * 30 + k * sp), len(FW)-1)
        L, R = FC[ic].copy(), FW[iw].copy()
        if lines:
            draw(L, PC, ic, GREEN); draw(R, PW, iw, RED)
        fr = np.hstack([L, R]); fr[:, 538:542] = (235, 235, 235)
        ff.stdin.write(fr.tobytes())
    times.append((round(t, 3), round(t + n / 30, 3))); t += n / 30
ff.stdin.close(); ff.wait()
json.dump(times, open(out + '.times.json', 'w')); print(times)
