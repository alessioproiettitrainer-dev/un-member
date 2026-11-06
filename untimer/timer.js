// UN-TIMER: app a sé, gratuita. Timer EMOM, AMRAP, AFAP e HIIT, senza video e senza account.
// Lingue: romano (voce di Alessio) e inglese (slang americano, voce maschile generata). T('it', 'en') sceglie il testo.
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

const opts = () => ({ voice: true, beep: true, prep: 10, ...ls.get('opts', {}) });
// lingua: 'rm' romano o 'en' inglese (la prima volta dal telefono)
let LANG = opts().lang === 'en' ? 'en' : opts().lang ? 'rm' : /^it/i.test(navigator.language || '') ? 'rm' : 'en';
const T = (it, en) => (LANG === 'en' ? en : it);
const LOC = () => T('it-IT', 'en-US');
document.documentElement.lang = T('it', 'en');

const MODES = {
  emom: { name: 'EMOM', col: '#ffc21a', sub: () => T('Ogni X secondi, per X round', 'Every X seconds, for X rounds'), def: { every: 60, rounds: 10, slots: [{ text: '', rest: false }] } },
  amrap: { name: 'AMRAP', col: '#ff7a00', sub: () => T('Più giri possibili nel tempo', 'As many rounds as possible'), def: { minutes: 12, items: [] } },
  afap: { name: 'AFAP', col: '#ff4d6d', sub: () => T('Il più veloce possibile', 'As fast as possible'), def: { cap: 0, items: [] } },
  it: { name: 'HIIT', col: '#35d07f', sub: () => T('Lavoro / recupero a intervalli', 'Work / rest intervals'), def: { work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 } },
};
const cfgOf = (m) => ({ ...clone(MODES[m].def), ...ls.get('cfg_' + m, {}) });

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
const secTxt = (s) => (s < 60 ? `${s}s` : s % 60 ? fmt(s) : `${s / 60} min`);
const slotName = (c, j) => (c.every === 60 ? T('Minuto ', 'Minute ') : T('Intervallo ', 'Interval ')) + (j + 1);
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const emomTotal = (c) => c.every * c.slots.length * c.rounds;
const itTotal = (c) => ((c.work + c.rest) * c.rounds - c.rest) * c.sets + (c.sets - 1) * c.setRest;
function summary(m, c) {
  const ex = (n) => pl(n, T('esercizio', 'exercise'), T('esercizi', 'exercises'));
  if (m === 'emom') return `${T('ogni', 'every')} ${secTxt(c.every)}${c.slots.length > 1 ? ` · ${c.slots.length} ${T('intervalli a giro', 'intervals per round')}` : ''} · ${pl(c.rounds, 'round', 'rounds').replace(/rounds$/, T('round', 'rounds'))} · ${fmt(emomTotal(c))}`;
  if (m === 'amrap') return `${pl(c.minutes, T('minuto', 'minute'), T('minuti', 'minutes'))}${c.items?.length ? ` · ${ex(c.items.length)}` : ''}`;
  if (m === 'afap') return `${c.items.length ? `${ex(c.items.length)} · ` : ''}${c.cap ? `time cap ${c.cap} min` : T('senza time cap', 'no time cap')}`;
  return `${c.work}s / ${c.rest}s × ${c.rounds}${c.sets > 1 ? ` · ${c.sets} ${T('serie', 'sets')} (${secTxt(c.setRest)} ${T('tra le serie', 'between sets')})` : ''} · ${fmt(itTotal(c))}`;
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
let VOICE = null, VOICE_EN = null;
const pickVoice = () => {
  const all = speechSynthesis.getVoices() || [];
  const rank = (v) => (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0);
  // inglese: meglio una voce maschile americana (i nomi cambiano da telefono a telefono)
  const male = (v) => (/\bmale\b|guy|david|alex|daniel|fred|tom\b|aaron|evan|nathan|x-iom|x-tpd|x-iol/i.test(v.name) ? 6 : 0) + (/^en-us/i.test(v.lang) ? 1 : 0);
  VOICE = all.filter((v) => /^it/i.test(v.lang)).sort((a, b) => rank(b) - rank(a))[0] || null;
  VOICE_EN = all.filter((v) => /^en/i.test(v.lang)).sort((a, b) => male(b) + rank(b) - male(a) - rank(a))[0] || null;
};
if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
function say(t) {
  if (!opts().voice || !window.speechSynthesis || !t) return;
  speechSynthesis.cancel();
  const en = LANG === 'en';
  const u = new SpeechSynthesisUtterance(en ? t : t.replace(/\bemom\b/gi, 'èmom').replace(/\bamrap\b/gi, 'àmrap').replace(/\bafap\b/gi, 'àfap'));
  const v = en ? VOICE_EN : VOICE;
  if (v) u.voice = v;
  u.lang = en ? (v?.lang || 'en-US') : 'it-IT';
  if (en) u.pitch = 0.85; // un po' più grave
  speechSynthesis.speak(u);
}

// ---------- voce del coach: romano (Alessio) e inglese ----------
// Ogni momento ha più frasi, scelte a caso, nella stessa posizione in COACH.rm / COACH.it / COACH.en.
// Romano: se c'è la registrazione di Alessio (voce/<momento>-<n>.mp3, elencata in AUDIO) parte quella, altrimenti
// la voce del telefono legge la frase in italiano. Inglese: file generati in voce/en/ (AUDIO_EN). Max una frase ogni 6 s.
const COACH = {
  rm: {
    pronti: ['Preparate, se parte!', "Mo' se comincia!", 'Mettete in posizione!'],
    via: ['Daje, partiamo!', 'Vai, è tutto tuo!', 'Daje che se incomincia!'],
    pausa: ['Pausa. Riparti quando sei pronto.', "Fermo 'n attimo, poi se riparte."],
    riprendi: ['Riprendi, daje!', 'Ripartiamo, forza!'],
    meta: ['Metà fatta, nun mollà!', 'Sta a metà, tieni botta!', "Metà fatta, mo' viene er bello!"],
    min1: ['Ultimo minuto, mo o mai più!', "Manca 'n minuto, daje a tutta!", 'Un minuto, svuota er serbatoio!'],
    sec10: ['Dieci secondi, spigni!', 'Ultimi dieci, nun te fermà!', 'Dieci secondi, daje daje daje!'],
    ultimo: ['Ultimo round, daje a tutta!', "L'ultimo e poi te riposi!", "Oh, l'ultimo, fallo bene!"],
    fine: ['Grande, daje!', "Fatto! Sei 'na bestia!", 'Bravo, mo riposa!', 'Bravo, oggi te lo sei guadagnato!'],
    giroemom: ["N'antro minuto, vai!", 'Daje sotto, riparti!', 'Daje che se ricomincia!'],
    lavoro: ['Vai!', 'Spigni!', 'Daje a tutta!'],
    recupero: ['Recupera e respira.', 'Riprendi fiato, che se riparte.', 'Respira e sciogli le spalle.'],
    serie: ['Serie finita, bravo, recupera!', 'Una serie de meno, respira!'],
    giro: ["Bravo, n'antro giro!", 'Così se fa!', 'Giro chiuso, avanti!'],
    veloce: ['Ao, stai a volà!', 'Che ritmo! Nun calà, me raccomando!'],
    lento: ['Oh, nun te fermà!', 'Mi sa che facevi più giri de mi nonna!', 'Forza che nun è finita!'],
    ungiro: ['Er giro ce lo fai, daje!', "Manca solo 'n giro, chiudilo eh!", "Ce l'hai quasi fatta, manca solo sto giro, daje a tutta!"],
    afap: ['Forza che ce stai!', 'Oh, tieni duro eh!', "Nun mollà, testa bassa e spigni come 'n treno!"],
    esfatto: ['Uno in meno!', 'Via questo, sotto col prossimo!', 'Fatto, avanti!'], // da registrare
    esultimo: ['Ultimo esercizio, chiudilo!', 'Ultimo esercizio, fallo fatto bene!'],
    conto: ['Tre', 'Due', 'Uno'], // al posto dei bip negli ultimi 3 secondi
  },

  // it: non è una lingua dell'app, serve solo alla voce del telefono finché mancano le registrazioni romane
  it: {
    pronti: ['Preparati, si parte!', 'Si comincia!', 'In posizione!'],
    via: ['Via, partiamo!', 'Vai, è tutto tuo!', 'Forza, si comincia!'],
    pausa: ['Pausa. Riparti quando sei pronto.', 'Fermo un attimo, poi si riparte.'],
    riprendi: ['Riprendi, forza!', 'Ripartiamo, forza!'],
    meta: ['Metà fatta, non mollare!', 'Sei a metà, tieni duro!', 'Metà fatta, adesso viene il bello!'],
    min1: ['Ultimo minuto, ora o mai più!', 'Manca un minuto, dai tutto!', 'Un minuto, svuota il serbatoio!'],
    sec10: ['Dieci secondi, spingi!', 'Ultimi dieci, non fermarti!', 'Dieci secondi, dai dai dai!'],
    ultimo: ['Ultimo round, dai tutto!', "L'ultimo e poi riposi!", "L'ultimo, fallo bene!"],
    fine: ['Grande!', 'Fatto! Sei una bestia!', 'Bravo, ora riposa!', 'Bravo, oggi te lo sei guadagnato!'],
    giroemom: ['Un altro minuto, vai!', 'Sotto, riparti!', 'Su, si ricomincia!'],
    lavoro: ['Vai!', 'Spingi!', 'Dai tutto!'],
    recupero: ['Recupera e respira.', 'Riprendi fiato, che si riparte.', 'Respira e sciogli le spalle.'],
    serie: ['Serie finita, bravo, recupera!', 'Una serie in meno, respira!'],
    giro: ['Bravo, un altro giro!', 'Così si fa!', 'Giro chiuso, avanti!'],
    veloce: ['Stai volando!', 'Che ritmo, non calare!'],
    lento: ['Non fermarti!', 'Forza, accelera!', 'Forza, non è finita!'],
    ungiro: ['Il giro ce lo fai, forza!', 'Manca solo un giro, chiudilo!', "Ce l'hai quasi fatta, chiudi questo giro!"],
    afap: ['Forza che ce la fai!', 'Tieni duro!', 'Non mollare, testa bassa e spingi!'],
    esfatto: ['Uno in meno!', 'Via questo, sotto col prossimo!', 'Fatto, avanti!'],
    esultimo: ['Ultimo esercizio, chiudilo!', 'Ultimo esercizio, fallo bene!'],
    conto: ['Tre', 'Due', 'Uno'],
  },

  en: {
    pronti: ['Get set. Here we go.', "Lock in. Clock's about to roll.", 'You ready? Time to work.'],
    via: ["Let's go!", "Go time. It's all yours!", "Let's get it!"],
    pausa: ["Paused. Go again when you're ready.", 'Take a beat. Then we roll.'],
    riprendi: ['Back at it!', 'Get back in there!'],
    meta: ["Halfway. Don't you quit on me!", 'Halfway there. Stay in it!', 'Halfway. Now it gets real.'],
    min1: ['One minute. Now or never!', 'One minute left. Leave it all out here!', 'Sixty seconds. Empty the tank!'],
    sec10: ['Ten seconds, push!', "Last ten, don't stop!", 'Ten seconds, go go go!'],
    ultimo: ['Last round. Dig deep!', 'Last one, then you rest!', 'Last one. Make it count!'],
    fine: ['Done! Hell yeah!', "That's it! You're a beast!", 'Good work. Now rest up.', 'Finished! You earned this one.'],
    giroemom: ['Next minute, go!', 'Back to work!', 'Here we go again!'],
    lavoro: ['Go!', 'Push!', 'Give it everything!'],
    recupero: ['Recover. Breathe.', 'Catch your breath, we go again.', 'Breathe. Shake it out.'],
    serie: ['Set done, good work! Recover.', 'One set down! Breathe.'],
    giro: ['Nice, another round!', "That's how it's done!", 'Round done, keep moving!'],
    veloce: ["You're flying!", "Great pace, don't slow down!"],
    lento: ["Hey, don't you stop now!", 'Breathe and get moving!', "Come on, it ain't over!"],
    ungiro: ['You got one more round in you, go!', 'One more round, close it out!', "You're right there, finish this round!"],
    afap: ['Keep pushing, you got this!', 'Stay tough!', "Don't quit. Head down, grind!"],
    esfatto: ['One down!', 'Done. Next one!', 'Knock it out, keep moving!'],
    esultimo: ['Last movement, finish it!', "That's the last one, empty it!"],
    conto: ['Three', 'Two', 'One'],
  },
};
// romano: le registrazioni di Alessio in voce/ (6/11/2026). Mancano esfatto-1/2/3: lì legge il telefono.
const AUDIO = new Set(["afap-1","afap-2","afap-3","conto-1","conto-2","conto-3","esultimo-1","esultimo-2","fine-1","fine-2","fine-3","fine-4","giro-1","giro-2","giro-3","giroemom-1","giroemom-2","giroemom-3","lavoro-1","lavoro-2","lavoro-3","lento-1","lento-2","lento-3","meta-1","meta-2","meta-3","min1-1","min1-2","min1-3","pausa-1","pausa-2","pronti-1","pronti-2","pronti-3","recupero-1","recupero-2","recupero-3","riprendi-1","riprendi-2","sec10-1","sec10-2","sec10-3","serie-1","serie-2","ultimo-1","ultimo-2","ultimo-3","ungiro-1","ungiro-2","ungiro-3","veloce-1","veloce-2","via-1","via-2","via-3"]);
// inglese: tutti i file generati in voce/en/ (tranne il conto, che resta coi bip)
const AUDIO_EN = new Set(Object.entries(COACH.en).flatMap(([k, l]) => (k === 'conto' ? [] : l.map((_, i) => `${k}-${i + 1}`))));
let coachAt = 0, coachAu = null;
function coach(ev, fixed) {
  const o = opts(), list = COACH[LANG]?.[ev] || COACH.it[ev];
  if (!o.voice || !list || (o.push === false && ev !== 'fine')) return false;
  const now = Date.now();
  const n = fixed ?? Math.floor(Math.random() * list.length), id = `${ev}-${n + 1}`;
  const file = LANG === 'en' ? AUDIO_EN.has(id) && `voce/en/${id}.mp3` : LANG === 'rm' && AUDIO.has(id) && `voce/${id}.mp3`;
  if (ev === 'conto' && !file) return false; // il conto con la voce del telefono no: bastano i bip
  if (now - coachAt < 6000 && !['fine', 'conto', 'pausa', 'riprendi'].includes(ev)) return false;
  if (ev !== 'conto') coachAt = now; // il conto non blocca la frase che viene subito dopo
  // senza registrazione: la voce del telefono (il romano lo legge in italiano)
  const text = LANG === 'en' ? list[n] : COACH.it[ev][n];
  if (file) {
    window.speechSynthesis?.cancel(); coachAu?.pause();
    coachAu = new Audio(file); coachAu.play().catch(() => say(text));
  } else say(text);
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
  if (prep) S.push({ kind: 'prep', dur: prep, label: T('PREPARATI', 'GET READY') });
  if (m === 'emom') for (let r = 1; r <= c.rounds; r++) c.slots.forEach((sl, j) => S.push({
    kind: sl.rest ? 'rest' : 'work', dur: c.every, round: r, of: c.rounds, text: sl.text,
    rnd: !sl.rest && c.slots.length === 1, label: sl.rest ? T('RECUPERO', 'REST') : c.slots.length > 1 ? slotName(c, j).toUpperCase() : 'EMOM' }));
  if (m === 'amrap') S.push({ kind: 'work', dur: c.minutes * 60, label: 'AMRAP', laps: true });
  if (m === 'afap') S.push({ kind: 'work', dur: c.cap ? c.cap * 60 : Infinity, label: 'AFAP', up: true, laps: !c.items.length });
  if (m === 'it') for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.rounds; r++) {
      S.push({ kind: 'work', dur: c.work, round: r, of: c.rounds, set: s, sets: c.sets, rnd: true, label: T('LAVORO', 'WORK') });
      if (c.rest && r < c.rounds) S.push({ kind: 'rest', dur: c.rest, round: r, of: c.rounds, set: s, sets: c.sets, label: T('RECUPERO', 'REST') });
    }
    if (s < c.sets && c.setRest) S.push({ kind: 'rest', dur: c.setRest, set: s, sets: c.sets, label: T('RECUPERO SERIE', 'SET REST'), long: true });
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
    <a href="#home">⏱<span>Timer</span></a><a href="#salvati">★<span>${T('I miei timer', 'My timers')}</span></a><a href="#diario">📅<span>${T('Diario', 'Log')}</span></a>
    <a href="#workout">🔥<span>${T('Prova i nostri workout', 'Try our workouts')}</span></a><a href="#impostazioni">⚙︎<span>${T('Impostazioni', 'Settings')}</span></a></aside>`;
  d.onclick = (e) => { if (e.target === d || e.target.closest('a')) d.remove(); };
  document.body.append(d);
}
const back = (title) => `<header class="top"><a href="#home" class="back" aria-label="${T('Indietro', 'Back')}">‹</a><h1>${title}</h1></header>`;
const stepper = (k, label, val, shown) => `<div class="field"><label>${label}</label>
  <div class="stepper"><button data-k="${k}" data-d="-1">−</button><output>${shown ?? val}</output><button data-k="${k}" data-d="1">+</button></div></div>`;

function home() {
  const n = ls.get('saved', []).length;
  app.innerHTML = `<main class="home"><header class="hbar">${menuBtn}</header>
    ${logo(true)}
    <div class="pills">${Object.entries(MODES).map(([k, m]) => `<a class="pill" href="#set-${k}" style="--c:${m.col}"><b>${m.name}</b><span>${m.sub()}</span></a>`).join('')}</div>
    <div class="hfoot"><div class="hlinks"><a href="#salvati">★ ${T('I MIEI TIMER', 'MY TIMERS')}${n ? ` <em>${n}</em>` : ''}</a><a href="#diario">📅 ${T('DIARIO', 'LOG')}</a></div><a href="#workout" class="hpromo">${T('Vuoi provare i nostri workout?', 'Want our workouts?')} <b>${T('Prova gratis', 'Try free')} ›</b></a></div>
  </main>`;
  $('#burger').onclick = openMenu;
}

function savedPage() {
  const saved = ls.get('saved', []);
  app.innerHTML = `<main class="page">${back(T('I MIEI TIMER', 'MY TIMERS'))}
    ${saved.length ? `<div class="saved">${saved.map((s, i) => `<div class="sv" style="--c:${MODES[s.m].col}"><a href="#set-${s.m}-${i}"><small>${MODES[s.m].name}</small><b>${esc(s.name)}</b><span>${summary(s.m, s.c)}</span></a><button data-del="${i}" aria-label="${T('Elimina', 'Delete')}">✕</button></div>`).join('')}</div>`
    : `<p class="muted">${T('Ancora niente. Prepara un timer e premi "Salva questo timer": lo ritrovi qui, pronto da far partire.', 'Nothing yet. Set up a timer and tap "Save this timer": it shows up here, ready to go.')}</p>`}
  </main>`;
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    const s = ls.get('saved', []);
    if (!(await ask(`${T('Eliminare', 'Delete')} "${s[b.dataset.del].name}"?`, { ok: T('Elimina', 'Delete') }))) return;
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
    if (m === 'emom') body = `<div class="field"><label>${T('Ogni', 'Every')}</label>
        <div class="chips">${[30, 45, 60, 90, 120].map((v) => `<button data-every="${v}" class="${c.every === v ? 'on' : ''}">${secTxt(v)}</button>`).join('')}</div>
        <div class="stepper"><button data-k="every" data-d="-1">−</button><output>${secTxt(c.every)}</output><button data-k="every" data-d="1">+</button></div></div>
      <div class="field"><label>${T('Intervalli di ogni giro', 'Intervals in each round')}</label>
        <div class="list">${c.slots.map((sl, j) => `<div class="li ${sl.rest ? 'isrest' : ''}"><em>${j + 1}</em>
          ${sl.rest ? `<span class="restlab">${T('RECUPERO', 'REST')}</span>` : `<input data-slot="${j}" value="${esc(sl.text)}" placeholder="${slotName(c, j)}: ${T('esercizio (facoltativo)', 'exercise (optional)')}" maxlength="60">`}
          <button data-rest="${j}" class="tg ${sl.rest ? 'on' : ''}" title="${T('Recupero', 'Rest')}">💤</button>${c.slots.length > 1 ? `<button data-rm="${j}" class="rm">✕</button>` : ''}</div>`).join('')}</div>
        <div class="row2"><button class="add" data-addslot="0">+ ${T('Intervallo', 'Interval')}</button><button class="add" data-addslot="1">+ ${T('Recupero', 'Rest')}</button></div></div>
      ${stepper('rounds', T('Round (giri completi)', 'Rounds'), c.rounds)}`;
    const items = (label, hint) => `<div class="field"><label>${label}</label>
        <div class="list">${c.items.map((it, j) => `<div class="li"><input data-reps="${j}" class="reps" type="number" inputmode="numeric" value="${it.reps || ''}" placeholder="${T('rip', 'reps')}">
          <input data-name="${j}" value="${esc(it.name)}" placeholder="${T('Esercizio', 'Exercise')}" maxlength="40"><button data-rmi="${j}" class="rm">✕</button></div>`).join('') || `<p class="muted small">${hint}</p>`}</div>
        <div class="row2"><button class="add" id="addi">+ ${T('Esercizio', 'Exercise')}</button>${c.items.length ? `<button class="add" id="clr">${T('Cancella tutto', 'Clear all')}</button>` : ''}</div></div>`;
    if (m === 'amrap') body = stepper('minutes', T('Durata', 'Time'), c.minutes, `${c.minutes} min`)
      + items(T('Il workout (esercizi di un giro, facoltativo)', 'The workout (one round, optional)'), T('Es. 10 Swing, 8 Burpees, 6 Goblet Squat. Durante il timer premi "+1 GIRO" a ogni giro chiuso; alla fine segni cosa hai fatto del giro non finito.', 'E.g. 10 Swings, 8 Burpees, 6 Goblet Squats. Tap "+1 ROUND" every round; at the end you log what you did of the unfinished round.'));
    if (m === 'afap') body = items(T('Esercizi (facoltativo)', 'Exercises (optional)'), T('Es. 100 Burpees, 50 Swing… Durante il timer segni quante ne hai fatte e spunti quelli finiti.', 'E.g. 100 Burpees, 50 Swings… During the timer you log your reps and check off what is done.'))
      + stepper('cap', 'Time cap', c.cap, c.cap ? `${c.cap} min` : T('nessuno', 'none'));
    if (m === 'it') body = `<div class="pair">${stepper('work', T('Lavoro', 'Work'), c.work, secTxt(c.work))}${stepper('rest', T('Recupero', 'Rest'), c.rest, secTxt(c.rest))}</div>
      ${stepper('rounds', 'Round', c.rounds)}
      <div class="pair">${stepper('sets', T('Ripeti tutto (serie)', 'Repeat all (sets)'), c.sets, `${c.sets}×`)}${c.sets > 1 ? stepper('setRest', T('Recupero tra le serie', 'Rest between sets'), c.setRest, secTxt(c.setRest)) : ''}</div>`;
    app.innerHTML = `<main class="page" style="--accent:${M.col}">${back(saved ? esc(saved.name) : M.name)}
      <p class="muted">${M.sub()}</p>${body}
      <p class="sum">${summary(m, c)}</p>
      <button class="go" id="go">${T('VIA', 'GO')}</button>
      <button class="ghost" id="save">💾 ${saved ? T('Salva modifiche', 'Save changes') : T('Salva questo timer', 'Save this timer')}</button></main>`;
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
    if ($('#clr')) $('#clr').onclick = async () => { if (await ask(T('Cancellare tutti gli esercizi?', 'Clear all exercises?'), { ok: T('Cancella', 'Clear') })) { c.items = []; keep(); draw(); } };
    $('#go').onclick = () => start(m, clean(m, c), saved?.name);
    $('#save').onclick = async () => {
      const s = ls.get('saved', []);
      if (saved) { s[savedIdx] = { ...saved, c: clean(m, c) }; ls.set('saved', s); toast(T('Salvato', 'Saved')); return; }
      const name = await ask(T('Come lo chiami?', 'Name it'), { ok: T('Salva', 'Save'), input: `${M.name} ${summary(m, c).split(' · ')[0]}` });
      if (!name) return;
      s.unshift({ name: name.slice(0, 40), m, c: clean(m, c) }); ls.set('saved', s); toast(T('Salvato in "I miei timer" ★', 'Saved to "My timers" ★'));
    };
  };
  draw();
}
// toglie le righe vuote prima di partire / salvare
const clean = (m, c) => (c.items ? { ...clone(c), items: c.items.filter((it) => it.name.trim() || it.reps).map((it) => ({ name: it.name.trim(), reps: it.reps || 0 })) } : clone(c));
// finestra di conferma / nome dentro l'app (confirm e prompt del browser non vanno ovunque)
let askEl = null;
const closeAsk = () => { askEl?.remove(); askEl = null; };
function ask(text, { ok = T('Sì', 'Yes'), input = null } = {}) {
  closeAsk(); document.querySelector('.drawer')?.remove();
  return new Promise((res) => {
    askEl = Object.assign(document.createElement('div'), { className: 'ask' });
    askEl.innerHTML = `<div class="askbox"><p>${esc(text)}</p>${input != null ? `<input id="askin" maxlength="40" value="${esc(input)}">` : ''}
      <div class="row"><button class="btn" data-a="0">${T('Annulla', 'Cancel')}</button><button class="go" data-a="1">${esc(ok)}</button></div></div>`;
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
    ${wod ? `<div class="wod">${R.items.map((it) => `<div><b>${it.reps || ''}</b>${esc(it.name || T('Esercizio', 'Exercise'))}</div>`).join('')}</div>` : ''}
    ${afapList ? `<div class="checklist">${R.items.map((it, j) => `<div class="ck" data-i="${j}"><button class="box" data-ok="${j}"></button>
        <div class="nm"><b>${esc(it.name || `${T('Esercizio', 'Exercise')} ${j + 1}`)}</b><span>${it.reps ? `<i>0</i> / ${it.reps}` : ''}</span></div>
        ${it.reps ? [1, 5, 10].map((v) => `<button class="pl" data-add="${j}" data-v="${v}">+${v}</button>`).join('') : ''}</div>`).join('')}</div>` : ''}
    <div class="ctrl">${R.S.some((s) => s.laps) ? `<button class="round" id="plus">${T('+1 GIRO', '+1 ROUND')}<small id="rc">${T('0 giri', '0 rounds')}</small></button>` : ''}
      <div class="row"><button id="pause">${T('PAUSA', 'PAUSE')}</button>${R.m === 'afap' ? `<button id="fin" class="fin">${T('FINITO', 'DONE')}</button>` : `<button id="skip">${T('SALTA', 'SKIP')} ›</button>`}</div></div></main>`;
  $('#stop').onclick = async () => { if (await ask(T('Vuoi chiudere il timer?', 'Stop the timer?'), { ok: T('Chiudi', 'Stop') })) stop(); };
  $('#pause').onclick = togglePause;
  // durante il "preparati" un tocco sul timer fa partire subito
  $('.clock').onclick = () => { if (R.S[R.i].kind === 'prep' && !R.pauseAt) jump(); };
  if ($('#plus')) $('#plus').onclick = () => {
    if (R.S[R.i].kind !== 'work' || R.pauseAt) return;
    R.laps.push(workTime()); beep(1200, 80); navigator.vibrate?.(30);
    // giro più veloce della media dei precedenti: "stai a volà"; altrimenti ogni 2 giri un "bravo"
    const L = R.laps, last = L.at(-1) - (L.at(-2) || 0), prevAvg = L.length > 1 ? L.at(-2) / (L.length - 1) : 0;
    if (prevAvg && last < prevAvg * 0.9) coach('veloce'); else if (L.length % 2 === 0) coach('giro');
    $('#rc').textContent = `${pl(R.laps.length, T('giro', 'round'), T('giri', 'rounds'))} · ${T('ultimo', 'last')} ${fmt(R.laps.at(-1) - (R.laps.at(-2) || 0))}`;
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
  if (R.pauseAt) { R.paused += performance.now() - R.pauseAt; R.pauseAt = 0; coach('riprendi') || say(T('Via', 'Go')); }
  else { R.pauseAt = performance.now(); window.speechSynthesis?.cancel(); coach('pausa'); }
  $('#pause').textContent = R.pauseAt ? T('RIPRENDI', 'RESUME') : T('PAUSA', 'PAUSE');
  document.body.classList.toggle('paused', !!R.pauseAt);
}
function enter(i) {
  const s = R.S[i];
  if (s.kind === 'prep') return coach('pronti') || say(T('Preparati', 'Get ready'));
  beep(s.kind === 'rest' ? 520 : 1320, 450);
  if (s.kind === 'rest') return coach(s.long ? 'serie' : 'recupero') || say(T('Recupero', 'Rest'));
  const lastWork = !R.S.slice(i + 1).some((x) => x.kind === 'work'), first = !R.S.slice(0, i).some((x) => x.kind === 'work');
  if (lastWork && s.of > 1) return coach('ultimo') || say(s.text ? `${T('Ultimo!', 'Last one!')} ${s.text}` : T('Ultimo round!', 'Last round!'));
  // EMOM: se c'è scritto l'esercizio si legge quello, altrimenti a inizio giro (un giro sì e uno no) una spinta
  if (R.m === 'emom') return s.text ? say(s.text) : first ? coach('via') || say(T('Via!', 'Go!')) : R.S[i - 1]?.round !== s.round && s.round % 2 === 0 ? coach('giroemom') : null;
  if (R.m === 'it') return s.round === 1 && s.sets > 1 && !first ? say(T(`Serie ${s.set}, via!`, `Set ${s.set}, go!`)) : first ? coach('via') || say(T('Via!', 'Go!')) : coach('lavoro');
  coach('via') || say(T('Via!', 'Go!'));
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
  $('#info').textContent = s.kind === 'prep' ? `${summary(R.m, R.c)} · ${T('tocca per partire subito', 'tap to start now')}` : s.up ? (s.dur !== Infinity ? `Time cap ${fmt(s.dur)}` : '') : R.m === 'amrap' ? `${T('di', 'of')} ${fmt(s.dur)}` : nextInfo();
  document.body.dataset.kind = s.kind + (!s.up && left <= 3.05 && s.kind !== 'prep' ? ' last' : '');
}
// spinte del coach nei tratti lunghi (AMRAP, AFAP col cap, intervalli lunghi)
function motivate(s, e, left, sec) {
  if (s.dur < 60) return;
  if (sec === 10 && s.dur >= 120) return coach('sec10');
  if (s.dur >= 240 && sec === 60) return coach('min1') || say(T('Un minuto alla fine', 'One minute left'));
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
  if (!n) return T('Ultimo!', 'Last one!');
  const next = T('Dopo', 'Next');
  if (n.kind === 'rest') return `${next}: ${n.long ? T('recupero serie', 'set rest') : T('recupero', 'rest')} ${secTxt(n.dur)}`;
  return `${next}: ${n.text || (n.set !== R.S[R.i].set ? `${T('serie', 'set')} ${n.set}` : n.rnd ? `round ${n.round}` : n.label.toLowerCase())}`;
}
// AFAP: il risultato è il tempo fatto (o "TIME CAP" se è scaduto). "FINITO" durante il preparati non vale.
function finish(timeUp) {
  if (!timeUp && R.S[R.i].kind !== 'work') return;
  R.done = true; clearInterval(R.iv);
  if (R.m === 'afap') R.result = timeUp ? 'TIME CAP' : fmt(Math.floor(elapsed()));
  beep(1320, 300); setTimeout(() => beep(1760, 500), 320);
  coach('fine') || say(T('Finito!', 'Done!'));
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
    const part = r.items.filter((it) => it.n > 0).map((it) => `${it.n} ${it.name || T('esercizio', 'exercise')}`);
    return `${pl(r.rounds, T('giro', 'round'), T('giri', 'rounds'))}${part.length ? ` + ${part.join(', ')}` : ''}`;
  }
  return T('Completato', 'Completed');
}
// diario: ogni timer finito si salva da solo, con data e ora (massimo 500)
function logSave() {
  const log = ls.get('log', []).filter((x) => x.id !== R.when);
  const items = R.m === 'afap' ? R.items.map((it) => ({ name: it.name, reps: it.reps, n: it.n, ok: it.ok })) : R.m === 'amrap' ? R.items.filter((it) => it.n > 0).map((it) => ({ name: it.name, n: it.n })) : [];
  log.unshift({ id: R.when, m: R.m, c: R.c, title: R.title || '', res: resultOf(R), dur: Math.round(R.dur), laps: R.laps.map(Math.round), items });
  ls.set('log', log.slice(0, 500));
}
const when = (t) => new Date(t).toLocaleString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function end() {
  if (!R?.done) return (location.hash = '#home');
  const { m, c, laps, items, title } = R;
  delete document.body.dataset.kind; document.body.classList.remove('paused');
  const lapList = laps.length ? `<div class="laps">${laps.map((t, j) => `<span><em>${j + 1}</em>${fmt(t - (laps[j - 1] || 0))}</span>`).join('')}</div>` : '';
  const itemList = m === 'afap' && items.length ? `<div class="laps items">${items.map((it) => `<span class="${it.ok ? 'ok' : ''}">${it.ok ? '✓' : '·'} ${esc(it.name || T('Esercizio', 'Exercise'))}${it.reps ? ` ${it.n}/${it.reps}` : ''}</span>`).join('')}</div>` : '';
  // AMRAP: giri completi (si possono correggere) + cosa hai fatto del giro non finito
  const amrapBox = m === 'amrap' ? `<div class="field am"><label>${T('Giri completi', 'Full rounds')}</label>
      <div class="stepper"><button data-g="-1">−</button><output id="giri">${R.rounds}</output><button data-g="1">+</button></div></div>
    ${items.length ? `<div class="field am"><label>${T('Giro non finito: quante ne hai fatte?', 'Unfinished round: reps done?')}</label><div class="list">${items.map((it, j) => `<div class="li part">
      <span class="pn">${esc(it.name || T('Esercizio', 'Exercise'))}${it.reps ? ` <small>/ ${it.reps}</small>` : ''}</span>
      <button data-p="${j}" data-d="-1">−</button><output data-po="${j}">${it.n}</output><button data-p="${j}" data-d="1">+</button>
      ${it.reps ? `<button class="all" data-pa="${j}">${T('TUTTE', 'ALL')}</button>` : ''}</div>`).join('')}</div></div>` : ''}` : '';
  app.innerHTML = `<main class="page end" style="--accent:${MODES[m].col}"><h1>${T('DAJE!', 'HELL YEAH!')}</h1>
    <div class="res"><small>${esc(title || MODES[m].name)} · ${summary(m, c)}</small><b id="big">${m === 'it' || m === 'emom' ? T('FATTO!', 'DONE!') : resultOf(R)}</b>${lapList}${itemList}
      <span class="when">${when(R.when)} · ${fmt(R.dur)} ${T('di lavoro · salvato nel diario', 'of work · saved to log')}</span></div>
    ${amrapBox}
    <div class="row"><button id="again" class="go">${T('RIFAI', 'AGAIN')}</button><a class="btn" href="#home">HOME</a></div>
    <a class="promo" href="${PROVA}" target="_blank" rel="noopener"><div><small>${T('VUOI UN WORKOUT GIÀ PRONTO?', 'WANT A READY-MADE WORKOUT?')}</small><b>${T('PROVA I NOSTRI ALLENAMENTI', 'TRY OUR PROGRAMS')}</b></div><i>›</i></a></main>`;
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
    const d = new Date(x.id).toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const head = d !== day ? `<h2>${(day = d)}</h2>` : '';
    const det = x.items?.length && x.m === 'afap' ? x.items.map((it) => `${it.ok ? '✓' : '·'} ${esc(it.name || T('Esercizio', 'Exercise'))}${it.reps ? ` ${it.n}/${it.reps}` : ''}`).join(' &nbsp; ') : '';
    return `${head}<div class="sv lg" style="--c:${MODES[x.m].col}"><div class="lgx"><small>${MODES[x.m].name} · ${new Date(x.id).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })}</small>
      <b>${esc(x.res)}</b><span>${x.title ? esc(x.title) + ' · ' : ''}${summary(x.m, { ...clone(MODES[x.m].def), ...x.c })}${x.dur ? ` · ${fmt(x.dur)}` : ''}</span>${det ? `<span>${det}</span>` : ''}</div>
      <button data-redo="${x.id}" aria-label="${T('Rifai', 'Again')}">↻</button><button data-dl="${x.id}" aria-label="${T('Elimina', 'Delete')}">✕</button></div>`;
  }).join('');
  app.innerHTML = `<main class="page">${back(T('DIARIO', 'LOG'))}
    ${rows || `<p class="muted">${T('Qui trovi ogni workout finito, con data, ora e risultato. Si salvano da soli.', 'Every finished workout shows up here, with date, time and result. Saved automatically.')}</p>`}</main>`;
  app.querySelectorAll('[data-redo]').forEach((b) => (b.onclick = () => { const x = log.find((y) => y.id == b.dataset.redo); start(x.m, { ...clone(MODES[x.m].def), ...x.c }, x.title); }));
  app.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = async () => {
    if (!(await ask(T('Eliminare questo workout dal diario?', 'Delete this workout from the log?'), { ok: T('Elimina', 'Delete') }))) return;
    ls.set('log', ls.get('log', []).filter((y) => y.id != b.dataset.dl)); diary();
  }));
}

// "Workout": l'unico posto dove si parla di UN-MEMBER, con un link esterno
function workout() {
  app.innerHTML = `<main class="page">${back('WORKOUT')}
    <section class="wk"><h1>${T('VUOI PROVARE I NOSTRI WORKOUT?', 'WANT OUR WORKOUTS?')}</h1>
      <p>${T(`${NAME} è gratis e resta gratis. Se vuoi anche gli allenamenti già pronti, li trovi su <b>UN-MEMBER</b>, l'app di Alessio · UN-COACH.`, `${NAME} is free and stays free. If you want ready-made workouts too, check out <b>UN-MEMBER</b>, Alessio · UN-COACH's training app (in Italian).`)}</p>
      <ul>${T(['🎥 Video di ogni esercizio', '⏱ Timer e voce che ti guidano', '🏋️ Kettlebell, TRX e corpo libero, a casa o al parco', '📅 La tua settimana pronta ogni giorno'], ['🎥 A video for every exercise', '⏱ Timer and voice that guide you', '🏋️ Kettlebell, TRX and bodyweight, at home or in the park', '📅 Your week planned every day']).map((x) => `<li>${x}</li>`).join('')}</ul>
      <a class="go" href="${PROVA}" target="_blank" rel="noopener">${T('PROVA 7 GIORNI GRATIS', 'TRY IT FREE FOR 7 DAYS')}</a>
    </section></main>`;
}

function settings() {
  const o = opts();
  const draw = () => {
    app.innerHTML = `<main class="page">${back(T('IMPOSTAZIONI', 'SETTINGS'))}
      <div class="field"><label>${T('Lingua e voce', 'Language & voice')}</label>
        <div class="chips lang">${[['rm', 'Romano'], ['en', 'English']].map(([k, l]) => `<button data-l="${k}" class="${LANG === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <p class="muted small">${T('Il coach ti spinge in romano (voce di Alessio).', 'The coach pushes you in English.')}</p></div>
      <label class="sw"><span>${T('Voce', 'Voice')}</span><input type="checkbox" id="voice" ${o.voice ? 'checked' : ''}></label>
      <label class="sw"><span>${T('Spinte del coach', 'Coach pep talk')}</span><input type="checkbox" id="push" ${o.push !== false ? 'checked' : ''}></label>
      <label class="sw"><span>${T('Bip', 'Beeps')}</span><input type="checkbox" id="beep" ${o.beep ? 'checked' : ''}></label>
      <div class="field"><label>${T('Conto alla rovescia prima di partire', 'Countdown before start')}</label>
        <div class="chips">${[0, 5, 10, 15].map((v) => `<button data-p="${v}" class="${o.prep === v ? 'on' : ''}">${v ? v + 's' : T('No', 'Off')}</button>`).join('')}</div></div>
      <p class="muted small">${T(`${NAME} è gratuito, funziona anche senza internet e non raccoglie dati: tutto resta sul tuo telefono.`, `${NAME} is free, works offline and collects no data: everything stays on your phone.`)} <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p></main>`;
    app.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => {
      LANG = o.lang = b.dataset.l; ls.set('opts', o); document.documentElement.lang = T('it', 'en');
      draw(); coachAt = 0; coach('via');
    }));
    $('#voice').onchange = (e) => { o.voice = e.target.checked; ls.set('opts', o); if (o.voice) say(T('Voce attiva', 'Voice on')); };
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
