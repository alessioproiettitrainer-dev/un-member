import numpy as np,json,sys
FPS=10
a=np.load(sys.argv[1]); boxes=json.load(open(sys.argv[2])); segs=json.load(open(sys.argv[3]))
res=[]
for s in segs:
    i0,i1=int(s['t0']*FPS),int(s['t1']*FPS)
    import cv2
    w0,w1=max(70,i0-400),min(len(a)-70,i1+400)
    bgl=np.median(a[w0:w1:4],axis=0).astype(np.int16)
    k5=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)); k9=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))
    bl=[]
    for f in a[i0:i1]:
        m=(np.abs(f.astype(np.int16)-bgl)>28).astype(np.uint8); m[:60]=0
        m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k5); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k9)
        n_,lab,st,cen=cv2.connectedComponentsWithStats(m)
        if n_<2: continue
        q=1+np.argmax(st[1:,4]); x,y,w,h,ar=st[q]
        if ar>80: bl.append([x,y,x+w,y+h])
    bb=np.array(bl)
    x0,y0=np.percentile(bb[:,0],5),np.percentile(bb[:,1],20); x1,y1=np.percentile(bb[:,2],95),np.percentile(bb[:,3],95)
    X0,Y0,X1,Y1=int(max(0,x0-8)),int(max(0,y0-8)),int(min(480,x1+8)),int(min(270,y1+8))
    c=a[i0:i1,Y0:Y1,X0:X1].astype(np.float32)
    c=c[:,::2,::2].reshape(len(c),-1)
    n=len(c)
    D=np.abs(c[:,None,:]-c[None,:,:]).mean(-1) if n<700 else None
    mot=np.r_[0,np.abs(np.diff(c,axis=0)).mean(-1)]
    cm=np.cumsum(mot)
    best=None
    hi=int(min(s.get('max',10),(n-1)/FPS)*FPS); lo=min(int(s.get('min',6.5)*FPS),hi)
    energies=[]
    for i in range(n):
        for L in range(lo,hi+1):
            j=i+L
            if j>=n: break
            energies.append(cm[j]-cm[i])
    emax=max(energies) if energies else 0
    for i in range(n):
        for L in range(lo,hi+1):
            j=i+L
            if j>=n: break
            e=(cm[j]-cm[i])/L
            if not s.get('hold') and (cm[j]-cm[i])<0.55*emax: continue
            # loop seam: endpoint similarity + stillness-free; prefer longer slightly
            sc=(D[i,j]/max(e/(cm[-1]/n),0.2)-0.02*L) if not s.get('hold') else (cm[j]-cm[i])/L-0.01*L
            if best is None or sc<best[0]: best=(sc,i,j)
    _,i,j=best
    # period via autocorrelation of window vs its first frame region
    w=c[i:j+1]; w=w-w.mean(0)
    sig=w@w[0]
    ac=[ (w[:-k]*w[k:]).sum()/ (len(w)-k) for k in range(1,len(w)//2)]
    ac=np.array(ac); 
    # first peak after first dip
    k=len(w)
    if len(ac)>6:
        dips=np.where((ac[1:-1]<ac[:-2])&(ac[1:-1]<ac[2:]))[0]+1
        if len(dips):
            d0=dips[0]; k=int(d0+np.argmax(ac[d0:])+1)
    r=dict(name=s['name'],start=round(s['t0']+i/FPS,2),end=round(s['t0']+j/FPS,2),box=[X0,Y0,X1,Y1],seam=round(float(D[i,j]),2),period=round(k/FPS,2))
    print(r); res.append(r)
json.dump(res,open(sys.argv[4],'w'),indent=1)
