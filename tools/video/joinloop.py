# joinloop.py out.mp4 clipA tA0 tA1 clipB tB0 tB1 [...]: unisce pezzi di clip già tagliate (stessa inquadratura) con dissolvenze
# di 0,25 s e chiude il loop (la fine sfuma nell'inizio). Esempio: Gorilla Row (dx+sx) + un Row 2KT.
import subprocess,sys
OUT=sys.argv[1]; P=sys.argv[2:]; D=0.25
segs=[(P[i],float(P[i+1]),float(P[i+2])) for i in range(0,len(P),3)]
inp=[]; fc=[]; 
for k,(f,a,b) in enumerate(segs):
    inp+=['-i',f]; fc.append(f"[{k}]trim={a}:{b+(D if k<len(segs)-1 else 0)},setpts=PTS-STARTPTS,fps=30[s{k}]")
cur='s0'; off=segs[0][2]-segs[0][1]-D
for k in range(1,len(segs)):
    fc.append(f"[{cur}][s{k}]xfade=transition=fade:duration={D}:offset={off:.3f}[j{k}]"); cur=f'j{k}'; off+=segs[k][2]-segs[k][1]
L=sum(b-a for _,a,b in segs)
fc.append(f"[{cur}]split=3[a][b][c];[a]trim={D}:{L-D},setpts=PTS-STARTPTS[mid];[b]trim={L-D}:{L},setpts=PTS-STARTPTS[t];[c]trim=0:{D},setpts=PTS-STARTPTS[h];[t][h]xfade=transition=fade:duration={D-0.01:.2f}:offset=0[x];[mid][x]concat=n=2:v=1:a=0")
subprocess.run(['ffmpeg','-v','error','-y']+inp+['-filter_complex',';'.join(fc),'-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-r','30','-an','-movflags','+faststart',OUT],check=True)
print(OUT,round(L-D,2),'s')
