# seam.py video.mp4 pick.json nome [min max]: per gli esercizi veloci rifinisce inizio/fine a 30 fps sul riquadro di taglio, così fine e inizio combaciano
import subprocess,numpy as np,json,sys
SRC,PK,NAME=sys.argv[1:4]; MN=float(sys.argv[4]) if len(sys.argv)>4 else 4; MX=float(sys.argv[5]) if len(sys.argv)>5 else 8
P=json.load(open(PK)); p=next(x for x in P if x['name']==NAME); w,h,x,y=p['crop']
t0=p['start']-1.5; dur=(p['end']-p['start'])+3
r=subprocess.run(['ffmpeg','-v','error','-ss',str(max(0,t0)),'-t',str(dur),'-i',SRC,'-vf',f'fps=30,crop={w}:{h}:{x}:{y},scale=96:72,format=gray','-f','rawvideo','-'],capture_output=True).stdout
a=np.frombuffer(r,np.uint8).reshape(-1,72,96).astype(float); n=len(a); best=None
for i in range(n):
    for j in range(i+int(MN*30),min(n,i+int(MX*30)+1)):
        # confronto anche il fotogramma successivo (stessa direzione del movimento)
        d=np.abs(a[i]-a[j]).mean()+np.abs(a[min(i+1,n-1)]-a[min(j+1,n-1)]).mean()
        sc=d-0.15*(j-i)/30
        if best is None or sc<best[0]: best=(sc,i,j,d)
p['start']=round(max(0,t0)+best[1]/30,3); p['end']=round(max(0,t0)+best[2]/30,3)
print(NAME,p['start'],p['end'],round(best[3]/2,2)); json.dump(P,open(PK,'w'))
