#!/bin/bash
# clipsheet.sh <cartella clip> <out.jpg>: una miniatura (a metà) per clip con il nome
D=$1; O=$2; T=$(mktemp -d)
i=0; for f in "$D"/*.mp4; do n=$(basename "$f" .mp4); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); ffmpeg -v error -y -ss $(echo "$d/2" | bc -l) -i "$f" -frames:v 1 -vf "scale=320:240,drawtext=text='${n//\'/}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6" $T/$(printf %03d $i).png; i=$((i+1)); done
ffmpeg -v error -y -pattern_type glob -i "$T/*.png" -vf tile=6x$(( (i+5)/6 )) -q:v 3 "$O"
