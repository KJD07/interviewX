#!/usr/bin/env bash
# Tighten the raw ElevenLabs clips for a brisk read: trim leading/trailing silence,
# shrink every pause longer than 0.12s down to ~0.1s, then speed up by TEMPO
# (pitch preserved).
#
#   ./tighten.sh vo vo_tight        # TEMPO=1.10 by default
set -euo pipefail
src=${1:-vo}
out=${2:-vo_tight}
tempo=${TEMPO:-1.10}
mkdir -p "$out"
for f in "$src"/*.mp3; do
  name=$(basename "$f")
  ffmpeg -y -v error -i "$f" -af "silenceremove=start_periods=1:start_threshold=-35dB:start_silence=0.03:\
stop_periods=-1:stop_duration=0.12:stop_threshold=-35dB:stop_silence=0.1:detection=peak,atempo=${tempo}" \
    -ar 44100 -b:a 192k "$out/$name"
  printf '%s  %.2fs -> %.2fs\n' "$name" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$name")"
done
