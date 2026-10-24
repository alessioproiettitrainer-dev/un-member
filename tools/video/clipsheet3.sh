#!/bin/bash
# clipsheet3.sh <cartella> <out.jpg>: 3 fotogrammi per clip (inizio, metà, fine), una riga per clip
D=$1; O=$2; T=$(mktemp -d); i=0
for f in "$D"/*.mp4; do n=$(basename "$f" .mp4); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  for k in 0 1 2; do ffmpeg -v error -y -ss $(printf "%.2f" $(echo "$d*(0.15+0.35*$k)" | bc -l)) -i "$f" -frames:v 1 -vf "scale=240:180" $T/f$k.png; done
  ffmpeg -v error -y -i $T/f0.png -i $T/f1.png -i $T/f2.png -filter_complex "hstack=3,drawtext=text='${n//\'/}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6" $T/r$(printf %03d $i).png; i=$((i+1)); done
ffmpeg -v error -y -pattern_type glob -i "$T/r*.png" -vf tile=2x$(( (i+1)/2 )) -q:v 3 "$O"
