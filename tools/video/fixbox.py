# fixbox.py pick.json: corregge i riquadri strani (piedi fermi assorbiti dallo sfondo, rumore ai lati) usando le mediane del video
import json,sys,statistics as st
f=sys.argv[1]; p=json.load(open(f))
y1=st.median(x['box'][3] for x in p); cx=st.median((x['box'][0]+x['box'][2])/2 for x in p); w=st.median(x['box'][2]-x['box'][0] for x in p)
for x in p:
    b=x['box']
    if b[3]<y1-8: b[3]=int(y1)
    if b[2]-b[0]>1.8*w:
        c=(b[0]+b[2])/2 if abs((b[0]+b[2])/2-cx)<w else cx
        b[0],b[2]=int(c-w*0.75),int(c+w*0.75); print('larghezza corretta',x['name'])
json.dump(p,open(f,'w'))
