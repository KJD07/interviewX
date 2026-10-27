"""Print the time (s) of the first frame after the magenta sync flash in a screen capture."""
import subprocess, sys

src = sys.argv[1]
fps, w, h = 30, 16, 9
raw = subprocess.run(["ffmpeg", "-v", "error", "-t", "8", "-i", src, "-vf", f"fps={fps},scale={w}:{h}",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
n = w * h * 3
seen = False
for i in range(len(raw) // n):
    px = raw[i * n:(i + 1) * n]
    r, g, b = (sum(px[c::3]) / (w * h) for c in range(3))
    magenta = r > 200 and b > 200 and g < 60
    if magenta:
        seen = True
    elif seen:
        print(f"{i / fps:.3f}")
        break
else:
    sys.exit("no sync flash found")
