# LUT "UN Workout Look" per video normali (Rec709, non Log): stesso look della LUT Log.
import sys, numpy as np
out = sys.argv[1]; N = 33
g = np.linspace(0, 1, N)
b, gg, r = np.meshgrid(g, g, g, indexing='ij')
x = np.stack([r, gg, b], -1).reshape(-1, 3)
Y = np.array([0.2126, 0.7152, 0.0722])
# cieli e blu più spenti (tendono al grigio-verde)
L = (x @ Y)[:, None]
blu = np.clip((x[:, 2:3] - np.maximum(x[:, 0:1], x[:, 1:2])) * 4, 0, 1)
x = L + (x - L) * (1 - 0.35 * blu)
# curva: più scuro, alte luci morbide, neri sollevati
xs = [0.0, 0.10, 0.25, 0.45, 0.60, 0.75, 0.88, 1.0]
ys = [0.03, 0.065, 0.17, 0.32, 0.43, 0.54, 0.635, 0.72]
y = np.interp(x, xs, ys)
# viraggio caldo come la LUT Log
L = (y @ Y)[:, None]; w = np.clip(L / 0.7, 0, 1)
gain = np.array([1.07, 1.00, 0.78]) * (1 - w) + np.array([1.02, 1.00, 0.93]) * w
y2 = y * gain; y2 = y2 * (L / np.maximum((y2 @ Y)[:, None], 1e-4))
L = (y2 @ Y)[:, None]; y2 = L + (y2 - L) * 0.85
y2 = np.clip(y2, 0, 1)
with open(out, 'w') as f:
    f.write('TITLE "UN Workout Look - Rec709"\nLUT_3D_SIZE 33\n')
    for v in y2: f.write('%.6f %.6f %.6f\n' % tuple(v))
