// UN-TIMER: timer gratuito (EMOM, AMRAP, AFAP, Tabata/intervalli) + sezione "Workout" che porta alla prova di UN-MEMBER.
// Tutto gira sul telefono, niente server: le impostazioni restano nel localStorage.
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const ls = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('ut_' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('ut_' + k, JSON.stringify(v)); } catch {} },
};
// link alla prova gratuita: l'utm fa vedere nel pannello "Da dove arrivano" chi viene dal timer
const PROVA = (where) => `/?utm_source=untimer&utm_medium=app&utm_campaign=${where}#/prova`;

const MODES = {
  emom: { name: 'EMOM', sub: 'Ogni minuto, al minuto', fields: [['every', 'Ogni', 's', 10, 15, 300, 60], ['rounds', 'Round', '', 1, 1, 60, 10]] },
  amrap: { name: 'AMRAP', sub: 'Più giri possibili nel tempo', fields: [['minutes', 'Durata', 'min', 1, 1, 90, 12]] },
  afap: { name: 'AFAP', sub: 'Il più veloce possibile', fields: [['cap', 'Time cap', 'min', 1, 0, 90, 20]] },
  tabata: { name: 'TABATA', sub: 'Lavoro / recupero a intervalli', fields: [['work', 'Lavoro', 's', 5, 5, 600, 20], ['rest', 'Recupero', 's', 5, 0, 600, 10], ['rounds', 'Round', '', 1, 1, 60, 8]] },
};
const cfgOf = (m) => ({ ...Object.fromEntries(MODES[m].fields.map((f) => [f[0], f[6]])), ...ls.get('cfg_' + m, {}) });
const opts = () => ({ voice: true, beep: true, prep: 10, ...ls.get('opts', {}) });

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
const fmtMin = (sec) => (sec % 60 ? fmt(sec) : `${sec / 60} min`);
function summary(m, c) {
  if (m === 'emom') return `${c.rounds} round · ogni ${fmtMin(c.every)} · ${fmt(c.every * c.rounds)} totali`;
  if (m === 'amrap') return `${c.minutes} minuti`;
  if (m === 'afap') return c.cap ? `Time cap ${c.cap} minuti` : 'Senza time cap';
  return `${c.rounds} round · ${c.work}s lavoro / ${c.rest}s recupero · ${fmt((c.work + c.rest) * c.rounds - c.rest)}`;
}

// ---------- suoni e voce ----------
const ac = () => (window._ac ||= new (window.AudioContext || window.webkitAudioContext)());
function beep(freq = 880, ms = 150, vol = 0.3) {
  if (!opts().beep) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
    o.start(); o.stop(a.currentTime + ms / 1000);
  } catch {}
}
let VOICE = null;
const pickVoice = () => {
  const rank = (v) => (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0);
  VOICE = (speechSynthesis.getVoices() || []).filter((v) => /^it/i.test(v.lang)).sort((a, b) => rank(b) - rank(a))[0] || null;
};
if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
function say(t) {
  if (!opts().voice || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t.replace(/\bemom\b/gi, 'èmom').replace(/\bamrap\b/gi, 'àmrap').replace(/\bafap\b/gi, 'àfap'));
  if (VOICE) u.voice = VOICE;
  u.lang = 'it-IT';
  speechSynthesis.speak(u);
}

// ---------- schermo sempre acceso (come nel player di UN-MEMBER) ----------
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let R = null; // allenamento in corso
async function keepAwake() {
  if (!R || document.visibilityState !== 'visible') return;
  let ok = !!(R.wake && !R.wake.released);
  if (!ok && navigator.wakeLock) {
    try { R.wake = await navigator.wakeLock.request('screen'); R.wake.addEventListener?.('release', () => setTimeout(keepAwake, 400)); ok = true; } catch {}
  }
  if (!R || (ok && !IOS)) return;
  if (!R.nosleep) {
    const v = Object.assign(document.createElement('video'), { src: '/nosleep.mp4', muted: true, loop: true, playsInline: true });
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
    document.body.append(v); R.nosleep = v;
  }
  if (R.nosleep.paused) R.nosleep.play().catch(() => {});
}
document.addEventListener('visibilitychange', () => { keepAwake(); if (R) tick(); });

// ---------- segmenti: ogni allenamento è una lista di tratti a tempo ----------
function segments(m, c) {
  const S = [], prep = opts().prep;
  if (prep) S.push({ kind: 'prep', dur: prep, label: 'PREPARATI' });
  if (m === 'emom') for (let r = 1; r <= c.rounds; r++) S.push({ kind: 'work', dur: c.every, round: r, of: c.rounds, label: 'EMOM' });
  if (m === 'amrap') S.push({ kind: 'work', dur: c.minutes * 60, label: 'AMRAP', count: true });
  if (m === 'afap') S.push({ kind: 'work', dur: c.cap ? c.cap * 60 : Infinity, label: 'AFAP', up: true, count: true });
  if (m === 'tabata') for (let r = 1; r <= c.rounds; r++) {
    S.push({ kind: 'work', dur: c.work, round: r, of: c.rounds, label: 'LAVORO' });
    if (c.rest && r < c.rounds) S.push({ kind: 'rest', dur: c.rest, round: r, of: c.rounds, label: 'RECUPERO' });
  }
  return S;
}

// ---------- schermate ----------
function nav(tab) {
  return `<nav class="tabs"><a href="#/" class="${tab === 'timer' ? 'on' : ''}"><span>⏱</span>Timer</a>
    <a href="#/workout" class="${tab === 'workout' ? 'on' : ''}"><span>🔥</span>Workout</a>
    <a href="#/impostazioni" class="${tab === 'opts' ? 'on' : ''}"><span>⚙︎</span>Impostazioni</a></nav>`;
}
const brand = `<div class="brand"><b>UN</b>-TIMER<small>by UN-COACH</small></div>`;
const promoCard = (where) => `<a class="promo" href="${PROVA(where)}" target="_blank" rel="noopener">
  <div><small>VUOI PROVARE I NOSTRI WORKOUT?</small><b>7 GIORNI GRATIS SU <span class="nw">UN-MEMBER</span></b>
  <span>Allenamenti guidati con video, timer e voce. Kettlebell, TRX e corpo libero.</span></div><i>›</i></a>`;

function home() {
  app.innerHTML = `<main class="page">${brand}
    <div class="modes">${Object.entries(MODES).map(([k, m]) => `<a class="mode m-${k}" href="#/set/${k}"><b>${m.name}</b><span>${m.sub}</span><small>${summary(k, cfgOf(k))}</small></a>`).join('')}</div>
    ${promoCard('home')}</main>${nav('timer')}`;
}

function setup(m) {
  const M = MODES[m]; if (!M) return (location.hash = '#/');
  const c = cfgOf(m);
  const draw = () => {
    app.innerHTML = `<main class="page"><header class="top"><a href="#/" class="back">‹</a><h1>${M.name}</h1></header>
      <p class="muted">${M.sub}</p>
      ${M.fields.map(([k, lab, unit, step, min]) => `<div class="field"><label>${lab}</label>
        <div class="stepper"><button data-k="${k}" data-d="${-step}">−</button>
        <output>${unit === 's' && c[k] >= 60 ? fmt(c[k]) : c[k] === 0 && k === 'cap' ? 'nessuno' : c[k] + (unit ? ` ${unit}` : '')}</output>
        <button data-k="${k}" data-d="${step}">+</button></div></div>`).join('')}
      <p class="sum">${summary(m, c)}</p>
      <button class="go" id="go">VIA</button></main>${nav('timer')}`;
    app.querySelectorAll('.stepper button').forEach((b) => {
      const f = M.fields.find((x) => x[0] === b.dataset.k);
      const bump = () => { c[f[0]] = Math.min(f[5], Math.max(f[4], c[f[0]] + Number(b.dataset.d))); ls.set('cfg_' + m, c); draw(); };
      b.onclick = bump;
    });
    $('#go').onclick = () => start(m, c);
  };
  draw();
}

function start(m, c) {
  try { ac().resume(); } catch {} // l'audio su iPhone si sblocca solo dopo un tocco
  if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  R = { m, c, S: segments(m, c), i: 0, t0: performance.now(), paused: 0, pauseAt: 0, rounds: 0, lastSec: null, done: false };
  location.hash = '#/run';
}

function run() {
  if (!R) return (location.hash = '#/');
  app.innerHTML = `<main class="run">
    <header class="rtop"><button class="x" id="stop">✕</button><b>${MODES[R.m].name}</b><span id="rr"></span></header>
    <div class="clock"><small id="lab"></small><div id="t">0:00</div><div class="bar"><i id="bar"></i></div><p id="info"></p></div>
    <div class="ctrl">${R.S.some((s) => s.count) ? `<button class="round" id="plus">+1 ROUND<small id="rc">0 round</small></button>` : ''}
      <div class="row"><button id="pause">PAUSA</button>${R.m === 'afap' ? '<button id="fin" class="fin">FINITO</button>' : `<button id="skip">SALTA ›</button>`}</div></div></main>`;
  $('#stop').onclick = () => { if (confirm('Vuoi chiudere il timer?')) stop(); };
  $('#pause').onclick = togglePause;
  if ($('#plus')) $('#plus').onclick = () => { if (R.S[R.i].kind !== 'work' || R.pauseAt) return; R.rounds++; beep(1200, 80); $('#rc').textContent = `${R.rounds} round`; navigator.vibrate?.(30); };
  if ($('#fin')) $('#fin').onclick = () => finish();
  if ($('#skip')) $('#skip').onclick = () => { if (!R.pauseAt) { R.t0 -= (R.S[R.i].dur - elapsed()) * 1000; tick(); } };
  // durante il "preparati" un tocco sul timer fa partire subito
  $('.clock').onclick = () => { if (R.S[R.i].kind === 'prep' && !R.pauseAt) { R.t0 -= (R.S[R.i].dur - elapsed()) * 1000; tick(); } };
  keepAwake();
  R.iv = setInterval(tick, 100);
  tick();
}
const elapsed = () => ((R.pauseAt || performance.now()) - R.t0 - R.paused) / 1000;
function togglePause() {
  if (!R) return;
  if (R.pauseAt) { R.paused += performance.now() - R.pauseAt; R.pauseAt = 0; say('Via'); }
  else { R.pauseAt = performance.now(); speechSynthesis?.cancel(); }
  $('#pause').textContent = R.pauseAt ? 'RIPRENDI' : 'PAUSA';
  document.body.classList.toggle('paused', !!R.pauseAt);
}
function enter(i) {
  const s = R.S[i];
  if (s.kind === 'prep') return say('Preparati');
  beep(s.kind === 'rest' ? 520 : 1320, 450);
  if (s.kind === 'rest') return say('Recupero');
  if (R.m === 'emom' || R.m === 'tabata') say(s.round === s.of && s.of > 1 ? 'Ultimo round!' : s.round === 1 ? 'Via!' : `Round ${s.round}`);
  else say('Via!');
}
function tick() {
  if (!R || R.done || location.hash !== '#/run') return;
  let s = R.S[R.i], e = elapsed();
  // tratti finiti (anche più di uno, se il telefono era in background): avanti
  while (e >= s.dur) {
    R.t0 += s.dur * 1000;
    if (++R.i >= R.S.length) return finish(true);
    s = R.S[R.i]; e = elapsed(); R.lastSec = null; enter(R.i);
  }
  if (!R.started) { R.started = 1; enter(R.i); }
  const left = s.dur - e, sec = Math.ceil(left);
  if (sec !== R.lastSec && R.lastSec !== null && !R.pauseAt) {
    if (sec <= 3 && sec >= 1) beep(880, 140);
    if (s.kind === 'work' && s.dur >= 240) {
      if (sec === 60) say('Un minuto alla fine');
      else if (Math.abs(sec - s.dur / 2) < 0.5 && s.dur >= 600) say('Metà tempo');
    }
  }
  R.lastSec = sec;
  const up = s.up;
  $('#t').textContent = up ? fmt(Math.floor(e)) : fmt(left);
  $('#lab').textContent = s.label;
  $('#rr').textContent = s.round ? `${s.round}/${s.of}` : '';
  $('#bar').style.width = `${s.dur === Infinity ? 0 : Math.min(100, (e / s.dur) * 100)}%`;
  $('#info').textContent = s.kind === 'prep' ? `${summary(R.m, R.c)} · tocca per partire subito` : up && s.dur !== Infinity ? `Time cap ${fmt(s.dur)}` : R.m === 'amrap' ? `di ${fmt(s.dur)}` : nextInfo();
  document.body.dataset.kind = s.kind + (!up && left <= 3.05 && s.kind !== 'prep' ? ' last' : '');
}
function nextInfo() {
  const n = R.S[R.i + 1];
  return n ? `Dopo: ${n.kind === 'rest' ? `recupero ${n.dur}s` : n.round ? `round ${n.round}` : n.label.toLowerCase()}` : 'Ultimo!';
}
// AFAP: il risultato è il tempo fatto (o "Time cap" se è scaduto). "FINITO" durante il preparati non vale.
function finish(timeUp) {
  const s = R.S[R.i];
  if (!timeUp && s.kind !== 'work') return;
  R.done = true; clearInterval(R.iv);
  if (R.m === 'afap') R.result = timeUp ? 'TIME CAP' : fmt(Math.floor(elapsed()));
  beep(1320, 300); setTimeout(() => beep(1760, 500), 320);
  say('Finito! Daje!');
  location.hash = '#/fine';
}
function stop(home = true) { if (R) { clearInterval(R.iv); R.wake?.release?.().catch(() => {}); R.nosleep?.remove(); } R = null; speechSynthesis?.cancel(); document.body.className = ''; delete document.body.dataset.kind; if (home) location.hash = '#/'; }

function end() {
  if (!R?.done) return (location.hash = '#/');
  const { m, c, rounds, result } = R;
  R.wake?.release?.().catch(() => {}); R.nosleep?.remove();
  delete document.body.dataset.kind;
  const big = m === 'afap' ? result : m === 'amrap' && rounds ? `${rounds} round` : 'FATTO!';
  app.innerHTML = `<main class="page end"><div class="done">💪</div><h1>DAJE!</h1>
    <div class="res"><small>${MODES[m].name} · ${summary(m, c)}</small><b>${big}</b>${m === 'afap' && rounds ? `<span>${rounds} round</span>` : ''}</div>
    <div class="row"><button id="again" class="go">RIFAI</button><a class="btn" href="#/">HOME</a></div>
    ${promoCard('fine')}</main>`;
  $('#again').onclick = () => start(m, c);
}

function workout() {
  app.innerHTML = `<main class="page">${brand}
    <section class="wk"><img src="/img/coach.webp" alt="" loading="lazy" onerror="this.remove()">
      <h1>VUOI PROVARE I NOSTRI WORKOUT?</h1>
      <p>Il timer è gratis, per sempre. Se vuoi anche gli allenamenti già pronti, c'è <b>UN-MEMBER</b>: l'app di Alessio con i programmi completi.</p>
      <ul><li>🎥 Video di ogni esercizio</li><li>⏱ Timer e voce che ti guidano, come qui</li><li>🏋️ Kettlebell, TRX e corpo libero, a casa o al parco</li>
        <li>📅 La tua settimana pronta ogni giorno</li><li>💬 Community e chat con il coach</li></ul>
      <a class="go" href="${PROVA('workout')}" target="_blank" rel="noopener">PROVA 7 GIORNI GRATIS</a>
      <p class="muted small">Nessun pagamento per la prova.</p>
      <div class="shots">${['prova-oggi', 'prova-programmi', 'prova-player'].map((n) => `<img src="/img/${n}.webp" alt="" loading="lazy" onerror="this.remove()">`).join('')}</div>
    </section></main>${nav('workout')}`;
}

function settings() {
  const o = opts();
  const draw = () => {
    app.innerHTML = `<main class="page"><header class="top"><h1>IMPOSTAZIONI</h1></header>
      <label class="sw"><span>Voce</span><input type="checkbox" id="voice" ${o.voice ? 'checked' : ''}></label>
      <label class="sw"><span>Bip</span><input type="checkbox" id="beep" ${o.beep ? 'checked' : ''}></label>
      <div class="field"><label>Conto alla rovescia prima di partire</label>
        <div class="seg">${[0, 5, 10, 15].map((v) => `<button data-p="${v}" class="${o.prep === v ? 'on' : ''}">${v ? v + 's' : 'No'}</button>`).join('')}</div></div>
      <p class="muted small">UN-TIMER è gratuito e funziona anche senza internet. Fatto da Alessio · UN-COACH.</p></main>${nav('opts')}`;
    $('#voice').onchange = (e) => { o.voice = e.target.checked; ls.set('opts', o); if (o.voice) say('Voce attiva'); };
    $('#beep').onchange = (e) => { o.beep = e.target.checked; ls.set('opts', o); beep(); };
    app.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { o.prep = Number(b.dataset.p); ls.set('opts', o); draw(); }));
  };
  draw();
}

// ---------- router ----------
function route() {
  const h = location.hash.slice(1) || '/';
  if (h !== '/run' && h !== '/fine' && R && !R.done) stop(false);
  if (h !== '/run') { delete document.body.dataset.kind; document.body.classList.remove('paused'); }
  if (h === '/run') return run();
  if (h === '/fine') return end();
  if (h.startsWith('/set/')) return setup(h.slice(5));
  if (h === '/workout') return workout();
  if (h === '/impostazioni') return settings();
  home();
}
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (location.hash !== '#/run' || !R) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ($('#plus') || $('#pause')).click(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
});
route();
