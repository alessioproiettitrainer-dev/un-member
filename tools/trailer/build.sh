#!/bin/bash
# Rifà il trailer UN-MEMBER (9:16, 23 s, musica originale + effetti).
# Uso: bash tools/trailer/build.sh  → crea tools/trailer/out/trailer-fx.mp4 e aggiorna public/media/trailer.mp4
# Testi delle scene e del finale: in cards.html (per la versione "Disponibile ora" cambia il finale lì).
set -e
cd "$(dirname "$0")"; ROOT=../..; FF=$ROOT/node_modules/ffmpeg-static/ffmpeg; O=out; mkdir -p $O/clips
# video degli esercizi (dal server, una volta sola)
for u in 6e266a0d9b5c b28399a18467 8f36bf5846cd 6581cb473a97 1161ebeedd57 1dcf92276b90 11095de9ca0a 0dce5b829374 2cfcc4c10f9a; do
  [ -f $O/clips/$u.mp4 ] || curl -sS -o $O/clips/$u.mp4 https://un-member.onrender.com/uploads/$u.mp4; done
cp cards.html $O/ && node cards.mjs "$(cd $O && pwd)" && python3 music.py $O/music.wav
cd $O && rm -f fx-*.mp4 fxlist.txt
scene() { local n=$1 c=$2 ss=$3 card=$4 d=2.0
  $FF -y -loglevel error -ss $ss -t $d -i clips/$c.mp4 -loop 1 -t $d -i card-$card-bg.png -loop 1 -t $d -i card-$card-txt.png -f lavfi -t $d -i "color=white:s=1080x1920:r=30" -filter_complex "\
[0:v]fps=30,scale=1280:960,zoompan=z='if(lt(on,6),1.14-0.0233*on,1+0.05*(on-6)/54)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x810:fps=30,setsar=1,pad=1080:1920:0:555:color=0x0c0c0e[v];\
[v][1:v]overlay=0:0[v1];[2:v]format=rgba,fade=t=in:st=0.08:d=0.22:alpha=1[tx];[v1][tx]overlay=x=0:y='max(0,70*(1-(t-0.08)/0.22))':eval=frame[v2];\
[3:v]format=rgba,fade=t=out:st=0:d=0.14:alpha=1[fl];[v2][fl]overlay=0:0,format=yuv420p[o]" -map "[o]" -an -c:v libx264 -preset medium -crf 21 -r 30 fx-$n.mp4 && echo "file 'fx-$n.mp4'" >> fxlist.txt; }
full() { local n=$1 c=$2 ss=$3 card=$4 d=$5 fin=$6 flash=$7
  $FF -y -loglevel error -ss $ss -t $d -i clips/$c.mp4 -loop 1 -t $d -i card-$card.png -f lavfi -t $d -i "color=white:s=1080x1920:r=30" -filter_complex "\
[0:v]fps=30,scale=-2:1920,crop=1080:1920,zoompan=z='1.02+0.06*on/($d*30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1[v];\
[1:v]format=rgba,fade=t=in:st=$fin:d=0.35:alpha=1[c];[v][c]overlay=0:0[v2];[2:v]format=rgba,fade=t=out:st=0:d=$flash:alpha=1[fl];[v2][fl]overlay=0:0,format=yuv420p[o]" -map "[o]" -an -c:v libx264 -preset medium -crf 21 -r 30 fx-$n.mp4 && echo "file 'fx-$n.mp4'" >> fxlist.txt; }
full 00 6e266a0d9b5c 0.0 intro 3.0 0.5 0.01; scene 01 6e266a0d9b5c 0.4 s0; scene 02 6581cb473a97 1.0 s1; scene 03 1161ebeedd57 1.0 s2
scene 04 8f36bf5846cd 0.5 s3; scene 05 1dcf92276b90 0.5 s4; scene 06 11095de9ca0a 0.5 s5; scene 07 b28399a18467 1.0 s6; scene 08 0dce5b829374 1.0 s7
full 09 2cfcc4c10f9a 0.0 outro 4.0 0.05 0.25
$FF -y -loglevel error -f concat -safe 0 -i fxlist.txt -c copy silent.mp4
$FF -y -loglevel error -i silent.mp4 -i music.wav -filter_complex "[0:v]fade=t=in:st=0:d=0.4[v]" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 21 -c:a aac -b:a 192k -shortest -movflags +faststart trailer-fx.mp4
$FF -y -loglevel error -i trailer-fx.mp4 -vf scale=720:1280 -c:v libx264 -crf 25 -preset medium -c:a aac -b:a 128k -movflags +faststart ../$ROOT/public/media/trailer.mp4
echo "fatto: tools/trailer/out/trailer-fx.mp4"
