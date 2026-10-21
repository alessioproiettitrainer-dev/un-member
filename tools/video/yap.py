#!/usr/bin/env python3
"""Yapping edit of the 'noia' talk: jump cuts (pauses + repeated bits removed), alternating punch-in,
small captions right under the mouth, a few inserts (calendar cards, own ladder footage).
usage: yap.py SRC.mp4 WORDS.json BROLL.mp4 OUT.mp4"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from uncoach_edit import clean, ts, rect, ORANGE, WHITE, BLACK

src, wpath, broll, out = sys.argv[1:5]
work = os.path.splitext(out)[0]
SW, SH = 1440, 2560          # source size
W, H = 1080, 1920
FX, FY = 0.46, 0.47          # face centre (fraction of frame) for punch-ins
GAP, PRE, POST = 0.30, 0.06, 0.10
# repeated / redundant passages (source seconds): second "c'è poco da fare", and the recap that restates the intro
CUTS = [(57.3, 58.45)]
END_AT = 73.15   # end on 'la vostra peggior nemica' (the final 'c'è poco da fare' is mumbled)

words = [w for w in json.load(open(wpath)) if clean(w["word"])]
words = [w for w in words if not any(a <= (w["start"] + w["end"]) / 2 <= b for a, b in CUTS)]

# ---- segments: speech between real pauses (audio energy) minus the removed passages
pauses = json.load(open(sys.argv[5])) if len(sys.argv) > 5 else []
KEEP = [(68.9, 69.8)]   # soft "fare" that the energy gate mistakes for a pause
pauses = [p for p in pauses if not any(k0 <= p[0] <= k1 for k0, k1 in KEEP)]
holes = sorted([(p0 + 0.05, p1 - 0.05) for p0, p1 in pauses if p1 - p0 > 0.15] + list(CUTS))
end = END_AT
words = [w for w in words if w["start"] < END_AT - 0.5]   # drops the clipped "in" that starts the cut recap
bounds, t = [], 0.0
for h0, h1 in holes:
    if h0 >= end: break
    if h0 > t + 0.12: bounds.append((t, h0))
    t = max(t, h1)
if end > t: bounds.append((t, end))
outstart, acc = [], 0.0
for a, b in bounds:
    outstart.append(acc); acc += b - a
DUR = acc

def remap(t):
    for (a, b), o in zip(bounds, outstart):
        if a - 1e-3 <= t <= b + 1e-3: return o + (t - a)
    # time inside a removed gap -> next segment start
    for (a, b), o in zip(bounds, outstart):
        if t < a: return o
    return DUR

def at(pattern, after=0.0):
    for w in words:
        if w["start"] >= after - 0.05 and re.fullmatch(pattern, clean(w["word"]), re.I): return w["start"]
    raise KeyError(pattern)

# ---- base cut with alternating punch-in
zooms = []
for i, (a, b) in enumerate(bounds):
    z = 1.0 if i % 2 == 0 else 1.13
    if b - a < 0.5 and zooms: z = zooms[-1]          # don't flicker on tiny fragments
    zooms.append(z)
# render each segment on its own (a single graph with ~40 trims of a 1440p source runs out of memory)
os.makedirs(work + "_segs", exist_ok=True)
lst = []
for i, ((a, b), z) in enumerate(zip(bounds, zooms)):
    cw, ch = int(SW / z) // 2 * 2, int(SH / z) // 2 * 2
    cx = min(max(int(FX * SW - cw / 2), 0), SW - cw); cy = min(max(int(FY * SH - ch / 2), 0), SH - ch)
    seg = f"{work}_segs/s{i:03d}.mp4"; lst.append(f"file '{seg}'")
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-i", src, "-t", f"{b - a:.3f}",
        "-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,setsar=1,fps=30",
        "-af", f"afade=t=in:d=0.015,afade=t=out:st={max(0, b - a - 0.02):.3f}:d=0.02",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-c:a", "pcm_s16le", "-ar", "48000", seg.replace(".mp4", ".mov")])
    lst[-1] = f"file '{seg.replace('.mp4', '.mov')}'"
open(work + "_segs/list.txt", "w").write("\n".join(lst))
base = work + "_base.mov"
subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", work + "_segs/list.txt", "-c", "copy", base])
fc = []
# own footage insert: kettlebell work while talking about weighted / particular methods
b_in, b_out = remap(at(r"zavorrato", 60)), remap(at(r"particolare", 63)) + 1.0
fc.append(f"[1:v]trim=23.6:{23.6 + (b_out - b_in):.3f},setpts=PTS-STARTPTS+{b_in:.3f}/TB,scale={W}:{H}:flags=lanczos,"
          f"eq=saturation=1.1:contrast=1.05,fade=t=in:st={b_in:.3f}:d=0.12:alpha=1,format=yuva420p[br]")
fc.append(f"[0:v][br]overlay=enable='between(t,{b_in:.3f},{b_out:.3f})':eof_action=pass[vb]")

# ---- ASS overlay
CAP_Y = 1265
ev = []
def add(layer, s, e, style, txt): ev.append((layer, s, e, style, txt))
def chip(s, e, txt, y=250, x=W // 2):
    add(5, s, e, "Chip", r"{\an5\pos(%d,%d)\fscx40\fscy40\t(0,160,\fscx100\fscy100)\fad(0,160)}%s" % (x, y, txt))
def stamp(s, e, x, y, r=34):
    d = (f"m {-r} {-r+11} l {-r+11} {-r} 0 -11 {r-11} {-r} {r} {-r+11} 11 0 {r} {r-11} {r-11} {r} 0 11 "
         f"{-r+11} {r} {-r} {r-11} -11 0")
    add(6, s, e, "Gfx", r"{\an7\pos(%d,%d)\1c%s\3c%s\bord4\shad0\fscx200\fscy200\t(0,120,\fscx100\fscy100)\fad(0,150)\p1}%s{\p0}" % (
        x, y, ORANGE, BLACK, d))

# captions: 1-3 words, small, under the mouth; keywords in orange
HOT = re.compile(r"noia|annoia|costan\w*|migliorament\w*|trazioni|cardio|corsa|100%|zavorrato|stimolo|obiettivo|vita|monoton\w*|noiosa|nemica|mai", re.I)
chunk = []
def flush():
    if not chunk: return
    s = remap(chunk[0]["start"]); e = remap(chunk[-1]["end"]) + 0.05
    txt = " ".join(("{\\1c" + ORANGE + "}" + clean(w["word"]).lower() + "{\\1c" + WHITE + "}") if HOT.search(clean(w["word"]))
                   else clean(w["word"]).lower() for w in chunk)
    add(0, s, e, "Cap", r"{\pos(%d,%d)\fscx92\fscy92\t(0,70,\fscx100\fscy100)}%s" % (W // 2, CAP_Y, txt))
    chunk.clear()
for i, w in enumerate(words):
    if chunk and (len(chunk) >= 3 or sum(len(clean(x["word"])) + 1 for x in chunk) + len(clean(w["word"])) > 15
                  or w["start"] - chunk[-1]["end"] > 0.25 or re.search(r"[.,?!]$", chunk[-1]["word"])):
        flush()
    chunk.append(w)
flush()
for k in range(len(ev) - 1):     # no overlapping caption lines
    l, s, e, st, t = ev[k]; e = min(e, ev[k + 1][1]); ev[k] = (l, s, e, st, t)

# hook
t_primis = remap(at(r"primis"))
add(5, 0, t_primis - 0.05, "Hook", r"{\an5\pos(%d,%d)\fad(0,150)}LA {\1c%s}NOIA{\1c%s} È NEMICA\NDEI TUOI MIGLIORAMENTI" % (W // 2, 330, ORANGE, WHITE))

# reason chips + X stamps
t_ma = remap(at(r"ma", 14)); t_cosa = remap(at(r"cosa", 24))
chip(t_primis, remap(at(r"migliorerete", 8)) + 1.2, "MOTIVO #1 · TI ANNOIA")
stamp(remap(at(r"mai", 9.5)), remap(at(r"mai", 9.5)) + 1.0, 760, 860)
chip(t_ma, remap(at(r"migliorerete", 19)) + 1.2, "MOTIVO #2 · MOLLI DOPO 1 MESE")
stamp(remap(at(r"mai", 20)), remap(at(r"mai", 20)) + 1.0, 760, 860)

# calendar cards
def calendar(s, e, title, filled, every=False):
    x0, y0, cell, gap = 245, 300, 74, 10
    add(4, s, e, "Gfx", r"{\an7\pos(%d,%d)\1c%s\1a&H30&\bord0\shad0\fad(150,150)\p1}%s{\p0}" % (
        x0 - 40, y0 - 120, BLACK, rect(7 * (cell + gap) + 70, 4 * (cell + gap) + 160)))
    add(5, s, e, "Chip", r"{\an5\pos(%d,%d)\fad(150,150)}%s" % (x0 - 40 + (7 * (cell + gap) + 70) // 2, y0 - 60, title))
    for d in range(28):
        r, c = divmod(d, 7)
        x, y = x0 + c * (cell + gap), y0 + r * (cell + gap)
        on = (d in filled)
        delay = int(d * 45) if every else 350
        add(5, s, e, "Gfx", r"{\an7\pos(%d,%d)\1c%s\1a&HFF&\3c%s\bord3\shad0\fad(150,150)\p1}%s{\p0}" % (
            x, y, BLACK, WHITE, rect(cell, cell)))
        if on:
            add(6, s, e, "Gfx", r"{\an7\pos(%d,%d)\1c%s\bord0\shad0\alpha&HFF&\t(%d,%d,\alpha&H00&)\fad(0,150)\p1}%s{\p0}" % (
                x + 6, y + 6, ORANGE, delay, delay + 90, rect(cell - 12, cell - 12)))
t_una = remap(at(r"una", 30.5)); t_se2 = remap(at(r"se", 33.0))
calendar(t_una, t_se2 - 0.05, "TRAZIONI: 1 VOLTA AL MESE?", {2})
stamp(t_una + 0.9, t_se2 - 0.05, 830, 640)
t_dov = remap(at(r"dovete", 40.5)); t_poi = remap(at(r"poi", 46.5))
calendar(t_dov, min(t_dov + 3.0, t_poi), "COSTANZA", set(range(28)), every=True)

chip(remap(at(r"cambiare", 48)), remap(at(r"dipende", 50)), "CAMBIA STIMOLO")
chip(remap(at(r"dipende", 50)), remap(at(r"quel", 54)), "…MA DIPENDE DALL'OBIETTIVO")
chip(b_in + 0.1, b_out - 0.1, "ZAVORRATO · LADDER · EMOM", y=330)
chip(remap(at(r"però", 66.8)), remap(at(r"quindi", 69)) , "PERÒ LO DEVI FARE")
# ending: punchline card on "peggior nemica"
t_pegg = remap(at(r"peggior", 70))
add(5, t_pegg - 0.1, DUR, "Hook", r"{\an5\pos(%d,%d)\fscx60\fscy60\t(0,160,\fscx100\fscy100)}LA {\1c%s}NOIA{\1c%s} È LA TUA\NPEGGIOR NEMICA" % (W // 2, 340, ORANGE, WHITE))

STY = lambda n, size, prim, outl, back, bs, bord, shad: (
    f"Style: {n},Montserrat Black,{size},{prim},&H000000FF,{outl},{back},-1,0,0,0,100,100,0,0,{bs},{bord},{shad},5,0,0,0,1")
ass = "\n".join(["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 2",
    "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    STY("Cap", 56, WHITE, BLACK, "&H90000000&", 1, 4, 2),
    STY("Hook", 64, WHITE, BLACK, "&H90000000&", 1, 6, 0),
    STY("Chip", 40, BLACK, ORANGE, ORANGE, 3, 14, 0),
    STY("Gfx", 10, WHITE, BLACK, BLACK, 1, 0, 0),
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    + [f"Dialogue: {l},{ts(s)},{ts(e)},{st},,0,0,0,,{t}" for l, s, e, st, t in sorted(ev, key=lambda x: (x[0], x[1]))]) + "\n"
open(work + ".ass", "w").write(ass)
fc.append(f"[vb]ass={work}.ass:fontsdir={os.path.expanduser('~/.fonts')}[vout]")
open(work + ".fc", "w").write(";\n".join(fc))
subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", base, "-i", broll, "-filter_complex_script", work + ".fc",
    "-map", "[vout]", "-map", "0:a", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
print(f"segments {len(bounds)}  {DUR:.1f}s (from {words[-1]['end']:.1f}s)  broll {b_in:.1f}-{b_out:.1f}")
