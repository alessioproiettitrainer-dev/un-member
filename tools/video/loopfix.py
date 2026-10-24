# loopfix.py clip.mp4 out.mp4: sistema il loop di una clip già tagliata (senza il video originale):
# sceglie dentro la clip inizio/fine dove il corpo è nella stessa posizione e unisce fine e inizio con una dissolvenza di 0,3 s
import subprocess,numpy as np,sys
SRC,OUT=sys.argv[1],sys.argv[2]
r=subprocess.run(['ffmpeg','-v','error','-i',SRC,'-vf','scale=96:72,format=gray','-f','rawvideo','-'],capture_output=True).stdout
a=np.frombuffer(r,np.uint8).reshape(-1,72,96).astype(float); n=len(a)
D=9  # fotogrammi di dissolvenza (0,3 s a 30 fps)
best=None
for i in range(0,n//3):
    for j in range(max(i+int(n*0.6),i+60),n-D):
        d=np.abs(a[i]-a[j]).mean()+np.abs(a[i+1]-a[j+1]).mean()
        if best is None or d<best[0]: best=(d,i,j)
_,i,j=best
s,e=i/30,(j+D)/30; L=(j-i)/30
fc=(f"[0]trim={s}:{e},setpts=PTS-STARTPTS,split=3[a][b][c];[a]trim={D/30}:{L},setpts=PTS-STARTPTS[mid];[b]trim={L}:{L+D/30},setpts=PTS-STARTPTS[t];"
    f"[c]trim=0:{D/30},setpts=PTS-STARTPTS[h];[t][h]xfade=transition=fade:duration={D/30-0.01:.2f}:offset=0[x];[mid][x]concat=n=2:v=1:a=0")
subprocess.run(['ffmpeg','-v','error','-y','-i',SRC,'-filter_complex',fc,'-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-r','30','-an','-movflags','+faststart',OUT],check=True)
print(f'{SRC}: {n/30:.1f}s -> {L:.1f}s')
