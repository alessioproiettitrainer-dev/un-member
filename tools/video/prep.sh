#!/bin/bash
# prep.sh <drive_id> <nome>: scarica il video da Drive (condiviso col link), estrae audio, trascrive i nomi e prepara i fotogrammi piccoli
set -e
ID=$1; N=$2; D=/home/user/vids/s2; T=/home/user/un-member/tools/video
cd $D
[ -s $N.mp4 ] || curl -sSL -o $N.mp4 "https://drive.usercontent.google.com/download?id=$ID&export=download&confirm=t"
ffmpeg -v error -y -i $N.mp4 -vn -ac 1 -ar 16000 $N.wav
python3 $T/transcribe.py $N.wav medium 2>/dev/null | grep -v Warn > $N.words.txt
python3 $T/scan.py $N.mp4 $N.low.npy 10 > /dev/null
python3 $T/fg.py $N.low.npy $N.bg.npy $N.fg.npy > /dev/null 2>&1 || true
ffprobe -v error -show_entries format=duration -of csv=p=0 $N.mp4 > $N.dur
echo "$N pronto"
