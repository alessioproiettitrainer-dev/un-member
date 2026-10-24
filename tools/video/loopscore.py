# loopscore.py clip.mp4: quanto "salta" il passaggio fine→inizio rispetto a un fotogramma normale (1 = invisibile)
import subprocess,numpy as np,sys
for f in sys.argv[1:]:
    r=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf','scale=96:72,format=gray','-f','rawvideo','-'],capture_output=True).stdout
    a=np.frombuffer(r,np.uint8).reshape(-1,72,96).astype(float)
    m=np.abs(np.diff(a,axis=0)).mean(); print(f'{np.abs(a[0]-a[-1]).mean()/max(m,0.1):.2f}\t{f}')
