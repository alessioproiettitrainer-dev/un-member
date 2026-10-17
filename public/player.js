import { buildSteps, embedUrl, fmt, itemPace } from './engine.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let P = null; // stato del player

const ac = () => (window._ac ||= new (window.AudioContext || window.webkitAudioContext)());
function beep(freq = 880, ms = 150, vol = 0.25) {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
    o.start(); o.stop(a.currentTime + ms / 1000);
  } catch {}
}
// Voce: sceglie la voce italiana più naturale del telefono e legge il testo come lo direbbe un coach
// (sigle pronunciate come parole, "rip" → ripetizioni, "3/10" → 3 di 10…).
let VOICE = null;
function pickVoice() {
  const rank = (v) => (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  VOICE = (window.speechSynthesis?.getVoices() || []).filter((v) => /^it/i.test(v.lang)).sort((a, b) => rank(b) - rank(a))[0] || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function spoken(text) {
  return String(text).toLowerCase()
    .replace(/\bemom\b/g, 'èmom').replace(/\bamrap\b/g, 'àmrap').replace(/\bafap\b/g, 'àfap')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 di $2').replace(/(\d+)\s*-\s*(\d+)/g, 'da $1 a $2').replace(/\+\s*(\d+)/g, 'più $1').replace(/\s\/\s/g, ', ')
    .replace(/(\d+)\s*s\b/g, '$1 secondi').replace(/(\d+)\s*min\b/g, '$1 minuti').replace(/\brip\b/g, 'ripetizioni')
    .replace(/\b1 (minuti|secondi|ripetizioni)\b/g, (m, w) => `1 ${{ minuti: 'minuto', secondi: 'secondo', ripetizioni: 'ripetizione' }[w]}`)
    .replace(/→/g, ' a ').replace(/\s*[·|]\s*/g, ', ').replace(/\s*&\s*/g, ' e ').replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
}
function say(text) {
  if (!P?.voice || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(spoken(text));
  if (VOICE) u.voice = VOICE;
  u.lang = 'it-IT'; u.rate = 1; u.pitch = 1;
  speechSynthesis.speak(u);
}

export function stopPlayer() {
  if (!P) return;
  P.root.removeEventListener('click', onClick);
  clearInterval(P.timer);
  P.wake?.release?.().catch(() => {});
  window.speechSynthesis?.cancel?.();
  P = null;
}

// opts: { onExit(), onFinish(result) }
export async function startPlayer(root, program, workout, opts) {
  stopPlayer();
  const steps = buildSteps(workout);
  P = {
    root, p: program, w: workout, steps, opts, idx: 0, running: true, endAt: 0, swStart: 0, swAcc: 0, remaining: 0,
    started: Date.now(), ladderStart: {}, focus: 0, lastBeep: null, amrap: {}, fortime: {}, scores: {}, awaiting: false, g: null, lastTick: performance.now(),
    subs: store.get('subs', {}), voice: store.get('voice', true), full: store.get('fullVideo', false),
  };
  try { P.wake = await navigator.wakeLock?.request('screen'); } catch {}
  root.addEventListener('click', onClick);
  enterStep(0);
  P.timer = setInterval(tick, 100);
}

function exOf(id) {
  const chosen = P.subs[id] || id;
  return P.p.exercises[chosen] || P.p.exercises[id] || { name: 'Esercizio', id };
}
const paceOf = (it) => itemPace(it, exOf(it.exerciseId));
const guided = (s) => s.amrap || s.kind === 'stopwatch' || s.emom;

function enterStep(i) {
  if (i >= P.steps.length) return finish();
  P.idx = Math.max(0, i);
  const s = P.steps[P.idx];
  P.focus = 0; P.lastBeep = null; P.lastTick = performance.now();
  if (s.kind === 'timed') { P.remaining = s.dur; P.endAt = performance.now() + s.dur * 1000; }
  if (s.kind === 'stopwatch') { P.swAcc = 0; P.swStart = performance.now(); }
  P.g = guided(s) ? { i: 0, round: 0, t: 0, rep: 0, finished: false, rounds: Number(s.counter) || 0 } : null;
  if (s.ladder && s.firstRung && !P.ladderStart[s.blockKey]) P.ladderStart[s.blockKey] = Date.now();
  render();
  if (s.video) return say(`Ora un video: ${s.block}.`);
  const e = exOf(s.items[0].exerciseId), first = `${s.items[0].reps || ''} ${e.name}`;
  if (s.ready) say(`Preparati! ${s.block}. ${s.summary || ''}. Si parte con ${first}.`);
  else if (s.rest) say(`${pick(['Recupera.', 'Bene, recupero.', 'Ottimo, respira.'])} Poi: ${first}.`);
  else if (P.g) say(`${s.label}. ${pick(['Via!', 'Vai!', 'Forza!'])} ${first}.`);
  else if (s.items.length > 1) say(`${s.label}. ${s.items.map((it) => `${it.reps || ''} ${exOf(it.exerciseId).name}`).join(', ')}.`);
  else say(`${first}.`);
}

// Passa all'esercizio successivo del giro; a fine giro conta il round.
function advanceGuide() {
  const s = P.steps[P.idx], g = P.g;
  g.i++; g.t = 0; g.rep = 0;
  // EMOM: finiti gli esercizi del minuto, il tempo che resta è recupero
  if (s.emom && g.i >= s.items.length) { g.i = s.items.length - 1; g.finished = true; beep(990, 120); say(pick(['Fatto! Recupera fino al prossimo minuto.', 'Bravo, ora recupero.'])); return render(); }
  if (g.i >= s.items.length) {
    g.i = 0; g.round++;
    if (s.amrap) P.amrap[s.block] = g.round;
    beep(990, 120);
    if (s.kind === 'stopwatch' && g.rounds && g.round >= g.rounds) { g.finished = true; say('Ultimo round finito! Premi fine per salvare il tempo.'); return render(); }
  }
  P.focus = g.i;
  render();
  const it = s.items[g.i];
  say(`${it.reps || ''} ${exOf(it.exerciseId).name}.`);
}

function tick() {
  if (!P || P.awaiting) return; // in attesa del risultato: tutto fermo
  const s = P.steps[P.idx];
  const now = performance.now(), dt = (now - P.lastTick) / 1000;
  P.lastTick = now;
  if (s.kind === 'timed') {
    if (P.running) P.remaining = Math.max(0, (P.endAt - now) / 1000);
    const whole = Math.ceil(P.remaining);
    if (P.running && whole <= 3 && whole >= 1 && P.lastBeep !== whole) { P.lastBeep = whole; beep(660, 120); }
    if (P.running && P.remaining <= 0) {
      beep(1046, 400);
      if (s.amrap) return askScore(s, 'amrap', amrapCounts(s));
      return enterStep(P.idx + 1);
    }
  } else if (s.kind === 'stopwatch' && s.cap && elapsed() >= s.cap) {
    beep(1046, 400);
    freezeStopwatch();
    return askScore(s, 'fortime', { seconds: s.cap, capped: true });
  }
  if (P.g && P.running && !P.g.finished) {
    const pace = paceOf(s.items[P.g.i]);
    P.g.t += dt;
    if (P.g.t >= pace.dur) return advanceGuide();
    const rep = pace.reps ? Math.min(pace.reps, Math.floor(P.g.t / pace.spr) + 1) : 0;
    if (rep !== P.g.rep) { P.g.rep = rep; if (rep > 1) beep(1400, 35, 0.08); updateRep(pace); }
  }
  updateClock();
}

// Stima dal giro guidato: round completi + ripetizioni del giro in corso
function amrapCounts(s) {
  const g = P.g;
  if (!g) return { rounds: 0, reps: 0 };
  const reps = s.items.slice(0, g.i).reduce((a, it) => a + paceOf(it).reps, 0) + Math.max(0, g.rep - 1);
  return { rounds: g.round, reps };
}
const scoreText = (sc) => (sc.type === 'amrap' ? `${sc.rounds} round${sc.reps ? ` + ${sc.reps} rip` : ''}` : sc.capped ? `Time cap (${fmt(sc.seconds)})` : fmt(sc.seconds));
function freezeStopwatch() {
  if (P.running) { P.swAcc += (performance.now() - P.swStart) / 1000; P.running = false; }
}

// Schermata "il tuo risultato": parte dalla stima dell'app, il membro corregge e salva.
function askScore(s, type, pre) {
  P.awaiting = true;
  const m = document.createElement('div');
  m.className = 'tutmodal scoremodal';
  const stepper = (name, label, val) => `<div class="stepper"><span class="lbl">${label}</span><div class="row"><button data-act="sc-dec" data-f="${name}">−</button><input type="number" min="0" inputmode="numeric" name="${name}" value="${val}"><button data-act="sc-inc" data-f="${name}">+</button></div></div>`;
  const mm = Math.floor(pre.seconds / 60) || 0, ss = Math.round(pre.seconds % 60) || 0;
  m.innerHTML = `<div class="sc-box"><div class="lab">${esc(s.block)}</div>
    <div class="h1" style="font-size:30px">${type === 'amrap' ? 'AMRAP finito!' : pre.capped ? 'Tempo scaduto!' : 'Finito!'}</div>
    <div class="muted" style="margin-bottom:18px">${type === 'amrap' ? 'Quanti giri hai fatto? Ho stimato io dal ritmo: correggi se serve.' : pre.capped ? 'Hai raggiunto il time cap. Il risultato viene salvato come time cap.' : 'Il tuo tempo: correggi se serve.'}</div>
    ${type === 'amrap' ? stepper('rounds', 'Round completi', pre.rounds) + stepper('reps', 'Ripetizioni in più', pre.reps)
      : pre.capped ? '' : `<div class="stepper"><span class="lbl">Tempo</span><div class="row"><input type="number" min="0" name="mm" value="${mm}"><b>:</b><input type="number" min="0" max="59" name="ss" value="${String(ss).padStart(2, '0')}"></div></div>`}
    <button class="btn primary block" data-act="sc-save" style="margin-top:18px">Salva risultato</button></div>`;
  m.dataset.type = type;
  m.dataset.capped = pre.capped ? '1' : '';
  m.dataset.cap = pre.seconds || 0;
  P.root.querySelector('.player').append(m);
  say(type === 'amrap' ? 'Tempo! Quanti giri hai fatto?' : 'Finito! Controlla il tuo tempo.');
}
function saveScore(m) {
  const s = P.steps[P.idx], v = (n) => Math.max(0, Number(m.querySelector(`[name=${n}]`)?.value) || 0);
  const sc = m.dataset.type === 'amrap'
    ? { key: s.blockKey, block: s.block, type: 'amrap', rounds: v('rounds'), reps: v('reps') }
    : { key: s.blockKey, block: s.block, type: 'fortime', seconds: m.dataset.capped ? Number(m.dataset.cap) : v('mm') * 60 + Math.min(59, v('ss')), capped: !!m.dataset.capped };
  P.scores[s.blockKey] = sc;
  (sc.type === 'amrap' ? P.amrap : P.fortime)[s.block] = scoreText(sc);
  m.remove();
  P.awaiting = false;
  P.running = true;
  enterStep(P.idx + 1);
}

const elapsed = () => P.swAcc + (P.running ? (performance.now() - P.swStart) / 1000 : 0);

function togglePause() {
  const s = P.steps[P.idx];
  P.running = !P.running;
  P.lastTick = performance.now();
  if (s.kind === 'timed' && P.running) P.endAt = performance.now() + P.remaining * 1000;
  if (s.kind === 'stopwatch') { if (P.running) P.swStart = performance.now(); else P.swAcc += (performance.now() - P.swStart) / 1000; }
  const v = P.root.querySelector('.video video');
  if (v) P.running ? v.play().catch(() => {}) : v.pause();
  renderControls();
}

function clockText() {
  const s = P.steps[P.idx];
  if (s.kind === 'timed') return fmt(Math.ceil(P.remaining));
  if (s.kind === 'stopwatch') return fmt(elapsed());
  return '—';
}

function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  el.textContent = clockText();
  const s = P.steps[P.idx];
  const cur = P.root.querySelector('.bar i.cur');
  if (cur && s.kind === 'timed') cur.style.setProperty('--p', `${(1 - P.remaining / s.dur) * 100}%`);
  const gb = P.root.querySelector('.gbar i');
  if (gb && P.g) gb.style.width = `${Math.min(100, (P.g.t / paceOf(s.items[P.g.i]).dur) * 100)}%`;
}

function updateRep(pace) {
  const el = document.getElementById('rep');
  if (!el) return;
  el.textContent = pace.reps ? P.g.rep : fmt(Math.ceil(pace.dur - P.g.t));
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

// Scala di progressione: dall'esercizio del programma si scende per le versioni più facili
// e si sale per quelle più difficili (fino a 3 livelli per lato).
function ladder(baseId) {
  const ex = P.p.exercises, out = [baseId], seen = new Set([baseId]);
  for (let id = ex[baseId]?.easierId, n = 0; id && ex[id] && !seen.has(id) && n < 3; id = ex[id].easierId, n++) { out.unshift(id); seen.add(id); }
  for (let id = ex[baseId]?.harderId, n = 0; id && ex[id] && !seen.has(id) && n < 3; id = ex[id].harderId, n++) { out.push(id); seen.add(id); }
  return out;
}
function variantButtons(item) {
  const base = P.p.exercises[item.exerciseId];
  if (!base) return '';
  const steps = ladder(base.id);
  if (steps.length < 2) return '';
  const cur = P.subs[item.exerciseId] || item.exerciseId;
  const i = Math.max(0, steps.indexOf(cur)), bi = steps.indexOf(base.id);
  const label = i === bi ? 'Standard' : i < bi ? `Più facile${bi - i > 1 ? ` ·${bi - i}` : ''}` : `Più difficile${i - bi > 1 ? ` ·${i - bi}` : ''}`;
  return `<div class="subs">
    <button ${i > 0 ? `data-sub="${steps[i - 1]}"` : 'disabled'}>↓ Più facile</button>
    <span class="lvl"><b>${esc(label)}</b><span class="dots2">${steps.map((s, k) => `<i class="${k === i ? 'on' : ''} ${k === bi ? 'std' : ''}"></i>`).join('')}</span></span>
    <button ${i < steps.length - 1 ? `data-sub="${steps[i + 1]}"` : 'disabled'}>↑ Più difficile</button></div>`;
}

function videoEl(e) {
  if (e.video) return `<video src="${esc(e.video)}" autoplay muted loop playsinline preload="auto"></video>`;
  const emb = embedUrl(e.videoUrl, { loop: true });
  if (emb) return `<iframe src="${esc(emb)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(e.name)}"></iframe>`;
  return `<div class="novid">${esc(e.name)}<br><span class="muted">video demo non caricato</span></div>`;
}
const nextLabel = (n) => (n.video ? `▶ Video · ${n.block}` : `${n.items[0].reps || ''} ${exOf(n.items[0].exerciseId).name}`);

// Blocco video lungo (YouTube / Drive / Vimeo): si guarda e si segue, poi "Fatto".
function renderVideo(s) {
  const emb = embedUrl(s.video);
  const next = P.steps[P.idx + 1];
  P.root.innerHTML = `<div class="player">
    <div class="p-top">
      <button class="icon" data-act="close" aria-label="Chiudi">✕</button>
      <div class="ttl"><small>${esc(s.phase)}</small>${esc(s.block)}</div>
      <span class="icon" style="visibility:hidden"></span>
    </div>
    <div class="p-scroll">
      <div class="now"><div class="lab">Video${s.minutes ? ` · circa ${s.minutes} min` : ''}</div>${s.notes ? `<div class="note">${esc(s.notes)}</div>` : ''}</div>
      ${emb ? `<div class="video wide"><iframe src="${esc(emb)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(s.block)}"></iframe></div>`
        : `<div class="now" style="margin-top:12px">Questo link non si può mostrare dentro l'app.</div>`}
      <a class="btn block" style="margin-top:12px" href="${esc(s.video)}" target="_blank" rel="noopener">Apri il video a schermo intero ↗</a>
      ${next ? `<div class="next"><div class="ph"></div><div><div class="k">DOPO${next.ready ? ` · ${esc(next.block)}` : ''}</div><div class="v">${esc(nextLabel(next))}</div></div></div>` : ''}
    </div>
    <div class="p-ctrl">${controls()}</div>
  </div>`;
}

function controls() {
  const s = P.steps[P.idx];
  const pause = (wide) => `<button class="btn ${wide ? 'primary' : 'sq'}" data-act="pause" aria-label="Pausa">${P.running ? (wide ? '❚❚ Pausa' : '❚❚') : wide ? '▶ Riprendi' : '▶'}</button>`;
  if (s.kind === 'manual') return `<button class="btn sq" data-act="prev">⏮</button><button class="btn primary" data-act="next">✓ Fatto</button><button class="btn sq" data-act="next">⏭</button>`;
  if (s.kind === 'stopwatch') return `<button class="btn sq" data-act="prev">⏮</button>${pause(false)}${P.g && !P.g.finished ? '<button class="btn" data-act="gnext">Fatto ›</button>' : ''}<button class="btn primary" data-act="done">✓ Fine</button>`;
  if (P.g) return `<button class="btn sq" data-act="prev">⏮</button>${pause(!!P.g.finished)}${P.g.finished ? '' : '<button class="btn primary" data-act="gnext">Fatto ›</button>'}<button class="btn sq" data-act="next">⏭</button>`;
  return `<button class="btn sq" data-act="prev">⏮</button>${pause(true)}<button class="btn sq" data-act="next">⏭</button>`;
}
function renderControls() {
  const c = P.root.querySelector('.p-ctrl');
  if (c) c.innerHTML = controls();
}

function render() {
  const s = P.steps[P.idx];
  if (s.video) return renderVideo(s);
  const items = s.items;
  const g = P.g;
  const focusItem = items[Math.min(g ? g.i : P.focus, items.length - 1)];
  const fe = exOf(focusItem.exerciseId);
  const bs = P.steps.filter((x) => x.blockKey === s.blockKey && !x.ready && !x.rest);
  const pos = bs.indexOf(s);
  const next = P.steps.slice(P.idx + 1).find((x) => !x.rest || x.ready);
  const nextE = next && !next.video && exOf(next.items[0].exerciseId);
  const mode = s.ready ? 'ready' : s.rest ? 'rest' : '';

  let right;
  if (s.amrap) right = `<div class="tile"><div class="big">${g ? g.round : P.amrap[s.block] || 0}</div><div class="lbl">Round fatti</div></div>`;
  else if (s.kind === 'stopwatch') right = `<div class="tile"><div class="big">${g ? `${Math.min(g.round + 1, g.rounds || g.round + 1)}/${esc(s.counter)}` : esc(s.counter)}</div><div class="lbl">Round</div></div>`;
  else if (s.ready) right = `<div class="tile"><div class="big" style="font-size:22px;padding:8px 0">${esc(s.summary || '')}</div><div class="lbl">${esc(s.block)}</div></div>`;
  else right = `<div class="tile"><div class="big">${esc(s.counter || '')}</div><div class="lbl">${esc(s.counterLabel || '')}</div></div>`;

  let now;
  if (g) {
    const pace = paceOf(focusItem);
    now = g.finished && s.emom
      ? `<div class="lab rest-lab">${esc(s.label)} · recupero</div><div class="reps">Recupero</div><div class="note">Riparti al prossimo minuto: tieni d'occhio il timer.</div>
         <div class="circuit">${items.map((it) => `<button class="past"><b>${esc(it.reps || '')}</b><span>${esc(exOf(it.exerciseId).name)} ✓</span></button>`).join('')}</div>`
      : g.finished
      ? `<div class="lab">${esc(s.label)}</div><div class="reps">Round finiti!</div><div class="note">Premi FINE per salvare il tuo tempo.</div>`
      : `<div class="lab">${esc(s.label)}${s.emom ? (items.length > 1 ? ` · ${g.i + 1} di ${items.length}` : '') : ` · giro ${g.round + 1}`}</div>
         <div class="repline"><span class="repnow" id="rep">${pace.reps ? g.rep || 1 : fmt(Math.ceil(pace.dur - g.t))}</span>${pace.reps ? `<span class="reptot">/ ${pace.reps} rip</span>` : '<span class="reptot">tempo</span>'}</div>
         <div class="name">${esc(fe.name)}</div>
         <div class="gbar"><i></i></div>
         <div class="circuit">${items.map((it, k) => `<button data-focus="${k}" class="${k === g.i ? 'sel' : k < g.i ? 'past' : ''}"><b>${esc(it.reps || (it.time ? it.time + 's' : ''))}</b><span>${esc(exOf(it.exerciseId).name)}</span></button>`).join('')}</div>`;
  } else if (items.length > 1) {
    now = `<div class="lab">${esc(s.ready ? 'Preparati · si parte con' : s.label)}</div><div class="circuit">${items.map((it, k) => `<button data-focus="${k}" class="${k === P.focus ? 'sel' : ''}"><b>${esc(it.reps || (it.time ? it.time + 's' : ''))}</b><span>${esc(exOf(it.exerciseId).name)}</span></button>`).join('')}</div>`;
  } else {
    now = `<div class="lab">${esc(s.ready ? 'Preparati · si parte con' : s.rest ? 'Recupero · prossimo' : s.label)}</div><div class="reps">${esc(focusItem.reps || (s.kind === 'timed' && !s.rest ? fmt(s.dur) : ''))}</div><div class="name">${esc(fe.name)}</div>`;
  }

  P.root.innerHTML = `<div class="player ${P.full ? 'full' : ''}">
    ${P.full ? `<div class="bgvid">${videoEl(fe)}</div>` : ''}
    <div class="p-top">
      <button class="icon" data-act="close" aria-label="Chiudi">✕</button>
      <div class="ttl"><small>${esc(s.phase)}</small>${esc(s.block)}</div>
      <button class="icon" data-act="full" aria-label="${P.full ? 'Riduci il video' : 'Video a tutto schermo'}">${P.full ? '⤡' : '⤢'}</button>
      <button class="icon ${P.voice ? 'on' : ''}" data-act="voice" aria-label="Voce">${P.voice ? '🔊' : '🔈'}</button>
    </div>
    <div class="p-scroll">
      <div class="tiles">
        <div class="tile ${mode}"><div class="big" id="clock">${clockText()}</div><div class="lbl">${s.kind === 'stopwatch' ? (s.cap ? `Tempo · cap ${fmt(s.cap)}` : 'Tempo') : s.kind === 'manual' ? 'Al tuo ritmo' : 'Secondi rimasti'}</div></div>
        ${right}
      </div>
      ${!s.ready && bs.length > 1 ? `<div class="bar">${bs.map((x, k) => `<i class="${k < pos ? 'done' : k === pos ? 'cur' : ''}"></i>`).join('')}</div>` : '<div style="height:12px"></div>'}
      <div class="now ${s.rest ? 'rest' : ''}">
        ${now}
        ${!g?.finished && (focusItem.notes || fe.cues) ? `<div class="note">${esc(focusItem.notes || fe.cues)}</div>` : ''}
        ${s.notes && !s.rest && !g ? `<div class="note">${esc(s.notes)}</div>` : ''}
        ${g?.finished ? '' : variantButtons(focusItem)}
        ${!g?.finished && P.p.tutorials?.[focusItem.exerciseId] ? `<button class="tutbtn" data-act="tut" data-ex="${esc(focusItem.exerciseId)}">▶ Guarda il tutorial</button>` : ''}
      </div>
      ${P.full ? '' : `<div class="video sq">${videoEl(fe)}<button class="vfull" data-act="full" aria-label="Video a tutto schermo">⤢</button></div>`}
      ${next && !s.ready ? `<div class="next">${nextE?.video ? `<video src="${esc(nextE.video)}" autoplay muted loop playsinline></video>` : '<div class="ph"></div>'}
        <div><div class="k">DOPO${next.ready ? ` · ${esc(next.block)}` : ''}</div><div class="v">${esc(nextLabel(next))}</div></div></div>` : ''}
    </div>
    <div class="p-ctrl">${controls()}</div>
  </div>`;
  updateClock();
}

const t_ex = (ev) => ev.target.closest('[data-ex]').dataset.ex;
function onClick(ev) {
  const t = ev.target.closest('button');
  if (!t || !P) return;
  ac(); // sblocca l'audio su iOS al primo tocco
  const s = P.steps[P.idx];
  if (t.dataset.focus) {
    const k = Number(t.dataset.focus);
    if (P.g) { P.g.i = k; P.g.t = 0; P.g.rep = 0; } else P.focus = k;
    return render();
  }
  if (t.dataset.sub) {
    const base = s.items[Math.min(P.g ? P.g.i : P.focus, s.items.length - 1)].exerciseId;
    if (t.dataset.sub === base) delete P.subs[base]; else P.subs[base] = t.dataset.sub;
    store.set('subs', P.subs);
    return render();
  }
  switch (t.dataset.act) {
    case 'close': if (confirm('Vuoi uscire dall\'allenamento?')) { const o = P.opts; stopPlayer(); o.onExit?.(); } break;
    case 'voice': P.voice = !P.voice; store.set('voice', P.voice); if (!P.voice) speechSynthesis?.cancel?.(); render(); break;
    case 'pause': togglePause(); break;
    case 'full': P.full = !P.full; store.set('fullVideo', P.full); render(); break;
    case 'tut': {
      // mette in pausa e apre il tutorial sopra il player
      const t = P.p.tutorials[t_ex(ev)];
      if (P.running && s.kind !== 'manual') togglePause();
      const emb = embedUrl(t.videoUrl);
      const m = document.createElement('div');
      m.className = 'tutmodal';
      m.innerHTML = `<div class="tm-top"><b>${esc(t.title)}</b><button class="icon" data-act="tutclose" aria-label="Chiudi">✕</button></div>
        ${emb ? `<div class="video wide"><iframe src="${esc(emb)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div>` : ''}
        <a class="btn block" href="${esc(t.videoUrl)}" target="_blank" rel="noopener" style="margin-top:12px">Apri a schermo intero ↗</a>
        <div class="muted small" style="margin-top:10px;text-align:center">L'allenamento è in pausa: chiudi e premi ▶ per riprendere.</div>`;
      P.root.querySelector('.player').append(m);
      break;
    }
    case 'tutclose': ev.target.closest('.tutmodal')?.remove(); break;
    case 'gnext': if (P.g && !P.g.finished) advanceGuide(); break;
    case 'done': freezeStopwatch(); askScore(s, 'fortime', { seconds: Math.round(elapsed()) }); break;
    case 'sc-inc': case 'sc-dec': { const i = t.closest('.stepper').querySelector('input'); i.value = Math.max(0, (Number(i.value) || 0) + (t.dataset.act === 'sc-inc' ? 1 : -1)); break; }
    case 'sc-save': saveScore(t.closest('.scoremodal')); break;
    case 'next':
      if (s.ladder && s.lastRung && !P.awaiting) return askScore(s, 'fortime', { seconds: Math.round((Date.now() - (P.ladderStart[s.blockKey] || P.started)) / 1000) });
      if (s.amrap && !P.awaiting) { const c = amrapCounts(s); if (c.rounds || c.reps || P.remaining < s.dur - 15) return askScore(s, 'amrap', c); }
      P.running = true; enterStep(P.idx + 1); break;
    case 'prev': P.running = true; enterStep(P.idx - 1); break;
  }
}

function finish() {
  const secs = Math.round((Date.now() - P.started) / 1000);
  const results = {};
  for (const [k, v] of Object.entries(P.amrap)) results[k] = typeof v === 'number' ? `${v} round` : v;
  for (const [k, v] of Object.entries(P.fortime)) results[k] = v;
  say(pick(['Allenamento finito. Grande lavoro!', 'Finito! Ottimo lavoro oggi.', 'Fatto! Anche oggi è andata.']));
  const { opts, p, w } = P;
  const scores = Object.values(P.scores);
  stopPlayer();
  opts.onFinish?.({ programId: p.id, programTitle: p.title, workoutId: w.id, workoutTitle: w.title, seconds: secs, results, scores });
}
