# reframe.py low.npy pick.json: per ogni clip calcola il riquadro 4:3 da tutto il movimento (anche mani/kettlebell sopra la testa)
# sopra: margine sopra il punto più alto; sotto: poco sotto i piedi (il tappetino); centrato sul movimento. Scrive p['crop']=[w,h,x,y] in 4K.
import numpy as np,cv2,json,sys
a=np.load(sys.argv[1]); P=json.load(open(sys.argv[2])); FPS=10; S=8; FW,FH=3840,2160
import statistics
FEET=statistics.median(p['box'][3] for p in P)
k5=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)); k9=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))
for p in P:
    i0,i1=int(p['start']*FPS),int(p['end']*FPS)
    bg=np.median(a[max(0,i0-400):min(len(a),i1+400):4],axis=0).astype(np.int16)
    bx0,by0,bx1,by1=p['box']
    tops=[];bots=[];lefts=[];rights=[]
    for f in a[i0:i1:2]:
        m=(np.abs(f.astype(np.int16)-bg)>26).astype(np.uint8)
        m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k5); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k9)
        n,lab,st,_=cv2.connectedComponentsWithStats(m)
        best=None
        for j in range(1,n):
            x,y,w,h,ar=st[j]
            if ar<40: continue
            if x+w<bx0-10 or x>bx1+10: continue   # deve stare sopra/attorno alla persona
            best=(x,y,x+w,y+h) if best is None else (min(best[0],x),min(best[1],y),max(best[2],x+w),max(best[3],y+h))
        if best: lefts.append(best[0]);tops.append(best[1]);rights.append(best[2]);bots.append(best[3])
    top=np.percentile(tops,4) if tops else by0
    l=min(np.percentile(lefts,5),bx0) if lefts else bx0; r=max(np.percentile(rights,95),bx1) if rights else bx1
    feet=max(by1,FEET-6)  # i piedi: mai sopra la linea dei piedi tipica del video (es. thruster: il box finisce alle mani)
    top=min(top,feet-40)  # almeno una persona alta 40px (~1/7 del frame)
    H=(feet-top)*S; top4=top*S-0.16*H; bot4=feet*S+0.03*H     # 16% sopra; sotto solo 3%: il bordo basso del movimento è già il tappetino (ombre comprese)
    h=bot4-top4; w=max(h*4/3,(r-l)*S*1.25); h=w*3/4
    h=max(h,1400); w=h*4/3   # mai troppo zoomato
    if h>FH: h=FH; w=FH*4/3
    cx=(l+r)/2*S
    if bot4-h<0:  # sopra non c'è più immagine: invece di aggiungere spazio sotto, stringo il riquadro (min 1080 = 1:1 col video finale)
        h=max(bot4,1080,(r-l)*S*1.25*3/4); w=h*4/3
    y=max(0,min(bot4-h,FH-h))
    x=min(max(cx-w/2,0),FW-w)
    # se c'è ancora spazio sopra la testa oltre il margine, lascio l'extra sopra (non sotto): già garantito da y=bot4-h
    p['crop']=[int(w)//2*2,int(h)//2*2,int(x),int(max(0,y))]
    print(p['name'],'top',round(top),'feet',feet,'crop',p['crop'])
json.dump(P,open(sys.argv[2],'w'))
