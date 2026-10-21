#!/bin/bash
# Installs the video-editing toolkit (FFmpeg, HyperFrames + skills, yt-dlp, Whisper, Montserrat Black)
# at the start of every cloud session, so video edits always use the same tools.
set -uo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
LOG=/tmp/video-tools-setup.log

# HyperFrames + its skills first and in the foreground, so the skills are listed in this session
command -v hyperframes >/dev/null || npm install -g hyperframes >>"$LOG" 2>&1
hyperframes skills < /dev/null >>"$LOG" 2>&1

# the heavier pieces in the background (check /tmp/video-tools-setup.log)
{
  command -v ffmpeg >/dev/null || (apt-get update -qq && apt-get install -y -qq ffmpeg)
  apt-get install -y -qq libgles2 libegl1 >/dev/null 2>&1 || true   # needed by MediaPipe pose tracking
  pip install -q -U yt-dlp faster-whisper fonttools opencv-python-headless pillow mediapipe 2>&1 | grep -v WARNING
  # GSAP for HyperFrames from npm (cdn.jsdelivr.net may be blocked by the network policy)
  mkdir -p "$HOME/.cache/video-tools"
  if [ ! -f "$HOME/.cache/video-tools/gsap.min.js" ]; then
    (cd /tmp && npm pack -s gsap@3.14.2 && tar xzf gsap-3.14.2.tgz \
      && cp package/dist/gsap.min.js "$HOME/.cache/video-tools/" && rm -rf package gsap-3.14.2.tgz)
  fi
  # Montserrat Black: static instance of the Google Fonts variable font
  if ! fc-list | grep -qi "Montserrat Black"; then
    mkdir -p "$HOME/.fonts"
    curl -sSL -o /tmp/Montserrat.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" \
      && python3 -m fontTools.varLib.instancer /tmp/Montserrat.ttf wght=900 -o "$HOME/.fonts/Montserrat-Black.ttf" --update-name-table \
      && fc-cache -f >/dev/null
  fi
  echo "video tools ready"
} >>"$LOG" 2>&1 &
exit 0
