# Musica originale per il trailer UN-MEMBER: 120 BPM, La minore, 23 secondi.
# 0-3 s intro (pad + riser), 3-19 s "drop" (cassa, rullante, hi-hat, basso), 19-23 s finale (colpo + coda).
# Effetti sonori: whoosh a ogni cambio scena, impatto sul drop e sul finale.
import numpy as np, wave, sys

SR = 44100
DUR = 23.0
N = int(SR * DUR)
BEAT = 0.5  # 120 BPM
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))

def t_(d): return np.arange(int(SR * d)) / SR

def put(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l * 1.414
    mix[i:i + len(sig), 1] += sig * gain * r * 1.414

def lp(x, fc):  # passa basso a un polo
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y

def hp(x, fc): return x - lp(x, fc)

def env(n, a, d):  # attacco/decadimento esponenziale
    e = np.exp(-np.arange(n) / (d * SR)); k = int(a * SR)
    if k: e[:k] *= np.linspace(0, 1, k)
    return e

# --- strumenti
def kick():
    t = t_(0.45); f = 45 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + 0.25 * np.tanh(6 * np.sin(ph)) * np.exp(-t * 30)

def snare():
    t = t_(0.28); n = hp(rng.standard_normal(len(t)), 1200) * np.exp(-t * 16)
    return 0.6 * n + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22)

def hat(open_=False):
    t = t_(0.18 if open_ else 0.05); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 70))

def saw(f, d):
    t = t_(d); x = np.zeros(len(t))
    for det in (-0.12, 0, 0.12):  # tre oscillatori leggermente stonati = suono "grosso"
        ff = f * 2 ** (det / 12); x += 2 * ((t * ff) % 1) - 1
    return x / 3

def bass(f, d):
    t = t_(d); x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t)
    return lp(x, 380) * env(len(t), 0.005, d * 0.9)

def whoosh(d=0.5, up=True):
    t = t_(d); n = rng.standard_normal(len(t))
    sweep = np.linspace(400, 6000, len(t)) if up else np.linspace(6000, 400, len(t))
    out = np.zeros(len(t)); s = 0.0
    a = np.exp(-2 * np.pi * sweep / SR)
    for i in range(len(t)): s = (1 - a[i]) * n[i] + a[i] * s; out[i] = s
    sh = np.sin(np.pi * t / d) ** 2
    return hp(out, 300) * sh * 2.2

def impact():
    t = t_(1.6); f = 32 + 70 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crash = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 2.8) * 0.35
    return np.tanh(1.6 * boom) + crash

# accordi (La minore): Am - F - C - G, una battuta (4 battiti = 2 s) ciascuno
CH = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 261.63, 329.63), (196.0, 246.94, 293.66)]
ROOT = [55.0, 43.65, 65.41, 49.0]

# --- intro 0-3 s: pad che sale + riser
for k in range(2):
    d = 1.5; t = t_(d)
    pad = sum(saw(f, d) for f in CH[k]) / 3
    pad = lp(pad, 600 + 900 * k) * np.linspace(0.3 + 0.35 * k, 0.65 + 0.35 * k, len(t))
    put(pad, k * 1.5, 0.35, -0.2); put(pad, k * 1.5 + 0.01, 0.35, 0.2)
put(whoosh(2.9, True) * np.linspace(0.2, 1, int(SR * 2.9)), 0.1, 0.45)
for i in range(4): put(hat(), 2.0 + i * 0.25, 0.25)  # rullata di hi-hat prima del drop

# --- drop 3-19 s
DROP, END = 3.0, 19.0
b = 0
tt = DROP
while tt < END - 1e-6:
    bar = int((tt - DROP) // 2) % 4
    put(kick(), tt, 0.9)
    if b % 2 == 1: put(snare(), tt, 0.55, 0.05)
    put(hat(), tt + BEAT / 2, 0.22, 0.3)
    put(hat(b % 4 == 3), tt + BEAT * 0.75, 0.12, -0.3)
    # basso a ottavi, con "pompaggio" sotto la cassa
    for h in range(2):
        bb = bass(ROOT[bar] * (2 if h else 1), BEAT / 2)
        bb *= np.linspace(0.35, 1, len(bb)) if h == 0 else 1
        put(bb, tt + h * BEAT / 2, 0.42)
    # accordo staccato sul contrattempo
    st = sum(saw(f * 2, 0.18) for f in CH[bar]) / 3
    put(lp(st, 2600) * env(len(st), 0.003, 0.08), tt + BEAT / 2, 0.16, 0.25 if b % 2 else -0.25)
    tt += BEAT; b += 1

# whoosh a ogni cambio scena (scene da 2 s dal drop) e impatti
for k in range(9): put(whoosh(0.45, k % 2 == 0), DROP + k * 2 - 0.3, 0.35, -0.4 if k % 2 else 0.4)
put(impact(), DROP, 0.9)

# --- finale 19-23 s: colpo forte + accordo lungo che sfuma
put(impact(), END, 1.0)
d = 4.0; t = t_(d)
pad = sum(saw(f, d) for f in CH[0]) / 3
put(lp(pad, 1400) * np.exp(-t * 0.9), END, 0.35, -0.2); put(lp(pad, 1400) * np.exp(-t * 0.9), END + 0.012, 0.35, 0.2)
for i, f in enumerate((440.0, 523.25, 659.25)):  # tre note che salgono sul logo
    tn = t_(0.6); put(np.sin(2 * np.pi * f * tn) * np.exp(-tn * 5), END + 0.5 + i * 0.25, 0.18, (-0.3, 0, 0.3)[i])

# --- mix finale: compressione dolce, sfumatura in uscita, normalizzazione
mix = np.tanh(mix * 0.8)
fade = np.ones(N); k = int(SR * 0.6); fade[-k:] = np.linspace(1, 0, k); mix *= fade[:, None]
mix /= np.max(np.abs(mix)) * 1.06
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', DUR, 's')
