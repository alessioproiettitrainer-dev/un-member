# colormatch.py raw.mp4 pick.json -> stampa il filtro EXTRA che porta luce e colore ai valori di color_ref.json
import json,subprocess,sys,os,numpy as np,math
SRC,PICK=sys.argv[1],sys.argv[2]
ref=json.load(open(os.path.join(os.path.dirname(__file__),'color_ref.json')))
FW,FH,S=3840,2160,8
LIGHT="curves=all='0/0 0.15/0.24 0.4/0.56 0.75/0.87 1/1',eq=saturation=0.97"
def crop(p):
    x0,y0,x1,y1=[v*S for v in p['box']]; bw,bh=x1-x0,y1-y0
    bh=bh+(96 if p['box'][1]<=53 else 0); w=min(max(bw*1.7,bh*1.55*4/3,1920),2880); h=w*3/4; w,h=int(w)//2*2,int(h)//2*2
    return w,h,max(0,min(FW-w,int((x0+x1)/2-w/2))),max(0,min(FH-h,int(y1-0.88*h)))
def stats(extra):
    st=[]
    for p in json.load(open(PICK)):
        w,h,x,y=crop(p)
        vf=f"crop={w}:{h}:{x}:{y},scale=320:240,{LIGHT}"+(','+extra if extra else '')
        raw=subprocess.run(['ffmpeg','-v','error','-ss',str((p['start']+p['end'])/2),'-i',SRC,'-frames:v','1','-vf',vf,'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
        a=np.frombuffer(raw,np.uint8).reshape(240,320,3).astype(float)
        st.append(np.r_[a.reshape(-1,3).mean(0),np.percentile(a.mean(2),50)])
    return np.mean(st,0)
m=stats('')
g=math.log(m[3]/255)/math.log(ref['luma_p5_p50_p95'][1]/255)   # eq gamma: out=in^(1/g)
g=min(max(g,0.75),1.4)
ex=f"eq=gamma={g:.3f}"
m2=stats(ex)
r=np.array(ref['all_rgb'])/m2[:3]; r=r/ r.mean() * (ref['luma_p5_p50_p95'][1]/m2[3])
r=np.clip(r,0.88,1.12)
ex+=f",colorchannelmixer=rr={r[0]:.3f}:gg={r[1]:.3f}:bb={r[2]:.3f}"
m3=stats(ex)
print(ex)
print('prima',m.round(1),'dopo',m3.round(1),'rif',ref['all_rgb'],ref['luma_p5_p50_p95'][1],file=sys.stderr)
