#!/usr/bin/env python3
"""Uncoach video edit: subtitles (Montserrat Black) + graphics, 5 versions, no cuts.

Usage:
  uncoach_edit.py transcribe VIDEO WORDS.json
  uncoach_edit.py render VIDEO WORDS.json OUTDIR [--versions 1,2,3,4,5]

Layout is designed on a 1080x1920 canvas (PlayRes); the video is scaled to it.
Timeline for the "Ladder EMOM 90s" clip is keyed off the transcript words,
so re-transcribing keeps graphics in sync.
"""
import json, re, subprocess, sys, os

WHITE, ORANGE, BLACK = "&H00FFFFFF&", "&H00006AFF&", "&H00000000&"   # ASS = BBGGRR
FONT = "Montserrat Black"
W, H = 1080, 1920

NUM_WORDS = {"due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sette": 7, "otto": 8,
             "nove": 9, "dieci": 10, "venti": 20, "trenta": 30}
KEYWORDS = {"ladder", "emom", "devastanti", "ignoranti", "kg", "reps", "gratis"}


def ts(t):
    t = max(0.0, t)
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def clean(w):
    return re.sub(r"[^\wàèéìòù%'/-]", "", w.strip(), flags=re.I)


def number_of(w):
    c = clean(w).lower()
    if re.fullmatch(r"\d{1,3}", c):
        return int(c)
    return NUM_WORDS.get(c)


def probe(video):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", video])
    return float(out)


def rect(w, h):
    return f"m 0 0 l {w} 0 {w} {h} 0 {h}"


def circle(r):
    c = int(r * .552)
    return (f"m {r} 0 b {r+c} 0 {2*r} {r-c} {2*r} {r} b {2*r} {r+c} {r+c} {2*r} {r} {2*r} "
            f"b {r-c} {2*r} 0 {r+c} 0 {r} b 0 {r-c} {r-c} 0 {r} 0")


class Timeline:
    def __init__(self, words, dur):
        self.words, self.dur, self.ev = words, dur, []

    def at(self, pattern, after=0.0, default=None):
        """Start time of the first word matching `pattern` at/after `after`."""
        for w in self.words:
            if w["start"] >= after - 0.05 and re.fullmatch(pattern, clean(w["word"]), re.I):
                return w["start"]
        return default

    def add(self, layer, s, e, style, txt):
        self.ev.append((layer, s, e, style, txt))

    def shape(self, layer, s, e, x, y, an, col, d, extra=""):
        self.add(layer, s, e, "Gfx", r"{\an%d\pos(%d,%d)\1c%s\bord0\shad0%s\p1}%s{\p0}" % (an, x, y, col, extra, d))

    def text(self, layer, s, e, x, y, an, size, col, txt, extra="", style="Big"):
        self.add(layer, s, e, style, r"{\an%d\pos(%d,%d)\fs%d\1c%s%s}%s" % (an, x, y, size, col, extra, txt))


# ---------------------------------------------------------------- captions
def chunks(words, max_words, max_gap=0.6, max_chars=16):
    out, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or w["start"] - cur[-1]["end"] > max_gap
                    or sum(len(clean(x["word"])) + 1 for x in cur) + len(clean(w["word"])) > max_chars
                    or re.search(r"[.!?,]$", cur[-1]["word"].strip())):
            out.append(cur); cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def captions(tl, words, V):
    cs = chunks(words, V["max_words"])
    for n, ch in enumerate(cs):
        nxt_start = cs[n + 1][0]["start"] if n + 1 < len(cs) else 1e9
        for i, w in enumerate(ch):
            start = w["start"]
            # never overlap the next chunk, or two caption lines stack up
            end = ch[i + 1]["start"] if i + 1 < len(ch) else min(w["end"] + 0.3, nxt_start)
            parts = []
            for j, x in enumerate(ch):
                t = clean(x["word"]).upper()
                hot = number_of(x["word"]) is not None or clean(x["word"]).lower() in KEYWORDS
                if j == i:
                    pop = r"\t(0,90,\fscx116\fscy116)\t(90,180,\fscx104\fscy104)" if V["pop"] else ""
                    col = ORANGE if (V["active"] == ORANGE or hot) else WHITE
                    parts.append("{\\1c" + col + pop + "}" + t + "{\\r}")
                elif j > i and V["reveal"]:
                    continue
                else:
                    parts.append(("{\\1c" + ORANGE + "}" + t + "{\\r}") if hot else t)
            tl.add(0, start, end, V["style"], "{\\pos(%d,%d)}" % (W // 2, V["cap_y"]) + " ".join(parts))
        if V.get("underline"):
            s, e = ch[0]["start"], min(ch[-1]["end"] + 0.3, nxt_start)
            bw = min(900, sum(len(clean(x["word"])) for x in ch) * 52 + 40)
            tl.shape(0, s, e, W // 2, V["cap_y"] + 62, 8, ORANGE, rect(bw, 14),
                     r"\fscx0\t(0,160,\fscx100)")


# ---------------------------------------------------------------- graphics
def number_card(tl, V, s, e, num, unit, y=1560):
    """Big stat: '52 KG', '10 PRESS'... in the version's number style."""
    x = W // 2
    if V["num"] == "giant":
        tl.text(3, s, e, x, y, 5, 300, ORANGE, num,
                r"\3c%s\bord10\fscx170\fscy170\t(0,140,\fscx100\fscy100)\fad(0,200)" % BLACK)
        tl.text(3, s + 0.1, e, x, y + 170, 5, 90, WHITE, unit, r"\fad(120,200)", "Small")
    elif V["num"] == "circle":
        r = 165
        tl.add(3, s, e, "Gfx", r"{\an5\pos(%d,%d)\1c%s\3c%s\bord14\shad0\fscx0\fscy0\t(0,150,\fscx100\fscy100)\fad(0,200)\p1}%s{\p0}" % (
            x, y, BLACK, ORANGE, circle(r)))
        tl.text(4, s + 0.08, e, x, y - 15, 5, 170 if len(num) < 3 else 130, WHITE, num, r"\bord0\fad(80,200)")
        tl.text(4, s + 0.08, e, x, y + 95, 5, 46, ORANGE, unit, r"\bord0\fad(80,200)", "Small")
    else:  # tag
        tl.text(3, s, e, x, y, 5, 230, BLACK, num,
                r"\frz-5\fscx60\fscy60\t(0,120,\fscx100\fscy100)\fad(0,200)", "Box")
        tl.text(3, s + 0.1, e, x, y + 175, 5, 80, WHITE, unit, r"\frz-5\fad(120,200)", "Label")


def hook(tl, V, end):
    tl.text(3, 0, end, W // 2, 330, 5, 210, WHITE, "LADDER",
            r"\3c%s\bord10\fscx140\fscy140\t(0,160,\fscx100\fscy100)\fad(0,250)" % BLACK)
    tl.text(3, 0.3, end, W // 2, 500, 5, 80, BLACK, "EMOM · OGNI 90''",
            r"\fad(150,250)\fscx0\t(0,180,\fscx100)", "Box")


def header(tl, s, e):
    tl.text(5, s, e, 50, 70, 7, 40, WHITE, "LADDER EMOM {\\1c%s}90''" % ORANGE, r"\fad(200,200)", "Label")


def exercise_list(tl, V, end):
    t_bent = tl.at(r"bent", 6.0, 7.5)
    t_press = tl.at(r"press", t_bent, 10.7)
    rows = [("STACCHI", tl.at(r"2", 4.0, 4.6)),
            ("BENT ROW", tl.at(r"2", t_bent - 1.0, 7.1)),
            ("PRESS", tl.at(r"2", t_press - 1.0, 10.4))]
    for i, (name, s) in enumerate(rows):
        y = 1460 + i * 120
        mv = r"\move(%d,%d,%d,%d,0,180)"
        tl.text(3, s, end, 90, y, 4, 70, BLACK, "2×", (mv % (-200, y, 90, y)) + r"\fad(0,200)", "Box")
        tl.text(3, s, end, 230, y, 4, 70, WHITE, name, (mv % (-60, y, 230, y)) + r"\fad(0,200)", "Label")


def pyramid(tl, V, start, end):
    """Bars 2-4-6-8-10-8-6-4-2 = the 9 rounds; each bar lands when said."""
    vals = [2, 4, 6, 8, 10, 8, 6, 4, 2]
    up0 = tl.at(r"aumentiamo", start, 12.3)
    ten = tl.at(r"10", up0, 13.9)
    back = tl.at(r"indietro", ten, 17.7)
    t8 = tl.at(r"8", back, 18.4); t6 = tl.at(r"6", t8, 19.2)
    t4 = tl.at(r"4", t6, 19.9); t2 = tl.at(r"2", t4, 20.5)
    nine = tl.at(r"9", t2, 21.3)
    step = (ten - up0) / 4
    appear = [up0 + i * step for i in range(5)] + [t8, t6, t4, t2]
    slot, bw, base, unit = 100, 84, 1800, 17
    x0 = (W - slot * 9) // 2 + (slot - bw) // 2
    for i, v in enumerate(vals):
        x, a = x0 + i * slot, appear[i]
        nxt = appear[i + 1] if i + 1 < 9 else nine
        segs = [(a, nxt, ORANGE, r"\fscy0\t(0,180,\fscy100)"), (nxt, nine, WHITE, ""), (nine, end, ORANGE, "")]
        for s, e, col, fx in segs:
            if e - s <= 0.01:
                continue
            fade = r"\fad(0,250)" if e == end else ""
            tl.add(2, s, e, "Gfx", r"{\an1\pos(%d,%d)\1c%s\3c%s\bord5\shad0%s%s\p1}%s{\p0}" % (
                x, base, col, BLACK, fx, fade, rect(bw, v * unit)))
        tl.text(2, a, end, x + bw // 2, base - v * unit - 8, 2, 46, WHITE, str(v), r"\fad(120,250)", "Small")
    tl.text(3, up0, back, W // 2, 1490, 5, 70, BLACK, "+2 OGNI ROUND",
            r"\fad(150,150)\fscx0\t(0,160,\fscx100)", "Box")
    tl.text(3, back, nine, W // 2, 1490, 5, 70, WHITE, "E POI SI SCENDE",
            r"\fad(150,150)\fscx0\t(0,160,\fscx100)", "Label")
    tl.text(3, nine, end, W // 2, 1470, 5, 120, ORANGE, "9 ROUND",
            r"\3c%s\bord8\fscx160\fscy160\t(0,140,\fscx100\fscy100)\fad(0,250)" % BLACK)
    if V.get("round_hud"):
        for i, a in enumerate(appear):
            nxt = appear[i + 1] if i + 1 < 9 else end
            tl.text(5, a, nxt, W - 50, 70, 9, 40, BLACK, f"ROUND {i+1}/9", "", "Box")


def cta(tl, s, e):
    cx, cy = W // 2, 800
    tl.shape(6, s, e, 0, 0, 7, BLACK, rect(W, H), r"\1a&H50&\fad(200,0)")
    tl.text(7, s, e, cx, cy - 330, 5, 120, WHITE, "COMMENTA", r"\bord0\fad(150,0)")
    pulse = "".join(r"\t(%d,%d,\fscx112\fscy112)\t(%d,%d,\fscx100\fscy100)" % (
        600 + 700 * i, 950 + 700 * i, 950 + 700 * i, 1300 + 700 * i) for i in range(6))
    tl.text(7, s + 0.4, e, cx, cy + 60, 5, 560, ORANGE, "7",
            r"\3c%s\bord12\fscx260\fscy260\t(0,220,\fscx100\fscy100)%s" % (WHITE, pulse))
    tl.text(7, s + 1.0, e, cx, cy + 430, 5, 82, BLACK, "1 SETTIMANA GRATIS", r"\fad(150,0)", "Box")
    tl.text(7, s + 2.3, e, cx, cy + 550, 5, 60, WHITE, "DEL MIO PROGRAMMA", r"\fad(150,0)", "Small")


def progress(tl, end):
    tl.shape(8, 0, end, 0, 0, 7, ORANGE, rect(W, 10), r"\fscx0\t(0,%d,\fscx100)" % int(end * 1000))


# ---------------------------------------------------------------- versions
VERSIONS = {
    1: dict(name="v1_pop", style="CapOutline", max_words=3, active=ORANGE, pop=True, reveal=False,
            cap_y=1200, num="giant"),
    2: dict(name="v2_box", style="CapBox", max_words=2, active=ORANGE, pop=False, reveal=False,
            cap_y=1220, num="tag", header=True, progress=True),
    3: dict(name="v3_oneword", style="CapShadow", max_words=1, active=WHITE, pop=True, reveal=False,
            cap_y=1180, num="giant"),
    4: dict(name="v4_underline", style="CapOutline", max_words=3, active=WHITE, pop=False, reveal=True,
            cap_y=1200, num="tag", underline=True, progress=True),
    5: dict(name="v5_hud", style="CapOutline", max_words=2, active=ORANGE, pop=True, reveal=True,
            cap_y=1220, num="circle", header=True, progress=True, round_hud=True),
}


def ass_header():
    f = lambda name, size, prim, outl, back, bs, bord, shad: (
        f"Style: {name},{FONT},{size},{prim},&H000000FF,{outl},{back},-1,0,0,0,100,100,0,0,{bs},{bord},{shad},5,0,0,0,1")
    return "\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f("CapOutline", 84, WHITE, BLACK, "&H80000000&", 1, 8, 3),
        f("CapBox", 80, WHITE, BLACK, BLACK, 3, 16, 0),
        f("CapShadow", 120, WHITE, BLACK, ORANGE, 1, 6, 9),
        f("Big", 200, ORANGE, BLACK, BLACK, 1, 10, 0),
        f("Box", 90, BLACK, ORANGE, ORANGE, 3, 18, 0),
        f("Label", 70, WHITE, BLACK, BLACK, 3, 16, 0),
        f("Small", 64, WHITE, BLACK, BLACK, 1, 6, 0),
        f("Gfx", 10, WHITE, BLACK, BLACK, 1, 0, 0),
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"])


def build_ass(words, V, dur):
    tl = Timeline(words, dur)
    t_cta = tl.at(r"commenta", 0, max(0, dur - 5))
    t_part = tl.at(r"partiamo", 0, 3.8)
    t_round = tl.at(r"ogni", t_part + 5, 11.6)
    t_press10 = tl.at(r"10", tl.at(r"clip", 0, 23.5), 24.0)
    t_52 = tl.at(r"52", t_press10, 26.2)
    t_30 = tl.at(r"trentesima", t_52, 28.8)

    captions(tl, [w for w in words if w["start"] < t_cta - 0.05], V)
    hook(tl, V, t_part - 0.1)
    if V.get("header"):
        header(tl, t_part, t_cta)
    exercise_list(tl, V, t_round - 0.1)
    pyramid(tl, V, t_round, t_press10 - 1.2)
    number_card(tl, V, t_press10, t_52 - 0.15, "10", "PRESS")
    number_card(tl, V, t_52, t_30 - 0.15, "52", "KG TOTALI")
    number_card(tl, V, t_30, t_cta - 0.1, "30ª", "RIPETIZIONE")
    cta(tl, t_cta, dur)
    if V.get("progress"):
        progress(tl, dur)

    lines = [ass_header()]
    for layer, s, e, st, txt in sorted(tl.ev, key=lambda x: (x[0], x[1])):
        lines.append(f"Dialogue: {layer},{ts(s)},{ts(e)},{st},,0,0,0,,{txt}")
    return "\n".join(lines) + "\n"


def render(video, words_path, outdir, versions):
    words = [w for w in json.load(open(words_path)) if clean(w["word"])]
    dur = probe(video)
    os.makedirs(outdir, exist_ok=True)
    for v in versions:
        V = VERSIONS[v]
        ass = os.path.join(outdir, V["name"] + ".ass")
        open(ass, "w").write(build_ass(words, V, dur))
        out = os.path.join(outdir, f"uncoach_{V['name']}.mp4")
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", video,
            "-vf", f"scale=1080:1920:flags=lanczos,ass={ass}:fontsdir={os.path.expanduser('~/.fonts')}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-movflags", "+faststart", out])
        print("wrote", out)


def transcribe(video, out):
    import numpy as np  # decode with ffmpeg: avoids PyAV version issues
    from faster_whisper import WhisperModel
    pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-i", video, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"])
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(audio, language="it", word_timestamps=True, vad_filter=True)
    words = [{"word": w.word.strip(), "start": w.start, "end": w.end} for s in segs for w in s.words]
    json.dump(words, open(out, "w"), ensure_ascii=False, indent=1)
    print(len(words), "words ->", out)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "transcribe":
        transcribe(a[1], a[2])
    else:
        vs = [1, 2, 3, 4, 5]
        if "--versions" in a:
            vs = [int(x) for x in a[a.index("--versions") + 1].split(",")]
        render(a[1], a[2], a[3], vs)
