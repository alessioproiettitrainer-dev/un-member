# decode low-res gray frames of a video to npy (W=480,H=270, fps param)
import sys,subprocess,numpy as np
src,out,fps=sys.argv[1],sys.argv[2],float(sys.argv[3])
W,H=480,270
p=subprocess.run(['ffmpeg','-v','error','-i',src,'-vf',f'fps={fps},scale={W}:{H},format=gray','-f','rawvideo','-'],capture_output=True)
a=np.frombuffer(p.stdout,np.uint8).reshape(-1,H,W)
np.save(out,a); print(a.shape)
