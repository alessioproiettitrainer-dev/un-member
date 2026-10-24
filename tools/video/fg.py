import numpy as np,sys
a=np.load(sys.argv[1])
bg=np.median(a[::5],axis=0).astype(np.int16)
np.save(sys.argv[2],bg)
fg=(np.abs(a.astype(np.int16)-bg)>28)
# light morphology-free cleanup: count per column/row
np.save(sys.argv[3],np.packbits(fg,axis=-1))
print(fg.mean())
