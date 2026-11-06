// UN-TIMER: app a sé, gratuita. Timer EMOM, AMRAP, AFAP e HIIT, senza video e senza account.
// Tutto gira sul telefono: impostazioni e timer salvati restano nel localStorage.
const NAME = 'UN-TIMER'; // nome dell'app (si cambia qui e in index.html / manifest.json)
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('ut_' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('ut_' + k, JSON.stringify(v)); } catch {} },
};
const clone = (o) => JSON.parse(JSON.stringify(o));
// link esterno alla prova gratuita di UN-MEMBER (l'unico collegamento con l'altra app)
const PROVA = 'https://un-member.onrender.com/?utm_source=untimer&utm_medium=app&utm_campaign=timer#/prova';

const MODES = {
  emom: { name: 'EMOM', col: '#ffc21a', sub: 'Ogni X secondi, per X round', def: { every: 60, rounds: 10, slots: [{ text: '', rest: false }] } },
  amrap: { name: 'AMRAP', col: '#ff7a00', sub: 'Più giri possibili nel tempo', def: { minutes: 12, items: [] } },
  afap: { name: 'AFAP', col: '#ff4d6d', sub: 'Il più veloce possibile', def: { cap: 0, items: [] } },
  it: { name: 'HIIT', col: '#35d07f', sub: 'Lavoro / recupero a intervalli', def: { work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 } },
};
const cfgOf = (m) => ({ ...clone(MODES[m].def), ...ls.get('cfg_' + m, {}) });
const opts = () => ({ voice: true, beep: true, prep: 10, ...ls.get('opts', {}) });

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
const secTxt = (s) => (s < 60 ? `${s}s` : s % 60 ? fmt(s) : `${s / 60} min`);
const slotName = (c, j) => (c.every === 60 ? `Minuto ${j + 1}` : `Intervallo ${j + 1}`);
const emomTotal = (c) => c.every * c.slots.length * c.rounds;
const itTotal = (c) => ((c.work + c.rest) * c.rounds - c.rest) * c.sets + (c.sets - 1) * c.setRest;
function summary(m, c) {
  if (m === 'emom') return `ogni ${secTxt(c.every)}${c.slots.length > 1 ? ` · ${c.slots.length} intervalli a giro` : ''} · ${c.rounds} round · ${fmt(emomTotal(c))}`;
  if (m === 'amrap') return `${c.minutes} ${c.minutes === 1 ? 'minuto' : 'minuti'}${c.items?.length ? ` · ${c.items.length} ${c.items.length === 1 ? 'esercizio' : 'esercizi'}` : ''}`;
  if (m === 'afap') return `${c.items.length ? `${c.items.length} ${c.items.length === 1 ? 'esercizio' : 'esercizi'} · ` : ''}${c.cap ? `time cap ${c.cap} min` : 'senza time cap'}`;
  return `${c.work}s / ${c.rest}s × ${c.rounds}${c.sets > 1 ? ` · ${c.sets} serie (${secTxt(c.setRest)} tra le serie)` : ''} · ${fmt(itTotal(c))}`;
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
  if (!opts().voice || !window.speechSynthesis || !t) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t.replace(/\bemom\b/gi, 'èmom').replace(/\bamrap\b/gi, 'àmrap').replace(/\bafap\b/gi, 'àfap'));
  if (VOICE) u.voice = VOICE;
  u.lang = 'it-IT';
  speechSynthesis.speak(u);
}

// ---------- voce del coach (Alessio, romana) ----------
// Ogni momento ha più frasi, scelte a caso. Se c'è la registrazione (voce/<momento>-<n>.mp3, elencata in AUDIO)
// parte quella, altrimenti la legge la voce del telefono. Massimo una frase ogni 6 secondi.
const COACH = {
  // tutti i timer
  pronti: ['Preparate, se parte!', 'Mettete in posizione!', 'Pronto? Mo se comincia.'],
  via: ['Daje, partiamo!', 'Vai, è tutto tuo!', 'Daje che se comincia!'],
  pausa: ['Pausa. Riparti quando sei pronto.', "Fermo 'n attimo, poi se riparte."],
  riprendi: ['Riprendiamo, daje!', 'Rientra, forza!'],
  meta: ['Metà fatta, nun mollà!', 'Semo a metà, tieni botta!', "Metà fatta, mo' viene il bello!"],
  min1: ['Ultimo minuto, mo o mai più!', 'Manca un minuto, daje tutto!', 'Un minuto, svuota er serbatoio!'],
  sec10: ['Dieci secondi, spigni!', 'Ultimi dieci, nun te fermà!', 'Dieci secondi, daje daje daje!'],
  ultimo: ['Ultimo round, dacce dentro!', 'Ultimo, poi te riposi!', "L'ultimo, fallo bene!"],
  fine: ['Grande! Daje!', "Fatto! Sei 'na bestia!", 'Bravo! Mo riposa.', 'Finito! Oggi te lo sei guadagnato.'],
  // EMOM e HIIT
  giroemom: ["N'antro minuto, vai!", 'Sotto, riparti!', 'Su, che se ricomincia!'],
  lavoro: ['Vai!', 'Spigni!', 'Dai tutto!'],
  recupero: ['Recupera, respira.', 'Fiato, che se riparte.', 'Respira, sciogli le spalle.'],
  serie: ['Serie finita, bravo! Recupera bene.', 'Una serie in meno! Respira.'],
  // AMRAP
  giro: ["Bravo, n'antro giro!", "Così se fa!", 'Giro chiuso, avanti!'],
  veloce: ['Stai a volà!', "Che ritmo, nun calà!"],
  lento: ["Oh, nun te fermà, daje!", 'Respira e riparti!', "Forza, che nun è finita!"],
  ungiro: ["Er giro ce lo fai, daje!", "Manca solo 'n giro, chiudilo!", 'Ce stai dentro, chiudi sto giro!'],
  // AFAP
  afap: ['Forza che ce stai!', 'Tieni duro, daje!', 'Nun mollà, testa bassa e pedalà!'],
  esfatto: ['Uno in meno!', 'Via questo, sotto col prossimo!', 'Fatto, avanti!'],
  esultimo: ["Ultimo esercizio, chiudi!", "È l'ultimo, svuotate!"],
  // conto alla rovescia (facoltativo): conto-3 = "Tre", conto-2 = "Due", conto-1 = "Uno"
  conto: ['Tre', 'Due', 'Uno'],
};
const AUDIO = new Set([]); // es. 'via-1', 'sec10-2': i file registrati da Alessio in voce/ (aggiungerli anche a sw.js)
let coachAt = 0, coachAu = null;
// la voce del telefono legge male il romano: qualche parola in italiano
const tts = (t) => t.replace(/\bnun\b/gi, 'non').replace(/\bspigni\b/gi, 'spingi').replace(/\bsemo\b/gi, 'siamo').replace(/n'antro/gi, 'un altro')
  .replace(/\bse\b(?= (parte|comincia|riparte|ricomincia|fa))/gi, 'si').replace(/\bPreparate\b/, 'Preparati').replace(/\bMettete\b/, 'Mettiti').replace(/svuotate/, 'svuotati').replace(/\ber\b/gi, 'il').replace(/ 'n /g, ' un ');
function coach(ev, fixed) {
  const o = opts(), list = COACH[ev];
  if (!o.voice || !list || (o.push === false && ev !== 'fine')) return false;
  const now = Date.now();
  const n = fixed ?? Math.floor(Math.random() * list.length), id = `${ev}-${n + 1}`;
  if (ev === 'conto' && !AUDIO.has(id)) return false; // il conto con la voce del telefono no: bastano i bip
  if (now - coachAt < 6000 && !['fine', 'conto', 'pausa', 'riprendi'].includes(ev)) return false;
  coachAt = now;
  if (AUDIO.has(id)) {
    window.speechSynthesis?.cancel(); coachAu?.pause();
    coachAu = new Audio(`voce/${id}.mp3`); coachAu.play().catch(() => say(list[n]));
  } else say(tts(list[n]));
  return true;
}

// ---------- schermo sempre acceso ----------
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let R = null; // timer in corso
async function keepAwake() {
  if (!R || R.done || document.visibilityState !== 'visible') return;
  let ok = !!(R.wake && !R.wake.released);
  if (!ok && navigator.wakeLock) {
    try { R.wake = await navigator.wakeLock.request('screen'); R.wake.addEventListener?.('release', () => setTimeout(keepAwake, 400)); ok = true; } catch {}
  }
  if (!R || (ok && !IOS)) return;
  if (!R.nosleep) {
    const v = Object.assign(document.createElement('video'), { src: 'nosleep.mp4', muted: true, loop: true, playsInline: true });
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
    document.body.append(v); R.nosleep = v;
  }
  if (R.nosleep.paused) R.nosleep.play().catch(() => {});
}
const sleepOk = () => { if (R) { R.wake?.release?.().catch(() => {}); R.wake = null; R.nosleep?.remove(); R.nosleep = null; } };
document.addEventListener('visibilitychange', () => { keepAwake(); if (R && !R.done) tick(); });

// ---------- segmenti: ogni timer è una lista di tratti a tempo ----------
function segments(m, c) {
  const S = [], prep = opts().prep;
  if (prep) S.push({ kind: 'prep', dur: prep, label: 'PREPARATI' });
  if (m === 'emom') for (let r = 1; r <= c.rounds; r++) c.slots.forEach((sl, j) => S.push({
    kind: sl.rest ? 'rest' : 'work', dur: c.every, round: r, of: c.rounds, text: sl.text,
    label: sl.rest ? 'RECUPERO' : c.slots.length > 1 ? slotName(c, j).toUpperCase() : 'EMOM' }));
  if (m === 'amrap') S.push({ kind: 'work', dur: c.minutes * 60, label: 'AMRAP', laps: true });
  if (m === 'afap') S.push({ kind: 'work', dur: c.cap ? c.cap * 60 : Infinity, label: 'AFAP', up: true, laps: !c.items.length });
  if (m === 'it') for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.rounds; r++) {
      S.push({ kind: 'work', dur: c.work, round: r, of: c.rounds, set: s, sets: c.sets, label: 'LAVORO' });
      if (c.rest && r < c.rounds) S.push({ kind: 'rest', dur: c.rest, round: r, of: c.rounds, set: s, sets: c.sets, label: 'RECUPERO' });
    }
    if (s < c.sets && c.setRest) S.push({ kind: 'rest', dur: c.setRest, set: s, sets: c.sets, label: 'RECUPERO SERIE', long: true });
  }
  return S;
}

// ---------- pezzi di pagina ----------
// logo UN (U + N squadrate) + "TIMER" in Montserrat Black
const LOGO = '<svg viewBox="0 0 924 516" aria-hidden="true"><path fill="currentColor" d="M0 0H130V386H313V0H444V516H0Z M480 0H924V516H793V130H610V516H480Z"/></svg>';
const logo = (big) => `<div class="logo ${big ? 'big' : ''}">${LOGO}<b>TIMER</b></div>`;
// menu laterale (☰), al posto della barra in basso
const menuBtn = '<button class="burger" id="burger" aria-label="Menu"><i></i><i></i><i></i></button>';
function openMenu() {
  const d = Object.assign(document.createElement('div'), { className: 'drawer' });
  d.innerHTML = `<aside><div class="dlogo">${logo()}</div>
    <a href="#home">⏱<span>Timer</span></a><a href="#salvati">★<span>I miei timer</span></a><a href="#diario">📅<span>Diario</span></a>
    <a href="#workout">🔥<span>Prova i nostri workout</span></a><a href="#impostazioni">⚙︎<span>Impostazioni</span></a></aside>`;
  d.onclick = (e) => { if (e.target === d || e.target.closest('a')) d.remove(); };
  document.body.append(d);
}
const back = (title) => `<header class="top"><a href="#home" class="back" aria-label="Indietro">‹</a><h1>${title}</h1></header>`;
const stepper = (k, label, val, shown) => `<div class="field"><label>${label}</label>
  <div class="stepper"><button data-k="${k}" data-d="-1">−</button><output>${shown ?? val}</output><button data-k="${k}" data-d="1">+</button></div></div>`;

function home() {
  const n = ls.get('saved', []).length;
  app.innerHTML = `<main class="home"><header class="hbar">${menuBtn}</header>
    ${logo(true)}
    <div class="pills">${Object.entries(MODES).map(([k, m]) => `<a class="pill" href="#set-${k}" style="--c:${m.col}"><b>${m.name}</b><span>${m.sub}</span></a>`).join('')}</div>
    <div class="hfoot"><div class="hlinks"><a href="#salvati">★ I MIEI TIMER${n ? ` <em>${n}</em>` : ''}</a><a href="#diario">📅 DIARIO</a></div><a href="#workout" class="hpromo">Vuoi provare i nostri workout? <b>Prova gratis ›</b></a></div>
  </main>`;
  $('#burger').onclick = openMenu;
}

function savedPage() {
  const saved = ls.get('saved', []);
  app.innerHTML = `<main class="page">${back('I MIEI TIMER')}
    ${saved.length ? `<div class="saved">${saved.map((s, i) => `<div class="sv" style="--c:${MODES[s.m].col}"><a href="#set-${s.m}-${i}"><small>${MODES[s.m].name}</small><b>${esc(s.name)}</b><span>${summary(s.m, s.c)}</span></a><button data-del="${i}" aria-label="Elimina">✕</button></div>`).join('')}</div>`
    : '<p class="muted">Ancora niente. Prepara un timer e premi "Salva questo timer": lo ritrovi qui, pronto da far partire.</p>'}
  </main>`;
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    const s = ls.get('saved', []);
    if (!(await ask(`Eliminare "${s[b.dataset.del].name}"?`, { ok: 'Elimina' }))) return;
    s.splice(b.dataset.del, 1); ls.set('saved', s); savedPage();
  }));
}

// passi dei numeri: secondi a 5 alla volta, round e minuti a 1
const STEP = {
  every: [5, 10, 600], rounds: [1, 1, 99], minutes: [1, 1, 120], cap: [1, 0, 120],
  work: [5, 5, 600], rest: [5, 0, 600], sets: [1, 1, 20], setRest: [5, 0, 600],
};
function setup(m, savedIdx) {
  const M = MODES[m]; if (!M) return (location.hash = '#home');
  const saved = savedIdx != null ? ls.get('saved', [])[savedIdx] : null;
  const c = saved ? { ...clone(M.def), ...clone(saved.c) } : cfgOf(m);
  const keep = () => { if (!saved) ls.set('cfg_' + m, c); };
  const draw = () => {
    let body = '';
    if (m === 'emom') body = `<div class="field"><label>Ogni</label>
        <div class="chips">${[30, 45, 60, 90, 120].map((v) => `<button data-every="${v}" class="${c.every === v ? 'on' : ''}">${secTxt(v)}</button>`).join('')}</div>
        <div class="stepper"><button data-k="every" data-d="-1">−</button><output>${secTxt(c.every)}</output><button data-k="every" data-d="1">+</button></div></div>
      <div class="field"><label>Intervalli di ogni giro</label>
        <div class="list">${c.slots.map((sl, j) => `<div class="li ${sl.rest ? 'isrest' : ''}"><em>${j + 1}</em>
          ${sl.rest ? '<span class="restlab">RECUPERO</span>' : `<input data-slot="${j}" value="${esc(sl.text)}" placeholder="${slotName(c, j)}: esercizio (facoltativo)" maxlength="60">`}
          <button data-rest="${j}" class="tg ${sl.rest ? 'on' : ''}" title="Recupero">💤</button>${c.slots.length > 1 ? `<button data-rm="${j}" class="rm">✕</button>` : ''}</div>`).join('')}</div>
        <div class="row2"><button class="add" data-addslot="0">+ Intervallo</button><button class="add" data-addslot="1">+ Recupero</button></div></div>
      ${stepper('rounds', 'Round (giri completi)', c.rounds)}`;
    const items = (label, hint) => `<div class="field"><label>${label}</label>
        <div class="list">${c.items.map((it, j) => `<div class="li"><input data-reps="${j}" class="reps" type="number" inputmode="numeric" value="${it.reps || ''}" placeholder="rip">
          <input data-name="${j}" value="${esc(it.name)}" placeholder="Esercizio" maxlength="40"><button data-rmi="${j}" class="rm">✕</button></div>`).join('') || `<p class="muted small">${hint}</p>`}</div>
        <div class="row2"><button class="add" id="addi">+ Esercizio</button>${c.items.length ? '<button class="add" id="clr">Cancella tutto</button>' : ''}</div></div>`;
    if (m === 'amrap') body = stepper('minutes', 'Durata', c.minutes, `${c.minutes} min`)
      + items('Il workout (esercizi di un giro, facoltativo)', 'Es. 10 Swing, 8 Burpees, 6 Goblet Squat. Durante il timer premi "+1 GIRO" a ogni giro chiuso; alla fine segni cosa hai fatto del giro non finito.');
    if (m === 'afap') body = items('Esercizi (facoltativo)', 'Es. 100 Burpees, 50 Swing… Durante il timer segni quante ne hai fatte e spunti quelli finiti.')
      + stepper('cap', 'Time cap', c.cap, c.cap ? `${c.cap} min` : 'nessuno');
    if (m === 'it') body = `<div class="pair">${stepper('work', 'Lavoro', c.work, secTxt(c.work))}${stepper('rest', 'Recupero', c.rest, secTxt(c.rest))}</div>
      ${stepper('rounds', 'Round', c.rounds)}
      <div class="pair">${stepper('sets', 'Ripeti tutto (serie)', c.sets, `${c.sets}×`)}${c.sets > 1 ? stepper('setRest', 'Recupero tra le serie', c.setRest, secTxt(c.setRest)) : ''}</div>`;
    app.innerHTML = `<main class="page" style="--accent:${M.col}">${back(saved ? esc(saved.name) : M.name)}
      <p class="muted">${M.sub}</p>${body}
      <p class="sum">${summary(m, c)}</p>
      <button class="go" id="go">VIA</button>
      <button class="ghost" id="save">${saved ? '💾 Salva modifiche' : '💾 Salva questo timer'}</button></main>`;
    // numeri
    app.querySelectorAll('.stepper button').forEach((b) => (b.onclick = () => {
      const k = b.dataset.k, [st, min, max] = STEP[k];
      c[k] = Math.min(max, Math.max(min, c[k] + st * Number(b.dataset.d))); keep(); draw();
    }));
    // EMOM
    app.querySelectorAll('[data-every]').forEach((b) => (b.onclick = () => { c.every = Number(b.dataset.every); keep(); draw(); }));
    app.querySelectorAll('[data-slot]').forEach((i) => (i.oninput = () => { c.slots[i.dataset.slot].text = i.value; keep(); }));
    app.querySelectorAll('[data-rest]').forEach((b) => (b.onclick = () => { const sl = c.slots[b.dataset.rest]; sl.rest = !sl.rest; keep(); draw(); }));
    app.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { c.slots.splice(b.dataset.rm, 1); keep(); draw(); }));
    app.querySelectorAll('[data-addslot]').forEach((b) => (b.onclick = () => { c.slots.push({ text: '', rest: b.dataset.addslot === '1' }); keep(); draw(); }));
    // AFAP
    app.querySelectorAll('[data-name]').forEach((i) => (i.oninput = () => { c.items[i.dataset.name].name = i.value; keep(); }));
    app.querySelectorAll('[data-reps]').forEach((i) => (i.oninput = () => { c.items[i.dataset.reps].reps = Math.max(0, parseInt(i.value) || 0); keep(); $('.sum').textContent = summary(m, c); }));
    app.querySelectorAll('[data-rmi]').forEach((b) => (b.onclick = () => { c.items.splice(b.dataset.rmi, 1); keep(); draw(); }));
    if ($('#addi')) $('#addi').onclick = () => { c.items.push({ name: '', reps: 0 }); keep(); draw(); app.querySelector(`[data-reps="${c.items.length - 1}"]`)?.focus(); };
    if ($('#clr')) $('#clr').onclick = async () => { if (await ask('Cancellare tutti gli esercizi?', { ok: 'Cancella' })) { c.items = []; keep(); draw(); } };
    $('#go').onclick = () => start(m, clean(m, c), saved?.name);
    $('#save').onclick = async () => {
      const s = ls.get('saved', []);
      if (saved) { s[savedIdx] = { ...saved, c: clean(m, c) }; ls.set('saved', s); toast('Salvato'); return; }
      const name = await ask('Come lo chiami?', { ok: 'Salva', input: `${M.name} ${summary(m, c).split(' · ')[0]}` });
      if (!name) return;
      s.unshift({ name: name.slice(0, 40), m, c: clean(m, c) }); ls.set('saved', s); toast('Salvato in "I miei timer" ★');
    };
  };
  draw();
}
// toglie le righe vuote prima di partire / salvare
const clean = (m, c) => (c.items ? { ...clone(c), items: c.items.filter((it) => it.name.trim() || it.reps).map((it) => ({ name: it.name.trim(), reps: it.reps || 0 })) } : clone(c));
// finestra di conferma / nome dentro l'app (confirm e prompt del browser non vanno ovunque)
let askEl = null;
const closeAsk = () => { askEl?.remove(); askEl = null; };
function ask(text, { ok = 'Sì', input = null } = {}) {
  closeAsk(); document.querySelector('.drawer')?.remove();
  return new Promise((res) => {
    askEl = Object.assign(document.createElement('div'), { className: 'ask' });
    askEl.innerHTML = `<div class="askbox"><p>${esc(text)}</p>${input != null ? `<input id="askin" maxlength="40" value="${esc(input)}">` : ''}
      <div class="row"><button class="btn" data-a="0">Annulla</button><button class="go" data-a="1">${esc(ok)}</button></div></div>`;
    document.body.append(askEl);
    const inp = askEl.querySelector('#askin');
    if (inp) { inp.focus(); inp.select(); inp.onkeydown = (e) => e.key === 'Enter' && askEl.querySelector('[data-a="1"]').click(); }
    askEl.onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (!b && e.target !== askEl) return;
      const v = b?.dataset.a === '1' ? (inp ? inp.value.trim() || null : true) : (inp ? null : false);
      closeAsk(); res(v);
    };
  });
}
function toast(t) { const d = Object.assign(document.createElement('div'), { className: 'toast', textContent: t }); document.body.append(d); setTimeout(() => d.remove(), 1800); }

// ---------- timer in corso ----------
function start(m, c, title) {
  try { ac().resume(); } catch {} // su iPhone l'audio si sblocca solo dopo un tocco
  if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  R = { m, c, title, S: segments(m, c), i: 0, t0: performance.now(), paused: 0, pauseAt: 0, laps: [], done: false,
    items: (c.items || []).map((it) => ({ ...it, n: 0, ok: false })) };
  if (location.hash === '#run') run(); else location.hash = '#run';
}
const elapsed = () => ((R.pauseAt || performance.now()) - R.t0 - R.paused) / 1000;
// secondi di lavoro fatti (a timer finito R.i è oltre l'ultimo tratto)
const workTime = () => R.S.slice(0, R.i).filter((s) => s.kind !== 'prep').reduce((a, s) => a + s.dur, 0) + (!R.S[R.i] || R.S[R.i].kind === 'prep' ? 0 : elapsed());

function run() {
  if (!R) return (location.hash = '#home');
  const afapList = R.m === 'afap' && R.items.length, wod = R.m === 'amrap' && R.items.length;
  app.innerHTML = `<main class="run ${afapList || wod ? 'withlist' : ''}" style="--accent:${MODES[R.m].col}">
    <header class="rtop"><button class="x" id="stop">✕</button><b>${esc(R.title || MODES[R.m].name)}</b><span id="rr"></span></header>
    <div class="clock"><small id="lab"></small><div id="t">0:00</div><div id="txt"></div><div class="bar"><i id="bar"></i></div><p id="info"></p></div>
    ${wod ? `<div class="wod">${R.items.map((it) => `<div><b>${it.reps || ''}</b>${esc(it.name || 'Esercizio')}</div>`).join('')}</div>` : ''}
    ${afapList ? `<div class="checklist">${R.items.map((it, j) => `<div class="ck" data-i="${j}"><button class="box" data-ok="${j}"></button>
        <div class="nm"><b>${esc(it.name || `Esercizio ${j + 1}`)}</b><span>${it.reps ? `<i>0</i> / ${it.reps}` : ''}</span></div>
        ${it.reps ? [1, 5, 10].map((v) => `<button class="pl" data-add="${j}" data-v="${v}">+${v}</button>`).join('') : ''}</div>`).join('')}</div>` : ''}
    <div class="ctrl">${R.S.some((s) => s.laps) ? `<button class="round" id="plus">+1 GIRO<small id="rc">0 giri</small></button>` : ''}
      <div class="row"><button id="pause">PAUSA</button>${R.m === 'afap' ? '<button id="fin" class="fin">FINITO</button>' : '<button id="skip">SALTA ›</button>'}</div></div></main>`;
  $('#stop').onclick = async () => { if (await ask('Vuoi chiudere il timer?', { ok: 'Chiudi' })) stop(); };
  $('#pause').onclick = togglePause;
  // durante il "preparati" un tocco sul timer fa partire subito
  $('.clock').onclick = () => { if (R.S[R.i].kind === 'prep' && !R.pauseAt) jump(); };
  if ($('#plus')) $('#plus').onclick = () => {
    if (R.S[R.i].kind !== 'work' || R.pauseAt) return;
    R.laps.push(workTime()); beep(1200, 80); navigator.vibrate?.(30);
    // giro più veloce della media dei precedenti: "stai a volà"; altrimenti ogni 2 giri un "bravo"
    const L = R.laps, last = L.at(-1) - (L.at(-2) || 0), prevAvg = L.length > 1 ? L.at(-2) / (L.length - 1) : 0;
    if (prevAvg && last < prevAvg * 0.9) coach('veloce'); else if (L.length % 2 === 0) coach('giro');
    $('#rc').textContent = `${R.laps.length} ${R.laps.length === 1 ? 'giro' : 'giri'} · ultimo ${fmt(R.laps.at(-1) - (R.laps.at(-2) || 0))}`;
  };
  if ($('#fin')) $('#fin').onclick = () => finish();
  if ($('#skip')) $('#skip').onclick = () => { if (!R.pauseAt) jump(); };
  app.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
    if (R.S[R.i].kind !== 'work' || R.pauseAt) return;
    const it = R.items[b.dataset.add]; it.n = Math.min(it.reps, it.n + Number(b.dataset.v)); beep(1200, 60); navigator.vibrate?.(20);
    if (it.n >= it.reps && !it.ok) { it.ok = true; itemDone(); }
    drawItems();
  }));
  app.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = () => {
    if (R.S[R.i].kind !== 'work' || R.pauseAt) return;
    const it = R.items[b.dataset.ok]; it.ok = !it.ok; if (it.ok && it.reps) it.n = it.reps; if (it.ok) itemDone(); drawItems();
  }));
  keepAwake();
  R.iv = setInterval(tick, 100);
  tick();
}
function itemDone() {
  const left = R.items.filter((it) => !it.ok).length;
  if (left === 1) coach('esultimo'); else if (left > 1) coach('esfatto');
}
function drawItems() {
  R.items.forEach((it, j) => {
    const row = app.querySelector(`.ck[data-i="${j}"]`); if (!row) return;
    row.classList.toggle('ok', it.ok);
    const n = row.querySelector('.nm i'); if (n) n.textContent = it.n;
  });
  if (R.items.every((it) => it.ok)) setTimeout(() => R && !R.done && R.items.every((it) => it.ok) && finish(), 600); // tutto spuntato: tempo fermo
}
function jump() { R.t0 -= (R.S[R.i].dur - elapsed()) * 1000; tick(); }
function togglePause() {
  if (!R) return;
  if (R.pauseAt) { R.paused += performance.now() - R.pauseAt; R.pauseAt = 0; coach('riprendi') || say('Via'); }
  else { R.pauseAt = performance.now(); window.speechSynthesis?.cancel(); coach('pausa'); }
  $('#pause').textContent = R.pauseAt ? 'RIPRENDI' : 'PAUSA';
  document.body.classList.toggle('paused', !!R.pauseAt);
}
function enter(i) {
  const s = R.S[i];
  if (s.kind === 'prep') return coach('pronti') || say('Preparati');
  beep(s.kind === 'rest' ? 520 : 1320, 450);
  if (s.kind === 'rest') return coach(s.long ? 'serie' : 'recupero') || say(s.long ? `Recupero, ${secTxt(s.dur).replace('min', 'minuti').replace('s', ' secondi')}` : 'Recupero');
  const lastWork = !R.S.slice(i + 1).some((x) => x.kind === 'work'), first = !R.S.slice(0, i).some((x) => x.kind === 'work');
  if (lastWork && s.of > 1) return coach('ultimo') || say(s.text ? `Ultimo! ${s.text}` : 'Ultimo round!');
  // EMOM: se c'è scritto l'esercizio si legge quello, altrimenti a inizio giro (un giro sì e uno no) una spinta
  if (R.m === 'emom') return s.text ? say(s.text) : first ? coach('via') || say('Via!') : R.S[i - 1]?.round !== s.round && s.round % 2 === 0 ? coach('giroemom') : null;
  if (R.m === 'it') return s.round === 1 && s.sets > 1 && !first ? say(`Serie ${s.set}, via!`) : first ? coach('via') || say('Via!') : coach('lavoro');
  coach('via') || say('Via!');
}
function tick() {
  if (!R || R.done || location.hash !== '#run') return;
  if (!R.started) { R.started = 1; enter(R.i); }
  let s = R.S[R.i], e = elapsed();
  // tratti finiti (anche più d'uno, se il telefono era in background): avanti
  while (e >= s.dur) {
    R.t0 += s.dur * 1000;
    if (++R.i >= R.S.length) return finish(true);
    s = R.S[R.i]; e = elapsed(); R.lastSec = null; enter(R.i);
  }
  const left = s.dur - e, sec = Math.ceil(left);
  if (sec !== R.lastSec && R.lastSec != null && !R.pauseAt) {
    if (sec <= 3 && sec >= 1 && !coach('conto', 3 - sec)) beep(880, 140);
    if (s.kind === 'work') motivate(s, e, left, sec);
  }
  const es = Math.floor(e);
  if (s.up && es !== R.lastUp && !R.pauseAt) { R.lastUp = es; if (es > 0 && es % 180 === 0) coach('afap'); } // AFAP: una spinta ogni 3 minuti
  R.lastSec = sec;
  $('#t').textContent = s.up ? fmt(Math.floor(e)) : fmt(left);
  $('#lab').textContent = s.label;
  $('#rr').textContent = s.round ? `${s.sets > 1 ? `S${s.set} · ` : ''}${s.round}/${s.of}` : s.sets > 1 ? `S${s.set}/${s.sets}` : '';
  $('#txt').textContent = s.kind === 'prep' ? '' : s.text || '';
  $('#bar').style.width = `${s.dur === Infinity ? 0 : Math.min(100, (e / s.dur) * 100)}%`;
  $('#info').textContent = s.kind === 'prep' ? `${summary(R.m, R.c)} · tocca per partire subito` : s.up ? (s.dur !== Infinity ? `Time cap ${fmt(s.dur)}` : '') : R.m === 'amrap' ? `di ${fmt(s.dur)}` : nextInfo();
  document.body.dataset.kind = s.kind + (!s.up && left <= 3.05 && s.kind !== 'prep' ? ' last' : '');
}
// spinte del coach nei tratti lunghi (AMRAP, AFAP col cap, intervalli lunghi)
function motivate(s, e, left, sec) {
  if (s.dur < 60) return;
  if (sec === 10 && s.dur >= 120) return coach('sec10');
  if (s.dur >= 240 && sec === 60) return coach('min1') || say('Un minuto alla fine');
  if (s.dur >= 480 && sec === Math.round(s.dur / 2)) return coach('meta');
  if (R.m !== 'amrap' || !R.laps.length) return;
  // AMRAP: il ritmo medio dice se il giro in corso si chiude prima della fine
  const done = workTime(), avg = R.laps.at(-1) / R.laps.length, cur = done - R.laps.at(-1);
  if (!R.saidGiro && left > 12 && left < avg && cur + left >= avg * 0.85) { R.saidGiro = 1; return coach('ungiro'); }
  // giro molto più lento del solito: una spinta (una volta per giro)
  if (R.saidLento !== R.laps.length && cur > Math.max(45, avg * 1.6) && left > 20) { R.saidLento = R.laps.length; coach('lento'); }
}
function nextInfo() {
  const n = R.S[R.i + 1];
  if (!n) return 'Ultimo!';
  if (n.kind === 'rest') return `Dopo: ${n.long ? 'recupero serie' : 'recupero'} ${secTxt(n.dur)}`;
  return `Dopo: ${n.text || (n.set !== R.S[R.i].set ? `serie ${n.set}` : n.label === 'EMOM' || n.label === 'LAVORO' ? `round ${n.round}` : n.label.toLowerCase())}`;
}
// AFAP: il risultato è il tempo fatto (o "TIME CAP" se è scaduto). "FINITO" durante il preparati non vale.
function finish(timeUp) {
  if (!timeUp && R.S[R.i].kind !== 'work') return;
  R.done = true; clearInterval(R.iv);
  if (R.m === 'afap') R.result = timeUp ? 'TIME CAP' : fmt(Math.floor(elapsed()));
  beep(1320, 300); setTimeout(() => beep(1760, 500), 320);
  coach('fine') || say('Finito! Daje!');
  sleepOk();
  R.when = Date.now(); R.dur = workTime();
  if (R.m === 'amrap') { R.rounds = R.laps.length; R.items.forEach((it) => (it.n = 0)); }
  logSave();
  location.hash = '#fine';
}
function stop(home = true) {
  if (R) { clearInterval(R.iv); sleepOk(); }
  R = null; window.speechSynthesis?.cancel(); document.body.classList.remove('paused'); delete document.body.dataset.kind;
  if (home) location.hash = '#home';
}

// risultato in una riga, per la fine e per il diario
function resultOf(r) {
  if (r.m === 'afap') return r.result;
  if (r.m === 'amrap') {
    const part = r.items.filter((it) => it.n > 0).map((it) => `${it.n} ${it.name || 'esercizio'}`);
    return `${r.rounds} ${r.rounds === 1 ? 'giro' : 'giri'}${part.length ? ` + ${part.join(', ')}` : ''}`;
  }
  return 'Completato';
}
// diario: ogni timer finito si salva da solo, con data e ora (massimo 500)
function logSave() {
  const log = ls.get('log', []).filter((x) => x.id !== R.when);
  const items = R.m === 'afap' ? R.items.map((it) => ({ name: it.name, reps: it.reps, n: it.n, ok: it.ok })) : R.m === 'amrap' ? R.items.filter((it) => it.n > 0).map((it) => ({ name: it.name, n: it.n })) : [];
  log.unshift({ id: R.when, m: R.m, c: R.c, title: R.title || '', res: resultOf(R), dur: Math.round(R.dur), laps: R.laps.map(Math.round), items });
  ls.set('log', log.slice(0, 500));
}
const when = (t) => new Date(t).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function end() {
  if (!R?.done) return (location.hash = '#home');
  const { m, c, laps, items, title } = R;
  delete document.body.dataset.kind; document.body.classList.remove('paused');
  const lapList = laps.length ? `<div class="laps">${laps.map((t, j) => `<span><em>${j + 1}</em>${fmt(t - (laps[j - 1] || 0))}</span>`).join('')}</div>` : '';
  const itemList = m === 'afap' && items.length ? `<div class="laps items">${items.map((it) => `<span class="${it.ok ? 'ok' : ''}">${it.ok ? '✓' : '·'} ${esc(it.name || 'Esercizio')}${it.reps ? ` ${it.n}/${it.reps}` : ''}</span>`).join('')}</div>` : '';
  // AMRAP: giri completi (si possono correggere) + cosa hai fatto del giro non finito
  const amrapBox = m === 'amrap' ? `<div class="field am"><label>Giri completi</label>
      <div class="stepper"><button data-g="-1">−</button><output id="giri">${R.rounds}</output><button data-g="1">+</button></div></div>
    ${items.length ? `<div class="field am"><label>Giro non finito: quante ne hai fatte?</label><div class="list">${items.map((it, j) => `<div class="li part">
      <span class="pn">${esc(it.name || 'Esercizio')}${it.reps ? ` <small>/ ${it.reps}</small>` : ''}</span>
      <button data-p="${j}" data-d="-1">−</button><output data-po="${j}">${it.n}</output><button data-p="${j}" data-d="1">+</button>
      ${it.reps ? `<button class="all" data-pa="${j}">TUTTE</button>` : ''}</div>`).join('')}</div></div>` : ''}` : '';
  app.innerHTML = `<main class="page end" style="--accent:${MODES[m].col}"><h1>DAJE!</h1>
    <div class="res"><small>${esc(title || MODES[m].name)} · ${summary(m, c)}</small><b id="big">${m === 'it' || m === 'emom' ? 'FATTO!' : resultOf(R)}</b>${lapList}${itemList}
      <span class="when">${when(R.when)} · ${fmt(R.dur)} di lavoro · salvato nel diario</span></div>
    ${amrapBox}
    <div class="row"><button id="again" class="go">RIFAI</button><a class="btn" href="#home">HOME</a></div>
    <a class="promo" href="${PROVA}" target="_blank" rel="noopener"><div><small>VUOI UN WORKOUT GIÀ PRONTO?</small><b>PROVA I NOSTRI ALLENAMENTI</b></div><i>›</i></a></main>`;
  const upd = () => { $('#big').textContent = resultOf(R); logSave(); };
  app.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { R.rounds = Math.max(0, R.rounds + Number(b.dataset.g)); $('#giri').textContent = R.rounds; upd(); }));
  const setP = (j, v) => { const it = items[j]; it.n = Math.max(0, it.reps ? Math.min(it.reps, v) : v); app.querySelector(`[data-po="${j}"]`).textContent = it.n; upd(); };
  app.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => setP(b.dataset.p, items[b.dataset.p].n + Number(b.dataset.d))));
  app.querySelectorAll('[data-pa]').forEach((b) => (b.onclick = () => setP(b.dataset.pa, items[b.dataset.pa].reps)));
  $('#again').onclick = () => start(m, c, title);
}

// diario dei workout fatti, raggruppati per giorno
function diary() {
  const log = ls.get('log', []);
  let day = '';
  const rows = log.map((x) => {
    const d = new Date(x.id).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const head = d !== day ? `<h2>${(day = d)}</h2>` : '';
    const det = x.items?.length && x.m === 'afap' ? x.items.map((it) => `${it.ok ? '✓' : '·'} ${esc(it.name || 'Esercizio')}${it.reps ? ` ${it.n}/${it.reps}` : ''}`).join(' &nbsp; ') : '';
    return `${head}<div class="sv lg" style="--c:${MODES[x.m].col}"><div class="lgx"><small>${MODES[x.m].name} · ${new Date(x.id).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</small>
      <b>${esc(x.res)}</b><span>${x.title ? esc(x.title) + ' · ' : ''}${summary(x.m, { ...clone(MODES[x.m].def), ...x.c })}${x.dur ? ` · ${fmt(x.dur)}` : ''}</span>${det ? `<span>${det}</span>` : ''}</div>
      <button data-redo="${x.id}" aria-label="Rifai">↻</button><button data-dl="${x.id}" aria-label="Elimina">✕</button></div>`;
  }).join('');
  app.innerHTML = `<main class="page">${back('DIARIO')}
    ${rows || '<p class="muted">Qui trovi ogni workout finito, con data, ora e risultato. Si salvano da soli.</p>'}</main>`;
  app.querySelectorAll('[data-redo]').forEach((b) => (b.onclick = () => { const x = log.find((y) => y.id == b.dataset.redo); start(x.m, { ...clone(MODES[x.m].def), ...x.c }, x.title); }));
  app.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = async () => {
    if (!(await ask('Eliminare questo workout dal diario?', { ok: 'Elimina' }))) return;
    ls.set('log', ls.get('log', []).filter((y) => y.id != b.dataset.dl)); diary();
  }));
}

// "Workout": l'unico posto dove si parla di UN-MEMBER, con un link esterno
function workout() {
  app.innerHTML = `<main class="page">${back('WORKOUT')}
    <section class="wk"><h1>VUOI PROVARE I NOSTRI WORKOUT?</h1>
      <p>${NAME} è gratis e resta gratis. Se vuoi anche gli allenamenti già pronti, li trovi su <b>UN-MEMBER</b>, l'app di Alessio · UN-COACH.</p>
      <ul><li>🎥 Video di ogni esercizio</li><li>⏱ Timer e voce che ti guidano</li><li>🏋️ Kettlebell, TRX e corpo libero, a casa o al parco</li><li>📅 La tua settimana pronta ogni giorno</li></ul>
      <a class="go" href="${PROVA}" target="_blank" rel="noopener">PROVA 7 GIORNI GRATIS</a>
    </section></main>`;
}

function settings() {
  const o = opts();
  const draw = () => {
    app.innerHTML = `<main class="page">${back('IMPOSTAZIONI')}
      <label class="sw"><span>Voce</span><input type="checkbox" id="voice" ${o.voice ? 'checked' : ''}></label>
      <label class="sw"><span>Spinte del coach (voce romana)</span><input type="checkbox" id="push" ${o.push !== false ? 'checked' : ''}></label>
      <label class="sw"><span>Bip</span><input type="checkbox" id="beep" ${o.beep ? 'checked' : ''}></label>
      <div class="field"><label>Conto alla rovescia prima di partire</label>
        <div class="chips">${[0, 5, 10, 15].map((v) => `<button data-p="${v}" class="${o.prep === v ? 'on' : ''}">${v ? v + 's' : 'No'}</button>`).join('')}</div></div>
      <p class="muted small">${NAME} è gratuito, funziona anche senza internet e non raccoglie dati: tutto resta sul tuo telefono. <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p></main>`;
    $('#voice').onchange = (e) => { o.voice = e.target.checked; ls.set('opts', o); if (o.voice) say('Voce attiva'); };
    $('#push').onchange = (e) => { o.push = e.target.checked; ls.set('opts', o); if (o.push) { coachAt = 0; coach('via'); } };
    $('#beep').onchange = (e) => { o.beep = e.target.checked; ls.set('opts', o); beep(); };
    app.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { o.prep = Number(b.dataset.p); ls.set('opts', o); draw(); }));
  };
  draw();
}

// ---------- router ----------
function route() {
  const h = location.hash.slice(1) || 'home';
  if (h !== 'run' && h !== 'fine' && R && !R.done) stop(false);
  if (h !== 'run') { delete document.body.dataset.kind; document.body.classList.remove('paused'); }
  closeAsk(); document.querySelector('.drawer')?.remove();
  window.scrollTo(0, 0);
  if (h === 'run') return run();
  if (h === 'fine') return end();
  const sm = h.match(/^set-(\w+?)(?:-(\d+))?$/);
  if (sm) return setup(sm[1], sm[2] != null ? Number(sm[2]) : null);
  if (h === 'workout') return workout();
  if (h === 'salvati') return savedPage();
  if (h === 'diario') return diary();
  if (h === 'impostazioni') return settings();
  home();
}
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (location.hash !== '#run' || !R || R.done) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ($('#plus') || $('#pause')).click(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
});
route();
