"""Mux a walkthrough recording with its voiceover clips.

    python3 build.py <out-dir> <output.mp4> [--webm output.webm] [--poster poster.jpg]

Reads <out-dir>/screen.mkv and <out-dir>/timeline.json (written by record.js), trims
the capture at the magenta sync flash, places each scene's clip LEAD seconds after the
scene starts, loudness-normalises the mix and encodes H.264/AAC (plus VP9/Opus and a
poster frame when asked).
"""
import argparse
import json
import os
import subprocess

LEAD = 0.3  # must match record.js

ap = argparse.ArgumentParser()
ap.add_argument("out_dir")
ap.add_argument("mp4")
ap.add_argument("--webm")
ap.add_argument("--poster")
ap.add_argument("--poster-at", type=float, default=3.0)
args = ap.parse_args()

here = os.path.dirname(os.path.abspath(__file__))
screen = os.path.join(args.out_dir, "screen.mkv")
timeline = json.load(open(os.path.join(args.out_dir, "timeline.json")))
sync = float(subprocess.check_output(["python3", os.path.join(here, "find_sync.py"), screen]).decode())
total = timeline["total"]

clips = [s for s in timeline["scenes"] if s["voiced"]]
inputs, filters, labels = ["-ss", f"{sync:.3f}", "-t", f"{total:.3f}", "-i", screen], [], []
for i, s in enumerate(clips, start=1):
    inputs += ["-i", s["vo"]]
    delay = int(round((s["start"] + LEAD) * 1000))
    filters.append(f"[{i}:a]aresample=48000,adelay={delay}|{delay}[a{i}]")
    labels.append(f"[a{i}]")
filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,"
               f"loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=0:{total:.3f}[aout]")

subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters),
                "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "22",
                "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                "-movflags", "+faststart", args.mp4], check=True)

if args.webm:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", args.mp4, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38",
                    "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-c:a", "libopus", "-b:a", "96k",
                    args.webm], check=True)
if args.poster:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(args.poster_at), "-i", args.mp4, "-frames:v", "1",
                    "-q:v", "3", args.poster], check=True)
print(f"{args.mp4}: {total:.1f}s, {len(clips)}/{len(timeline['scenes'])} scenes voiced")
