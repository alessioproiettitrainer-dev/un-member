import numpy as np,cv2,sys,json
a=np.load(sys.argv[1]); bg=np.load(sys.argv[2]).astype(np.int16)
H,W=bg.shape; out=[]
k5=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)); k9=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))
for f in a:
    m=(np.abs(f.astype(np.int16)-bg)>28).astype(np.uint8)
    m[:int(sys.argv[4]) if len(sys.argv)>4 else 60]=0
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k5); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k9)
    n,lab,st,cen=cv2.connectedComponentsWithStats(m)
    if n<2: out.append(None); continue
    i=1+np.argmax(st[1:,4]); x,y,w,h,ar=st[i]
    if ar<80: out.append(None); continue
    # merge nearby big comps
    X0,Y0,X1,Y1=x,y,x+w,y+h
    for j in range(1,n):
        if j==i or st[j,4]<60: continue
        xj,yj,wj,hj,_=st[j]
        if xj<X1+15 and xj+wj>X0-15 and yj<Y1+15 and yj+hj>Y0-15:
            X0,Y0,X1,Y1=min(X0,xj),min(Y0,yj),max(X1,xj+wj),max(Y1,yj+hj)
    out.append([int(X0),int(Y0),int(X1),int(Y1),int(ar)])
json.dump(out,open(sys.argv[3],'w')); print(len(out))
