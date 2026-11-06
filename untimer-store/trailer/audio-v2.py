# Audio del trailer: base ritmata + effetti + voce di Alessio, tutto sintetizzato qui (niente diritti d'autore)
import json, subprocess, numpy as np, wave
SR = 44100
TL = json.load(open('timeline.json')); D = TL['dur'] + 0.2; N = int(SR * D)
rng = np.random.default_rng(7)
t_ = lambda s: np.arange(int(s * SR)) / SR
def env(n, a=0.005, r=0.1):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / r)
def lp(x, k):  # passa-basso semplice (media mobile)
    return np.convolve(x, np.ones(k) / k, 'same')
def noise(s): return rng.standard_normal(int(s * SR))
# --- effetti
def whoosh():
    s = 0.45; x = noise(s); t = t_(s); out = np.zeros_like(x)
    for i, k in enumerate([40, 20, 10, 6]): out += lp(x, k) * np.sin(np.pi * np.clip(t / s * 1.2 - i * 0.05, 0, 1)) ** 2
    return out * 0.35
def pop():
    t = t_(0.09); return np.sin(2 * np.pi * (500 + 900 * t / 0.09) * t) * env(len(t), 0.002, 0.03) * 0.5
def tap():
    t = t_(0.05); return (np.sin(2 * np.pi * 1800 * t) * 0.3 + noise(0.05) * 0.15) * env(len(t), 0.001, 0.012)
def key():
    t = t_(0.03); return noise(0.03) * env(len(t), 0.0005, 0.006) * 0.25
def boom():
    t = t_(1.2); return (np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 8)) * t) * 0.9 + lp(noise(1.2), 60) * 0.4) * env(len(t), 0.003, 0.45)
def impact():
    t = t_(0.9); return (np.sin(2 * np.pi * (45 + 120 * np.exp(-t * 18)) * t) + lp(noise(0.9), 8) * 0.6 * np.exp(-t * 9)) * env(len(t), 0.001, 0.32) * 0.9
def stamp():
    t = t_(0.25); return (np.sin(2 * np.pi * (90 + 200 * np.exp(-t * 30)) * t) + lp(noise(0.25), 4) * 0.7) * env(len(t), 0.001, 0.06) * 0.8
def ding():
    t = t_(0.6); return (np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 1976 * t)) * env(len(t), 0.002, 0.18) * 0.22
def beep():
    t = t_(0.14); return np.sin(2 * np.pi * 880 * t) * env(len(t), 0.003, 0.08) * 0.35
def riser():
    s = 1.6; t = t_(s); x = noise(s); k = (t / s)
    return (lp(x, 6) * k ** 2 * 0.5 + np.sin(2 * np.pi * (200 + 900 * k ** 2) * t) * k ** 3 * 0.25)
FX = dict(whoosh=whoosh, pop=pop, tap=tap, key=key, boom=boom, impact=impact, stamp=stamp, ding=ding, beep=beep, riser=riser)
fx = np.zeros(N); voc = np.zeros(N)
def place(buf, sig, t, v=1.0):
    i = max(0, int(t * SR)); j = min(N, i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * v
for e in TL['sfx']:
    if e['name'] == 'voice':
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '/workspace/un-member/untimer/' + e['f'], '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
        place(voc, np.frombuffer(raw, np.float32) * 1.15, e['t'])
    else: place(fx, FX[e['name']](), e['t'], e.get('v', 1.0))
# --- base: 124 bpm, parte piena col logo (2,3 s), si ferma sul "GRATIS" e riparte sul finale
bpm = 124; b = 60 / bpm; mus = np.zeros(N)
kick = lambda: (lambda t: np.sin(2 * np.pi * (48 + 100 * np.exp(-t * 32)) * t) * env(len(t), 0.002, 0.16))(t_(0.3))
hat = lambda: noise(0.04) * env(int(0.04 * SR), 0.0005, 0.012) * 0.18
clap = lambda: lp(noise(0.18), 3) * env(int(0.18 * SR), 0.001, 0.05) * 0.45
bassn = [55, 55, 65.41, 49, 55, 55, 73.42, 61.74]
def bass(f): t = t_(b / 2 * 0.95); return (np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t)) * env(len(t), 0.003, 0.12) * 0.16
free0 = next(e['t'] for e in TL['sfx'] if e['name'] == 'impact' and e['t'] > 20) - 0.05
fin0 = [e['t'] for e in TL['sfx'] if e['name'] == 'impact'][-1]
start = 2.3; k = 0; x = start
while x < D - 0.6:
    stop = free0 - 1.0 < x < fin0  # pausa a effetto prima del "GRATIS" e durante
    if not stop:
        place(mus, kick(), x)
        if k % 2 == 1: place(mus, clap(), x)
        place(mus, hat(), x + b / 2); place(mus, hat(), x + b * 0.75, 0.5)
        place(mus, bass(bassn[(k // 2) % 8]), x); place(mus, bass(bassn[(k // 2) % 8] * 2), x + b / 2, 0.6)
    x += b; k += 1
# il "GRATIS" con solo un accordo che vibra
t = t_(fin0 - free0); chord = sum(np.sin(2 * np.pi * f * t) for f in (220, 277.2, 329.6)) * 0.07 * np.minimum(1, t / 0.4) * np.clip((t[-1] - t) / 0.3, 0, 1)
place(mus, chord, free0)
# ducking: la base si abbassa quando parla Alessio
e = np.abs(voc); e = lp(e, int(0.08 * SR)); g = 1 - 0.65 * np.clip(e / (e.max() * 0.25 + 1e-9), 0, 1); g = lp(g, int(0.05 * SR))
mix = mus * 0.55 * g + fx * 0.8 + voc * 1.0
mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # limita i picchi in modo morbido
st = np.stack([mix, mix], 1)
with wave.open('mix.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
print('durata', D, 'effetti', len(TL['sfx']))
