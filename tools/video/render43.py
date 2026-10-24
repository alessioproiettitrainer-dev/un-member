# clip 4:3 (1440x1080) per il riquadro del player, inquadratura larga stile KBMH
import json,subprocess,sys,os
SRC,PICK,OUT=sys.argv[1],sys.argv[2],sys.argv[3]
FW,FH,S=3840,2160,8
LIGHT="curves=all='0/0 0.15/0.24 0.4/0.56 0.75/0.87 1/1',eq=saturation=0.97"
ENC=['-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-r','30','-an','-movflags','+faststart']
os.makedirs(OUT,exist_ok=True)
only=set(sys.argv[4:])
for p in json.load(open(PICK)):
    if only and p['name'] not in only: continue
    x0,y0,x1,y1=[v*S for v in p['box']]
    bw,bh=x1-x0,y1-y0
    w=min(max(bw*1.7,bh*2.2*4/3,1920),2880); h=w*3/4
    w,h=int(w)//2*2,int(h)//2*2
    x=max(0,min(FW-w,int((x0+x1)/2-w/2)))
    y=max(0,min(FH-h,int(y1-0.88*h)))
    vf=f"crop={w}:{h}:{x}:{y},scale=1440:1080:flags=lanczos,{LIGHT}"
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(p['start']),'-t',f"{p['end']-p['start']:.2f}",'-i',SRC,'-vf',vf]+ENC+[f"{OUT}/{p['name']}.mp4"],check=True)
    print(p['name'],w,h,x,y,flush=True)
