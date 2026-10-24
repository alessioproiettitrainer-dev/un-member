import sys,json
from faster_whisper import WhisperModel
m=WhisperModel(sys.argv[2] if len(sys.argv)>2 else "small",device="cpu",compute_type="int8")
import numpy as np,wave
w=wave.open(sys.argv[1]);a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
segs,info=m.transcribe(a,language="it",word_timestamps=True,vad_filter=True)
for s in segs:
    for wd in s.words: print(f"{wd.start:7.1f} {wd.word}",flush=True)
