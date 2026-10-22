# Mette in risalto la persona: la schiarisce e scurisce lo sfondo (maschera MediaPipe, bordo sfumato).
# Uso: python rilievo.py ingresso.mp4 uscita.mp4 modello.task [luce_persona=1.15] [luce_sfondo=0.72]
import subprocess, sys, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
src, out, model = sys.argv[1:4]
kp = float(sys.argv[4]) if len(sys.argv) > 4 else 1.12
kb = float(sys.argv[5]) if len(sys.argv) > 5 else 0.78
lm = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=mpp.BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO,
    output_segmentation_masks=True, min_pose_detection_confidence=0.4, min_tracking_confidence=0.4))
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', str(fps),
                       '-i', '-', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
prev, i = None, 0
while True:
    ok, fr = cap.read()
    if not ok: break
    r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)), int(i * 1000 / fps))
    m = r.segmentation_masks[0].numpy_view().squeeze().astype(np.float32) if r.segmentation_masks else np.zeros((h, w), np.float32)
    m = cv2.resize(m, (w, h))
    m = cv2.GaussianBlur(np.clip((m - 0.45) / 0.4, 0, 1), (0, 0), 2.5)
    prev = m if prev is None else 0.6 * m + 0.4 * prev  # niente sfarfallio
    g = (prev * kp + (1 - prev) * kb)[:, :, None]
    ff.stdin.write(np.clip(fr.astype(np.float32) * g, 0, 255).astype(np.uint8).tobytes())
    i += 1
ff.stdin.close(); ff.wait()
