# mksegs.py out.json fine "t1:Nome" "t2:Nome" ... : segmenti dai tempi in cui dice il nome (azione da t+1.2 al nome dopo)
import json,sys
out,end=sys.argv[1],float(sys.argv[2]); L=[(float(a.split(':',1)[0]),a.split(':',1)[1]) for a in sys.argv[3:]]
segs=[]
for i,(t,n) in enumerate(L):
    hold=n.endswith('!'); n=n.rstrip('!')
    s={'name':n,'t0':t+1.2,'t1':min((L[i+1][0]-0.4) if i+1<len(L) else end,t+1.2+float(__import__('os').environ.get('MAXSEG','13')))}
    if hold: s.update(hold=1,min=5,max=7)
    segs.append(s)
json.dump(segs,open(out,'w'))
