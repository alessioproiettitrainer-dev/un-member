// Quality Test: la fotocamera guarda le articolazioni (MediaPipe Pose, gira tutto sul telefono: il video non esce mai)
// e conta solo le ripetizioni valide. Prima 1 ripetizione di riferimento fatta bene: le altre devono arrivare almeno lì.
// Alla fine la card con foto e risultato: Community, Profilo (Progressi → Test livelli) o Condividi.
const MP = '/vendor/mediapipe'; // libreria servita dal nostro server (node_modules/@mediapipe/tasks-vision)
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const QT_EX = {
  pushups: { name: 'Piegamenti', short: 'piegamenti', bar: false, how: 'Telefono a terra, di lato, a circa 2 metri: si deve vedere tutto il corpo, dalla testa ai piedi.', ref: 'Fai 1 piegamento lento e perfetto: petto vicino a terra, poi braccia tese.' },
  pullups: { name: 'Trazioni strict', short: 'trazioni', bar: true, how: 'Telefono di fronte o di lato, a 3 metri, un po\' in basso: si devono vedere la sbarra, le mani e i piedi.', ref: 'Fai 1 trazione lenta e perfetta: da braccia tese, mento sopra la sbarra.' },
  t2b: { name: 'Toes to bar strict', short: 'toes to bar', bar: true, how: 'Telefono di lato, a 3 metri, un po\' in basso: si devono vedere la sbarra, le mani e i piedi.', ref: 'Fai 1 toes to bar lento e perfetto: gambe tese, piedi alla sbarra, giù fino in fondo.' },
  burpees: { name: 'Burpee 5\'', short: 'burpee', bar: false, secs: 300, how: 'Telefono di lato, a 3 metri: si deve vedere tutto il corpo, anche le mani sopra la testa.', ref: 'Fai 1 burpee perfetto: mani a terra, plank, piedi alle mani, saltello con le mani sopra la testa.' },
};

let landmarker = null;
async function loadModel() {
  if (landmarker) return landmarker;
  const v = await import(`${MP}/vision_bundle.mjs`);
  const files = await v.FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { landmarker = await v.PoseLandmarker.createFromOptions(files, opts('GPU')); } catch { landmarker = await v.PoseLandmarker.createFromOptions(files, opts('CPU')); }
  return landmarker;
}

// ---- geometria ----------------------------------------------------------------------------------
const deg = (a, b, c) => { // angolo in b
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
  const d = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) * 180) / Math.PI;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// punti del lato più visibile (si filma di lato): sinistra = indici dispari di MediaPipe, destra = +1
const IDX = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, ft: 31 };
function body(lm, W, H) {
  const vis = (k) => Object.values(IDX).reduce((t, i) => t + (lm[i + k].visibility ?? 1), 0);
  const k = vis(0) >= vis(1) ? 0 : 1, s = {};
  for (const [n, i] of Object.entries(IDX)) s[n] = { x: lm[i + k].x * W, y: lm[i + k].y * H, v: lm[i + k].visibility ?? 1 };
  s.mouth = { x: ((lm[9].x + lm[10].x) / 2) * W, y: ((lm[9].y + lm[10].y) / 2) * H };
  s.nose = { x: lm[0].x * W, y: lm[0].y * H };
  // la sbarra: tutte e due le mani se si vedono (trazioni di fronte), altrimenti quella del lato buono
  s.barY = (lm[15].visibility ?? 1) > 0.5 && (lm[16].visibility ?? 1) > 0.5 ? ((lm[15].y + lm[16].y) / 2) * H : s.wr.y;
  s.torso = dist(s.sh, s.hip) || 1;
  s.elbow = deg(s.sh, s.el, s.wr);
  s.hipA = deg(s.sh, s.hip, s.an);
  s.knee = deg(s.hip, s.kn, s.an);
  s.flat = Math.abs(s.sh.y - s.an.y) < 0.5 * dist(s.sh, s.an); // corpo orizzontale
  s.upright = Math.abs(s.sh.x - s.hip.x) < 0.75 * Math.abs(s.sh.y - s.hip.y) && s.sh.y < s.hip.y; // tronco verticale (±37°)
  s.minVis = Math.min(...Object.keys(IDX).map((n) => s[n].v));
  return s;
}

// ---- regole di ogni prova ---------------------------------------------------------------------
// val = angolo che parte alto (posizione di partenza) e scende durante la ripetizione.
// top = sei tornato in partenza (braccia/gambe distese), bottom = sei arrivato fino in fondo.
// I limiti fissi sono il minimo per tutti; il riferimento li può solo rendere più severi.
const RULES = {
  pushups: {
    ok: (s) => s.flat && s.hipA >= 125, val: (s) => s.elbow, // in plank (non a V, non in piedi)
    T: (r) => ({ top: Math.max(150, r ? r.top - 10 : 150), bottom: Math.min(100, r ? r.bottom + 15 : 100) }),
    isTop: (s, T) => s.elbow >= T.top, isBottom: (s, T) => s.elbow <= T.bottom,
    fault: (s) => (s.hipA < 145 ? 'Corpo dritto, bacino in linea' : ''),
    noBottom: 'Scendi di più', noTop: 'Distendi le braccia in alto',
    depth: (s, T) => (165 - s.elbow) / (165 - T.bottom),
  },
  pullups: {
    ok: (s) => s.wr.y < s.sh.y, val: (s) => s.elbow,
    T: (r) => ({ top: Math.max(145, r ? r.top - 12 : 145) }),
    isTop: (s, T) => s.elbow >= T.top, isBottom: (s) => s.mouth.y < s.barY,
    fault: () => '',
    noBottom: 'Mento sopra la sbarra', noTop: 'Giù fino a braccia tese',
    depth: (s) => (s.mouth.y < s.barY ? 1 : (170 - s.elbow) / 110),
  },
  t2b: {
    ok: (s) => s.wr.y < s.sh.y, val: (s) => s.hipA,
    T: (r) => ({ top: Math.max(155, r ? r.top - 12 : 155), reach: Math.min(0.5, Math.max(0.3, r ? r.reach * 1.3 : 0.45)) }),
    isTop: (s, T) => s.hipA >= T.top, isBottom: (s, T) => dist(s.ft, s.wr) <= T.reach * s.torso,
    fault: (s) => (s.knee < 140 ? 'Gambe tese' : ''),
    noBottom: 'Piedi fino alla sbarra', noTop: 'Giù fino in fondo, corpo disteso',
    depth: (s, T) => (dist(s.ft, s.wr) <= T.reach * s.torso ? 1 : (180 - s.hipA) / 140),
  },
};

// ripetizioni a fasi (piegamenti, trazioni, toes to bar)
function repMachine(rule, T, on) {
  let st = 'wait', rep = null, topMax = 0;
  return (s) => {
    if (!rule.ok(s)) return;
    const v = rule.val(s);
    if (st === 'wait') { if (rule.isTop(s, T)) { st = 'top'; topMax = v; } return; }
    if (st === 'top') {
      if (v < T.top - 15) { st = 'rep'; rep = { bottom: false, faults: new Set(), min: v, max: topMax, peak: 0 }; }
      else topMax = Math.max(topMax, v);
      return;
    }
    rep.min = Math.min(rep.min, v);
    const f = rule.fault(s); if (f) rep.faults.add(f);
    if (rule.isBottom(s, T)) { rep.bottom = true; if (rule === RULES.t2b) rep.reach = Math.min(rep.reach ?? 9, dist(s.ft, s.wr) / s.torso); }
    if (rep.bottom) rep.peak = Math.max(rep.peak, v);
    if (rule.isTop(s, T)) { // tornato in partenza: ripetizione finita
      const why = !rep.bottom ? rule.noBottom : [...rep.faults][0] || '';
      on(!why, why, rep); st = 'top'; rep = null; topMax = v;
    } else if (rep.bottom && rep.peak - v > 25 && rep.peak > T.top - 40) { // risalito a metà e giù di nuovo
      on(false, rule.noTop, rep); rep = { bottom: false, faults: new Set(), min: v, max: rep.max, peak: 0 };
    }
  };
}
// burpee: piedi → plank (corpo orizzontale e dritto) → in piedi con le mani sopra la testa
function burpeeMachine(on) {
  let st = 'wait', plank = false, riseAt = 0;
  return (s) => {
    const overhead = s.wr.y < s.nose.y, stand = s.upright && s.hipA >= 140;
    if (st === 'wait') { if (stand) st = 'up'; return; }
    if (st === 'up') { if (!s.upright) { st = 'down'; plank = false; } return; }
    if (st === 'down') {
      if (s.flat && s.hipA >= 150) plank = true;
      if (stand) { st = 'rise'; riseAt = performance.now(); }
      return;
    }
    if (st === 'rise') {
      if (!plank) { on(false, 'Salta indietro in plank'); st = 'up'; return; }
      if (overhead) { on(true, ''); st = 'up'; return; }
      if (!s.upright || performance.now() - riseAt > 1500) { on(false, 'Mani sopra la testa'); st = s.upright ? 'up' : 'down'; plank = false; }
    }
  };
}

// ---- voce e schermo acceso -------------------------------------------------------------------------
function say(t) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(t));
  const v = speechSynthesis.getVoices().find((x) => /^it/i.test(x.lang));
  if (v) u.voice = v;
  u.lang = 'it-IT'; u.rate = 1.1;
  speechSynthesis.speak(u);
}
let wake = null;
const awake = async () => { try { if (!wake || wake.released) wake = await navigator.wakeLock?.request('screen'); } catch {} };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];

// punti dell'Hybrid Test per le singole prove (come ltScore in app.js)
export const qtPoints = (ex, n, sex) => (sex ? n * { pushups: sex === 'f' ? 3 : 2, pullups: sex === 'f' ? 10 : 5, t2b: 5, burpees: 1 }[ex] : 0);

// ---- schermata del test -------------------------------------------------------------------------------
export function qualityTest({ ex, me, api, toast, onSaved }) {
  const E = QT_EX[ex], rule = RULES[ex];
  const sex = (me.profile?.sex || me.quiz?.sex || '').toLowerCase();
  const root = document.createElement('div');
  root.className = 'qt notranslate';
  root.innerHTML = `<div class="qt-top"><button class="qt-x" data-close aria-label="Chiudi">✕</button><div class="qt-t"><small>QUALITY TEST${E.secs ? ` · ${E.secs / 60} MINUTI` : ''}</small>${esc(E.name)}</div></div>
    <div class="qt-cam"><video playsinline muted></video><canvas></canvas><div class="qt-badge"></div><div class="qt-toast"></div>
      <div class="qt-depth" hidden><i></i><b></b></div><div class="qt-count" hidden><b>0</b><span>valide</span></div></div>
    <div class="qt-body"></div>`;
  document.body.append(root);
  document.body.classList.add('qt-open');
  const $ = (q) => root.querySelector(q);
  const video = $('video'), cv = $('canvas'), ctx = cv.getContext('2d'), box = $('.qt-body');
  let stream = null, raf = 0, alive = true, step = null, last = null, lastT = -1, smooth = null, noBodySince = 0;
  const res = { ex, valid: 0, bad: 0, secs: 0 };
  let T = rule?.T(null), ref = null, machine = null, startAt = 0, lastRepAt = 0, offBarSince = 0, timerEl = null;

  const close = () => {
    alive = false; cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    wake?.release?.().catch(() => {}); wake = null;
    document.removeEventListener('visibilitychange', awake);
    root.remove(); document.body.classList.remove('qt-open');
  };
  root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('visibilitychange', awake);

  const badge = (t, cls = '') => { const b = $('.qt-badge'); b.textContent = t; b.className = 'qt-badge ' + cls; b.hidden = !t; };
  let toastT = 0;
  const flash = (t, ok) => { const el = $('.qt-toast'); el.textContent = t; el.className = 'qt-toast on ' + (ok ? 'ok' : 'bad'); clearTimeout(toastT); toastT = setTimeout(() => (el.className = 'qt-toast'), 1600); };
  let tint = '#ff7a00', tintUntil = 0;

  function draw(lm) {
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (!lm) return;
    const col = performance.now() < tintUntil ? tint : '#ff7a00';
    ctx.lineWidth = Math.max(4, W / 120); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
    for (const [a, b] of BONES) {
      if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue;
      ctx.beginPath(); ctx.moveTo(lm[a].x * W, lm[a].y * H); ctx.lineTo(lm[b].x * W, lm[b].y * H); ctx.stroke();
    }
    for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if ((lm[i].visibility ?? 1) >= 0.4) { ctx.beginPath(); ctx.arc(lm[i].x * W, lm[i].y * H, ctx.lineWidth * 0.9, 0, 7); ctx.fill(); }
  }

  // un fotogramma alla volta: trova il corpo, lo disegna e lo passa alla prova in corso
  function loop() {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!landmarker || video.readyState < 2 || video.currentTime === lastT) return;
    lastT = video.currentTime;
    const now = performance.now();
    let r; try { r = landmarker.detectForVideo(video, now); } catch { return; }
    const lm = r.landmarks?.[0];
    if (lm) smooth = smooth ? lm.map((p, i) => ({ x: smooth[i].x * 0.4 + p.x * 0.6, y: smooth[i].y * 0.4 + p.y * 0.6, visibility: p.visibility })) : lm;
    else smooth = null;
    draw(smooth);
    const s = smooth && body(smooth, cv.width, cv.height);
    const seen = s && s.minVis > 0.5;
    if (!seen) { noBodySince ||= now; if (now - noBodySince > 1200) badge(smooth ? 'Non ti vedo tutto: allontana il telefono' : 'Non ti vedo: mettiti nell\'inquadratura', 'warn'); }
    else { noBodySince = 0; badge(step === 'test' ? '' : 'Ti vedo ✓', 'ok'); }
    last = seen ? s : null;
    if (seen && machine) machine(s);
    if (seen && rule && step === 'test') { const d = $('.qt-depth'); d.hidden = false; d.querySelector('i').style.height = `${Math.max(0, Math.min(1, rule.depth(s, T))) * 100}%`; }
    if (step === 'test') tick(now, s);
  }

  async function startCam() {
    box.innerHTML = '<div class="qt-h">Accendo la fotocamera…</div><div class="qt-m">Se il telefono lo chiede, consenti l\'uso della fotocamera.</div>';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    } catch {
      box.innerHTML = '<div class="qt-h">Fotocamera bloccata</div><div class="qt-m">Consenti la fotocamera per questa app nelle impostazioni del telefono (o del browser) e riprova.</div><button class="qt-btn" data-close>Chiudi</button>';
      return false;
    }
    video.srcObject = stream; await video.play().catch(() => {});
    await new Promise((ok) => (video.videoWidth ? ok() : video.addEventListener('loadedmetadata', ok, { once: true })));
    cv.width = video.videoWidth; cv.height = video.videoHeight;
    $('.qt-cam').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    box.innerHTML = '<div class="qt-h">Carico il riconoscimento…</div><div class="qt-m">Solo la prima volta ci mette qualche secondo.</div>';
    try { await loadModel(); } catch { box.innerHTML = '<div class="qt-h">Non riesco a caricare il riconoscimento</div><div class="qt-m">Controlla la connessione e riprova.</div><button class="qt-btn" data-close>Chiudi</button>'; return false; }
    awake(); loop();
    return true;
  }

  function intro() {
    step = 'intro';
    box.innerHTML = `<span class="qt-pill">Come mettere il telefono</span><div class="qt-h">${esc(E.how)}</div>
      <div class="qt-m">Alla fine scatto una foto per la tua card: niente viene registrato o mandato, il video resta sul telefono.</div>
      <button class="qt-btn p" data-go>Ok, sono pronto</button>`;
    box.querySelector('[data-go]').onclick = async () => { if (await startCam()) reference(); };
  }

  // 1 ripetizione fatta bene: diventa il metro per le altre
  function reference() {
    step = 'ref'; ref = null;
    box.innerHTML = `<span class="qt-pill">Passo 1 di 2 · riferimento</span><div class="qt-h">${esc(E.ref)}</div>
      <div class="qt-m" id="qtrm">Lo uso come metro: da qui in poi valgono solo le ripetizioni che arrivano almeno lì.</div>
      <div class="qt-stats" id="qtrs"></div><button class="qt-btn" data-skip>Salta il riferimento</button>`;
    const done = (r) => {
      machine = null; ref = r || {};
      if (rule && r) T = rule.T({ top: r.max, bottom: r.min, reach: r.reach });
      say('Riferimento ok');
      const stat = (v, l) => `<div><b class="ok">${v} ✓</b><span>${l}</span></div>`;
      box.querySelector('#qtrs').innerHTML = !r ? '' : ex === 'pushups' ? stat(Math.round(r.min) + '°', 'Gomito in basso') + stat(Math.round(r.max) + '°', 'Braccia tese')
        : ex === 'pullups' ? stat('✓', 'Mento sopra') + stat(Math.round(r.max) + '°', 'Braccia tese')
        : ex === 't2b' ? stat('✓', 'Piedi alla sbarra') + stat(Math.round(r.max) + '°', 'Corpo disteso') : stat('✓', 'Burpee completo');
      box.querySelector('#qtrm').textContent = 'Riferimento ok! Se vuoi rifallo, altrimenti si parte.';
      const b = box.querySelector('[data-skip]'); b.textContent = 'Riferimento ok · inizia'; b.className = 'qt-btn p'; b.onclick = countdown;
      const again = document.createElement('button'); again.className = 'qt-btn'; again.textContent = 'Rifai il riferimento'; again.onclick = reference; box.append(again);
    };
    machine = ex === 'burpees' ? burpeeMachine((ok, why) => (ok ? done(null) : flash(why, false)))
      : repMachine(rule, rule.T(null), (ok, why, rep) => (ok ? done(rep) : (flash(why, false), say(why))));
    box.querySelector('[data-skip]').onclick = countdown;
  }

  function countdown() {
    step = 'count'; machine = null;
    let n = E.bar ? 10 : 5;
    box.innerHTML = `<span class="qt-pill">Passo 2 di 2</span><div class="qt-h">${E.bar ? 'Vai alla sbarra: si parte tra' : 'Mettiti in posizione: si parte tra'}</div><div class="qt-big" id="qtcd">${n}</div>`;
    const it = setInterval(() => {
      if (!alive) return clearInterval(it);
      n--; if (n > 0) { root.querySelector('#qtcd').textContent = n; if (n <= 3) say(n); return; }
      clearInterval(it); say('Via!'); test();
    }, 1000);
  }

  function test() {
    step = 'test'; startAt = lastRepAt = performance.now(); offBarSince = 0;
    $('.qt-count').hidden = false;
    box.innerHTML = `<div class="qt-timer">${E.secs ? mmss(E.secs) : '00:00'}</div>
      <div class="qt-stats"><div><b class="ok" id="qv">0</b><span>Valide</span></div><div><b class="bad" id="qb">0</b><span>Scartate</span></div><div><b id="qq">–</b><span>Qualità</span></div></div>
      <div class="qt-m" style="text-align:center">${E.secs ? 'Più burpee validi che puoi.' : 'Unbroken: quando ti fermi il test finisce da solo.'}</div>
      <button class="qt-btn" data-end>Fine</button>`;
    timerEl = box.querySelector('.qt-timer');
    box.querySelector('[data-end]').onclick = finish;
    const on = (ok, why) => {
      lastRepAt = performance.now();
      if (ok) { res.valid++; say(res.valid); tint = '#3ccf7a'; flash(`✓ ${res.valid}`, true); }
      else { res.bad++; say('No'); tint = '#ff4d4d'; flash(`✕ Non valida · ${why}`, false); }
      tintUntil = performance.now() + 600;
      $('.qt-count b').textContent = res.valid;
      box.querySelector('#qv').textContent = res.valid; box.querySelector('#qb').textContent = res.bad;
      box.querySelector('#qq').textContent = Math.round((res.valid / (res.valid + res.bad)) * 100) + '%';
    };
    machine = ex === 'burpees' ? burpeeMachine(on) : repMachine(rule, T, on);
  }
  // timer e fine automatica: burpee a tempo; le altre unbroken (ferma 6 secondi, o scesa dalla sbarra)
  function tick(now, s) {
    const el = (now - startAt) / 1000;
    if (timerEl) timerEl.textContent = mmss(E.secs ? Math.max(0, E.secs - el) : el);
    if (E.secs) { if (el >= E.secs) finish(); return; }
    if (!res.valid && !res.bad) return;
    if (E.bar) { if (s && s.wr.y > s.sh.y) { offBarSince ||= now; if (now - offBarSince > 1500) finish(); } else offBarSince = 0; }
    if (now - lastRepAt > 6000) finish();
  }

  function finish() {
    if (step !== 'test') return;
    step = 'done'; machine = null; res.secs = Math.round((performance.now() - startAt) / 1000);
    $('.qt-depth').hidden = true;
    say(`Finito! ${res.valid} ripetizioni valide`);
    const pts = qtPoints(ex, res.valid, sex);
    box.innerHTML = `<span class="qt-pill">Test finito · daje!</span><div class="qt-h">${res.valid} ${esc(E.short)} di qualità</div>
      <div class="qt-m">${res.bad} scartate${pts ? ` · ${pts} punti nel Test livelli` : ''}. Ora la foto per la tua card: mettiti in posa, scatto da solo dopo 3 secondi.</div>
      <button class="qt-btn p" data-photo>📷 Scatta la foto</button><button class="qt-btn" data-nophoto>Card senza foto</button>`;
    box.querySelector('[data-photo]').onclick = photo;
    box.querySelector('[data-nophoto]').onclick = () => showCard(null);
  }

  function photo() {
    let n = 3;
    box.innerHTML = `<div class="qt-h" style="text-align:center">Sorridi!</div><div class="qt-big">${n}</div>`;
    const it = setInterval(() => {
      if (!alive) return clearInterval(it);
      n--; if (n > 0) { box.querySelector('.qt-big').textContent = n; return; }
      clearInterval(it);
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(video, 0, 0); // come allo specchio
      root.classList.add('qt-shot'); setTimeout(() => root.classList.remove('qt-shot'), 300);
      showCard(c);
    }, 1000);
  }

  // ---- la card ----------------------------------------------------------------------------------
  let logo = null;
  const loadLogo = () => logo || (logo = new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/img/uncoach.webp'; }));
  async function renderCard(shot, story) {
    await document.fonts?.load('900 100px Montserrat').catch(() => {});
    const W = 1080, H = story ? 1920 : 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), F = (w, s) => `${w} ${s}px Montserrat, system-ui, sans-serif`;
    if (shot) { // foto a riempire (come object-fit: cover)
      const k = Math.max(W / shot.width, H / shot.height), w = shot.width * k, h = shot.height * k;
      g.drawImage(shot, (W - w) / 2, (H - h) / 2.6, w, h);
    } else {
      const bg = g.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.35, H * 0.8); bg.addColorStop(0, '#5a3a22'); bg.addColorStop(1, '#0c0c0e');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
    }
    let gr = g.createLinearGradient(0, 0, 0, H * 0.25); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.25);
    gr = g.createLinearGradient(0, H * 0.42, 0, H * 0.8); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.93)'); g.fillStyle = gr; g.fillRect(0, H * 0.42, W, H * 0.58);
    g.fillStyle = 'rgba(0,0,0,.93)'; g.fillRect(0, H * 0.8, W, H * 0.2);
    const pad = 64, L = await loadLogo();
    if (L) { const lh = 84; g.drawImage(L, pad, pad - 6, (L.width / L.height) * lh, lh); }
    const pts = qtPoints(ex, res.valid, sex);
    if (pts) { // punti del Test livelli in alto a destra
      const t = `${pts} PUNTI`; g.font = F(900, 34); const tw = g.measureText(t).width;
      g.fillStyle = '#ff7a00'; g.beginPath(); g.roundRect(W - pad - tw - 56, pad, tw + 56, 72, 36); g.fill();
      g.fillStyle = '#1a0c00'; g.textBaseline = 'middle'; g.fillText(t, W - pad - tw - 28, pad + 37);
    }
    g.textBaseline = 'alphabetic'; g.fillStyle = '#ff7a00'; g.font = F(900, 40);
    let y = H - (story ? 600 : 520);
    g.letterSpacing = '12px'; g.fillText('QUALITY TEST', pad, y); g.letterSpacing = '0px';
    g.fillStyle = '#fff'; g.font = F(900, 64); y += 78; g.fillText(E.name.toUpperCase(), pad, y);
    g.font = F(900, story ? 300 : 250); y += story ? 270 : 225; g.fillText(String(res.valid), pad - 8, y);
    g.font = F(900, 46); y += 74; g.fillText('RIPETIZIONI DI QUALITÀ', pad, y);
    y += 44; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(pad, y, W - pad * 2, 3);
    y += 62; g.font = F(700, 34); g.fillStyle = '#ddd';
    const q = res.valid + res.bad ? Math.round((res.valid / (res.valid + res.bad)) * 100) : 100;
    g.textAlign = 'left'; g.fillText((me.name || '').split(' ').map((w, i) => (i ? w[0] + '.' : w)).join(' ').toUpperCase().slice(0, 22), pad, y);
    g.textAlign = 'center'; g.fillText(`${res.bad} scartate · ${q}%`, W / 2 + 40, y);
    g.textAlign = 'right'; g.fillText(new Date().toLocaleDateString('it-IT'), W - pad, y);
    g.textAlign = 'left'; g.font = F(700, 28); g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillText(`Fai anche tu il test → ${location.host}`, pad, y + 56);
    return c;
  }

  async function showCard(shot) {
    step = 'card'; let story = false, cur = null;
    root.classList.add('qt-final');
    box.innerHTML = `<div class="qt-seg"><button class="on" data-f="post">Post</button><button data-f="story">Storia</button></div>
      <div class="qt-card"><img alt="La tua card"></div>
      <div class="qt-grid"><button class="qt-btn p" data-a="community">💬 Community</button><button class="qt-btn" data-a="profile">⭐ Profilo</button>
      <button class="qt-btn" data-a="share">↗ Condividi</button><button class="qt-btn" data-a="photo">📷 Rifai foto</button></div>`;
    const img = box.querySelector('img');
    const paint = async () => { cur = await renderCard(shot, story); img.src = cur.toDataURL('image/jpeg', 0.85); };
    await paint();
    const blob = () => new Promise((ok) => cur.toBlob(ok, 'image/jpeg', 0.85));
    const fname = `quality-test-${ex}.jpg`;
    box.querySelectorAll('[data-f]').forEach((b) => (b.onclick = async () => { story = b.dataset.f === 'story'; box.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); await paint(); }));
    let saved = false;
    box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'photo') { root.classList.remove('qt-final'); return photo(); }
      if (a === 'share') {
        const file = new File([await blob()], fname, { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch {} return; }
        const l = document.createElement('a'); l.href = URL.createObjectURL(file); l.download = fname; l.click(); return;
      }
      b.disabled = true;
      try {
        const fd = new FormData();
        if (a === 'community') {
          fd.append('text', `QUALITY TEST · ${res.valid} ${E.short} di qualità 💪`); fd.append('file', await blob(), fname);
          await api('/api/community/chat/general/photo', 'POST', fd); toast('Pubblicata nella chat di gruppo 💪');
        } else {
          if (saved) return toast('Già salvata nel profilo');
          fd.append('kind', 'qtest'); fd.append('qtEx', ex); fd.append('qtValid', res.valid); fd.append('qtBad', res.bad); fd.append('file', await blob(), fname);
          const p = await api('/api/me/photos', 'POST', fd); saved = true; onSaved?.(p); toast('Salvata nel profilo · Progressi');
        }
      } catch (err) { toast(/community/i.test(err.message) ? 'Entra prima nella Community (tab Community)' : err.message, true); }
      finally { b.disabled = false; }
    }));
  }

  intro();
  return close;
}

// per le prove automatiche (tools): le regole senza la parte grafica
export const _qt = { RULES, repMachine, burpeeMachine, body };
