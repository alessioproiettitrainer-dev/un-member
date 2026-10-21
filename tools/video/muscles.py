#!/usr/bin/env python3
"""Standing pullover: orange muscle glow that follows the body (MediaPipe pose) + Italian labels + benefits.
usage: muscles.py SRC.mp4 POSE.json FONT.ttf OUT.mp4"""
import json, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

src, pose_path, font_path, out = sys.argv[1:5]
W, H, FPS = 1080, 1920, 30
ORANGE = (255, 106, 0)
P = json.load(open(pose_path))
N = len(P)

# --- smooth landmarks (centered moving average) so the shapes don't jitter
A = np.array([[l[:2] for l in f] for f in P], float)          # N x 33 x 2
K = 5
pad = np.concatenate([A[:1].repeat(K // 2, 0), A, A[-1:].repeat(K // 2, 0)])
A = np.stack([pad[i:i + K].mean(0) for i in range(N)])

MUSCLES = [  # key, label, start (s)
    ("delt", "DELTOIDI", 1.6), ("tri", "TRICIPITI", 2.9), ("trap", "TRAPEZIO", 4.2),
    ("serr", "DENTATO ANTERIORE", 5.5), ("core", "CORE / ADDOMINALI", 6.8)]
M_END, BEN = 8.5, 8.5
BENEFITS = ["MOBILITÀ SPALLE E TORACICA", "SPALLE E TRICIPITI PIÙ FORTI", "CORE PIÙ STABILE", "CONTROLLO DELLE SCAPOLE"]

def lerp(a, b, t): return a + (b - a) * t

def shapes(f):
    """Return {muscle: [polygons]} for frame f (image coords)."""
    L = A[f]
    sh = {"L": L[11], "R": L[12]}; el = {"L": L[13], "R": L[14]}; hip = {"L": L[23], "R": L[24]}
    c_sh, c_hip = (sh["L"] + sh["R"]) / 2, (hip["L"] + hip["R"]) / 2
    sw = np.linalg.norm(sh["L"] - sh["R"]); tl = np.linalg.norm(c_hip - c_sh)
    down = (c_hip - c_sh) / max(tl, 1); side = np.array([down[1], -down[0]])   # points to image-right
    out = {k: [] for k in ("delt", "trap", "pecs", "lats", "tri", "serr", "core")}
    for s, sg in (("L", 1), ("R", -1)):
        if (sh[s] - c_sh) @ side < 0: sg = -sg                                    # outward direction for this side
        o = side * sg
        S, E, Hp = sh[s], el[s], hip[s]
        # lats: from the armpit down the side of the torso to the waist
        out["lats"].append(np.array([
            S + down * tl * 0.10 - o * sw * 0.06, S + down * tl * 0.12 + o * sw * 0.02,
            lerp(S, Hp, 0.45) + o * sw * 0.06, lerp(S, Hp, 0.72) + o * sw * 0.0,
            lerp(S, Hp, 0.88) - o * sw * 0.08, lerp(S, Hp, 0.55) - o * sw * 0.16, lerp(S, Hp, 0.25) - o * sw * 0.14]))
        # deltoid: cap over the shoulder joint, following the upper arm
        ax = E - S; u = ax / max(np.linalg.norm(ax), 1); nn = np.array([u[1], -u[0]])
        c = S + u * sw * 0.10
        out["delt"].append(np.array([c + u * sw * r1 * np.cos(a) + nn * sw * r2 * np.sin(a)
                                     for a in np.linspace(0, 2 * np.pi, 24) for r1, r2 in [(0.17, 0.12)]]))
        # upper trapezius: neck to the top of the shoulder
        nk = c_sh - down * tl * 0.20
        out["trap"].append(np.array([nk - o * sw * 0.02, nk + o * sw * 0.07, S - down * tl * 0.02 - o * sw * 0.06,
                                     S + down * tl * 0.03 - o * sw * 0.14, c_sh - down * tl * 0.02 + o * sw * 0.06]))
        # pecs: half-moon between sternum and shoulder
        st = c_sh + down * tl * 0.08
        out["pecs"].append(np.array([
            st, lerp(st, S, 0.55) - down * tl * 0.02, S + down * tl * 0.06 - o * sw * 0.04,
            S + down * tl * 0.20 - o * sw * 0.10, lerp(st, S, 0.5) + down * tl * 0.30, st + down * tl * 0.27]))
        # triceps: along the upper arm
        ax = E - S; n = np.array([ax[1], -ax[0]]) / max(np.linalg.norm(ax), 1)
        w = sw * 0.075
        a0, a1 = lerp(S, E, 0.18), lerp(S, E, 0.92)
        out["tri"].append(np.array([a0 + n * w, lerp(a0, a1, .5) + n * w * 1.25, a1 + n * w * .6,
                                    a1 - n * w * .6, lerp(a0, a1, .5) - n * w * 1.25, a0 - n * w]))
        # serratus: finger-like strips on the side of the rib cage
        for i in range(4):
            t0 = 0.22 + i * 0.075
            p = lerp(S, Hp, t0) - o * sw * 0.10
            q = p - o * sw * 0.13 + down * tl * 0.05
            out["serr"].append(np.array([p + down * tl * 0.018, p - down * tl * 0.018, q - down * tl * 0.01, q + down * tl * 0.01]))
    # core: rectus + obliques block
    top, bot = lerp(c_sh, c_hip, 0.40), lerp(c_sh, c_hip, 0.93)
    hw = sw * 0.24
    out["core"].append(np.array([top - side * hw, top + side * hw, bot + side * hw * 0.9, bot - side * hw * 0.9]))
    return out

def level(key, t):
    m = next(x for x in MUSCLES if x[0] == key)
    if t < m[2]: return 0.0
    if t < M_END:
        age = t - m[2]
        return min(1, age / 0.25) * (0.9 if age < 1.3 else 0.22)
    return 0.3 if t < BEN + 0.6 else max(0.0, 0.3 - (t - BEN - 0.6) * 0.4)

fnt = {s: ImageFont.truetype(font_path, s) for s in (36, 44, 50, 62, 92)}

def box_text(d, xy, txt, size, fg, bg, anchor="lm", pad=14):
    x, y = xy
    b = d.textbbox((x, y), txt, font=fnt[size], anchor=anchor)
    d.rectangle((b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad), fill=bg)
    d.text((x, y), txt, font=fnt[size], fill=fg, anchor=anchor)
    return b

def stroke_text(d, xy, txt, size, fg, anchor="mm"):
    d.text(xy, txt, font=fnt[size], fill=fg, anchor=anchor, stroke_width=max(4, size // 9), stroke_fill=(0, 0, 0))

def ease(x): x = min(max(x, 0), 1); return 1 - (1 - x) ** 3

rd = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
wr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                       "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
f = 0
while True:
    buf = rd.stdout.read(W * H * 3)
    if len(buf) < W * H * 3 or f >= N: break
    t = f / FPS
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    shp = shapes(f)
    # glow mask: crisp fill + wide soft halo
    mask = np.zeros((H, W), np.float32)
    for k, polys in shp.items():
        if not any(m[0] == k for m in MUSCLES): continue
        lv = level(k, t)
        if lv <= 0: continue
        layer = np.zeros((H, W), np.float32)
        for p in polys: cv2.fillPoly(layer, [p.astype(np.int32)], 1.0, lineType=cv2.LINE_AA)
        mask = np.maximum(mask, layer * lv)
    if mask.max() > 0:
        core = cv2.GaussianBlur(mask, (0, 0), 7)
        halo = cv2.GaussianBlur(mask, (0, 0), 28)
        a = np.clip(core * 0.5, 0, 1)[..., None]
        img = img * (1 - a) + np.array(ORANGE, np.float32) * a                        # tint
        img = img + np.array([255, 120, 20], np.float32) * np.clip(halo * 0.22, 0, 1)[..., None]   # additive glow
        img = np.clip(img, 0, 255)
    im = Image.fromarray(img.astype(np.uint8)); d = ImageDraw.Draw(im)

    # hook
    if t < 1.7:
        k = ease(t / 0.35)
        stroke_text(d, (W // 2, 150), "STANDING PULLOVER", 62, (255, 255, 255))
        if t > 0.2: box_text(d, (W // 2, 245), "CON KETTLEBELL", 50, (0, 0, 0), ORANGE, "mm")
    # muscles: chip + stacked list with leader line to the current one
    if 1.5 <= t < M_END + 0.2:
        box_text(d, (W // 2, 150), "MUSCOLI COINVOLTI", 50, (0, 0, 0), ORANGE, "mm")
        live = [m for m in MUSCLES if t >= m[2]]
        for i, (key, label, t0) in enumerate(live):
            y = 1480 + i * 72
            cur = i == len(live) - 1
            d.ellipse((50, y - 11, 72, y + 11), fill=ORANGE if cur else (150, 70, 20))
            b = box_text(d, (100, y), label, 44, (0, 0, 0) if cur else (255, 255, 255), ORANGE if cur else (0, 0, 0), "lm", 10)
            if cur:
                polys = shp[key]
                # point at the polygon nearest the label side
                cents = [p.mean(0) for p in polys]
                tgt = min(cents, key=lambda c: c[0])
                k = ease((t - t0) / 0.4)
                sx, sy = b[2] + 16, y
                ex, ey = sx + (tgt[0] - sx) * k, sy + (tgt[1] - sy) * k
                d.line((sx, sy, ex, ey), fill=ORANGE, width=5)
                if k >= 1:
                    d.ellipse((tgt[0] - 11, tgt[1] - 11, tgt[0] + 11, tgt[1] + 11), fill=ORANGE)
                    r = 20 + 5 * np.sin(t * 9)
                    d.ellipse((tgt[0] - r, tgt[1] - r, tgt[0] + r, tgt[1] + r), outline=(255, 255, 255), width=4)
    # benefits
    if t >= BEN:
        box_text(d, (W // 2, 150), "BENEFICI", 50, (0, 0, 0), ORANGE, "mm")
        for i, txt in enumerate(BENEFITS):
            t0 = BEN + 0.15 + i * 0.45
            if t < t0: continue
            y = 1480 + i * 82
            x = 100 - int(260 * (1 - ease((t - t0) / 0.25)))
            d.ellipse((x - 50, y - 12, x - 26, y + 12), fill=ORANGE)
            box_text(d, (x, y), txt, 44, (255, 255, 255), (0, 0, 0), "lm", 12)
    # progress bar
    d.rectangle((0, 0, int(W * t / (N / FPS)), 9), fill=ORANGE)
    wr.stdin.write(np.asarray(im).tobytes())
    f += 1
wr.stdin.close(); wr.wait()
print("frames", f)
