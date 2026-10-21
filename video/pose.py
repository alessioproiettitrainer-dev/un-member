# Posizioni del corpo fotogramma per fotogramma (MediaPipe Pose). Uso: python pose.py video.mp4 out.json modello.task
import sys, json, cv2, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
src, out, model = sys.argv[1], sys.argv[2], sys.argv[3]
opt = vision.PoseLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=model),
                                   running_mode=vision.RunningMode.VIDEO, num_poses=1,
                                   min_pose_detection_confidence=0.4, min_tracking_confidence=0.4)
lm = vision.PoseLandmarker.create_from_options(opt)
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); res = []; i = 0
while True:
    ok, fr = cap.read()
    if not ok: break
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    r = lm.detect_for_video(img, int(i * 1000 / fps))
    res.append([[round(p.x, 4), round(p.y, 4), round(p.visibility, 2)] for p in r.pose_landmarks[0]] if r.pose_landmarks else None)
    i += 1
json.dump({'fps': fps, 'frames': res}, open(out, 'w'))
print(src, len(res), sum(r is not None for r in res))
