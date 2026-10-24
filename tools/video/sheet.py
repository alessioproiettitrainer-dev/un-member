# foglio di miniature dai fotogrammi piccoli: sheet.py low.npy out.png t0 t1 passo [colonne]
import sys,numpy as np
from PIL import Image,ImageDraw
a=np.load(sys.argv[1]); t0,t1,st=map(float,sys.argv[3:6]); cols=int(sys.argv[6]) if len(sys.argv)>6 else 12
ts=[t for t in np.arange(t0,t1,st) if int(t*10)<len(a)]
w,h=200,112
S=Image.new('L',(cols*w,((len(ts)+cols-1)//cols)*h))
d=ImageDraw.Draw(S)
for k,t in enumerate(ts):
    im=Image.fromarray(a[int(t*10)]).resize((w,h)); x,y=(k%cols)*w,(k//cols)*h
    S.paste(im,(x,y)); d.rectangle([x,y,x+34,y+12],fill=0); d.text((x+2,y),f'{t:.0f}',fill=255)
S.save(sys.argv[2])
