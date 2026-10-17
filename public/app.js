import { blockSummary, estimateSeconds, fmt, PHASE_TYPES } from './engine.js';
import { startPlayer, stopPlayer } from './player.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
};
const DAY = 864e5;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const todayIso = () => iso(new Date());
const WD = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

async function api(url, method = 'GET', body) {
  const key = ls.get('adminKey', ''); // l'admin può vedere anche le bozze in anteprima
  const r = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'x-admin-key': key } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/api/auth')) { ME = null; location.hash = '#/login'; throw new Error(j.error || 'Accedi'); }
  if (r.status === 402 && ME) { ME.active = false; paywallView(); throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || 'Errore di rete');
  return j;
}
function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

let SETTINGS = { appName: 'UN-MEMBER', logo: '', tagline: '' };
let ME = null;
const progCache = new Map();
const getProgram = async (id) => progCache.get(id) || progCache.set(id, await api(`/api/programs/${id}`)).get(id);

function brand(size = 28) {
  return SETTINGS.logo ? `<img src="${esc(SETTINGS.logo)}" alt="${esc(SETTINGS.appName)}" style="height:${size + 8}px;display:block">` : `<div class="brand" style="font-size:${size}px">${esc(SETTINGS.appName)}</div>`;
}
const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  home: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  train: svg('<path d="M9 7a3 3 0 0 1 6 0"/><path d="M8 9h8l1.5 9a2 2 0 0 1-2 2.3h-7A2 2 0 0 1 6.5 18z"/>'),
  progress: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  food: svg('<path d="M12 21c-4 0-7-3.5-7-8 0-3 2-5 4.5-5 1.2 0 2 .5 2.5.5s1.3-.5 2.5-.5C17 8 19 10 19 13c0 4.5-3 8-7 8z"/><path d="M12 8c0-2 1-4 3-5"/>'),
  profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
};
function tabbar(on) {
  const t = (h, k, label, ico) => `<a href="${h}" class="${on === k ? 'on' : ''}"><span>${ico}</span>${label}</a>`;
  return `<nav class="tabbar">${t('#/', 'home', 'Oggi', ICONS.home)}${t('#/train', 'train', 'Allenamenti', ICONS.train)}${t('#/progress', 'progress', 'Progressi', ICONS.progress)}${t('#/food', 'food', 'Cibo', ICONS.food)}${t('#/profile', 'profile', 'Profilo', ICONS.profile)}</nav>`;
}
function page(tab, html) { $app.innerHTML = `<div class="wrap">${html}</div>${tabbar(tab)}`; }
function fail(e) { page('', `<a class="back" href="#/">‹ Indietro</a><div class="empty">${esc(e.message)}</div>`); }

// ---- router ------------------------------------------------------------------
window.addEventListener('hashchange', route);
async function route() {
  stopPlayer();
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  if (parts[0] === 'login' || parts[0] === 'register') return authView(parts[0]);
  if (!ME) {
    try { ME = await api('/api/me'); } catch { return; }
  }
  if (!ME.active && parts[0] !== 'profile') return paywallView();
  try {
    if (parts[0] === 'train') return await trainView();
    if (parts[0] === 'p' && parts[1]) return await programView(parts[1]);
    if (parts[0] === 'w' && parts[2]) return await workoutView(parts[1], parts[2]);
    if (parts[0] === 'play' && parts[2]) return await playView(parts[1], parts[2]);
    if (parts[0] === 'progress') return progressView();
    if (parts[0] === 'food') return foodView(parts[1]);
    if (parts[0] === 'profile') return profileView();
    return await homeView();
  } catch (e) { fail(e); }
}

// ---- accesso -----------------------------------------------------------------
function authView(mode) {
  const reg = mode === 'register';
  $app.innerHTML = `<div class="wrap auth">${brand(34)}<div class="muted" style="margin:6px 0 26px">${esc(SETTINGS.tagline || '')}</div>
    <form class="card form">
      <div class="h2" style="margin-top:0">${reg ? 'Crea il tuo account' : 'Accedi'}</div>
      ${reg ? '<label>Nome<input name="name" autocomplete="name" required></label>' : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="6" required></label>
      <button class="btn primary block">${reg ? 'Iscriviti' : 'Entra'}</button>
    </form>
    <div class="muted small" style="text-align:center;margin-top:16px">${reg ? 'Hai già un account? <a href="#/login">Accedi</a>' : 'Non hai un account? <a href="#/register">Iscriviti</a>'}</div></div>`;
  $app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { ME = await api(`/api/auth/${reg ? 'register' : 'login'}`, 'POST', f); location.hash = '#/'; } catch (err) { toast(err.message, true); }
  };
}

// ---- utilità su programmi e calendario -------------------------------------------
const doneDates = () => new Set(ME.history.map((h) => iso(new Date(h.date))));
function weekDays(offset = 0) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY + offset * 7 * DAY);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
}
const cycleWeek = (p) => (p.kind === 'cycle' && p.startDate ? Math.floor((Date.now() - new Date(p.startDate).getTime()) / (7 * DAY)) + 1 : 0);
function sortPrograms(list) {
  const t = todayIso();
  const current = list.filter((p) => p.kind === 'cycle' && p.startDate <= t && (!p.endDate || p.endDate > t));
  const past = list.filter((p) => p.kind === 'cycle' && p.endDate && p.endDate <= t).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const base = list.filter((p) => p.kind !== 'cycle');
  return { current, past, base };
}
async function activeProgram(list) {
  const { current, base } = sortPrograms(list);
  const id = list.some((p) => p.id === ME.activeProgramId) ? ME.activeProgramId : (current[0] || base[0])?.id;
  return id ? getProgram(id) : null;
}
// Il prossimo allenamento: nei cicli quello della settimana corrente non ancora fatto, altrimenti il primo che hai fatto meno volte.
function nextWorkout(p) {
  const counts = new Map();
  for (const h of ME.history) if (h.programId === p.id) counts.set(h.workoutId, (counts.get(h.workoutId) || 0) + 1);
  let pool = p.workouts;
  const wk = cycleWeek(p);
  if (wk) {
    const thisWeek = p.workouts.filter((w) => Number(w.week) === wk);
    if (thisWeek.length) pool = thisWeek;
  }
  return pool.slice().sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0))[0];
}
function programCard(p, extra = '') {
  return `<a class="prog" href="#/p/${p.id}">
    <div class="cover" style="${p.cover ? `background-image:url('${esc(p.cover)}')` : ''}"></div>
    <div class="body"><div class="row"><span class="pill accent">${esc(p.level)}</span>${p.weeks ? `<span class="pill">${esc(p.weeks)} settimane</span>` : ''}<span class="pill">${p.workoutCount} allenamenti</span>${extra}</div>
      <div class="title">${esc(p.title)}</div><div class="muted small">${esc(p.subtitle || '')}</div></div></a>`;
}

// ---- oggi --------------------------------------------------------------------
async function homeView() {
  const [list, board] = await Promise.all([api('/api/programs'), api('/api/board')]);
  const prog = await activeProgram(list);
  const nw = prog && nextWorkout(prog);
  const days = weekDays();
  const done = doneDates();
  const plan = ME.profile.trainingDays || [];
  const t = todayIso();
  const doneThisWeek = days.filter((d) => done.has(iso(d))).length;
  const memberDays = Math.floor((Date.now() - new Date(ME.joined).getTime()) / DAY) + 1;

  page('home', `
    <div class="topbar">${brand(24)}<span class="pill">Membro da ${memberDays} ${memberDays === 1 ? 'giorno' : 'giorni'}</span></div>
    <div class="h1">Ciao <em>${esc(ME.name.split(' ')[0])}</em></div>
    <div class="card">
      <div class="row between"><b>La tua settimana</b><span class="muted small">${doneThisWeek}/${plan.length || '–'} allenamenti</span></div>
      <div class="week">${days.map((d) => {
        const k = iso(d), wd = d.getDay();
        const cls = [done.has(k) ? 'done' : '', plan.includes(wd) ? 'plan' : '', k === t ? 'today' : '', k < t && k >= ME.joined && plan.includes(wd) && !done.has(k) ? 'miss' : ''].join(' ');
        return `<div class="day ${cls}"><span>${WD[wd].slice(0, 1)}</span><b>${done.has(k) ? '✓' : d.getDate()}</b></div>`;
      }).join('')}</div>
      <div class="muted small">I giorni cerchiati sono quelli in cui hai scelto di allenarti. Li cambi dal profilo.</div>
    </div>
    ${nw ? `<div class="card next-wo"><div class="lab">${plan.includes(new Date().getDay()) ? 'Oggi si allena' : 'Prossimo allenamento'}</div>
      <div class="t">${esc(nw.title)}</div><div class="muted small">${esc(prog.title)}${cycleWeek(prog) ? ` · settimana ${cycleWeek(prog)} di ${prog.weeks}` : ''} · ~${Math.round(estimateSeconds(nw) / 60)} min</div>
      <a class="btn primary block" style="margin-top:12px" href="#/w/${prog.id}/${nw.id}">▶ Vai all'allenamento</a></div>`
      : '<div class="card muted">Nessun programma disponibile per ora.</div>'}
    ${board.challenges.length ? `<div class="h2">Challenge</div>${board.challenges.map(challengeCard).join('')}` : ''}
    ${board.tips.length ? `<div class="h2">Consigli</div>${board.tips.map((tp) => `<div class="card tip">${tp.image ? `<img src="${esc(tp.image)}" alt="">` : ''}<b>${esc(tp.title)}</b><div class="muted">${esc(tp.text).replace(/\n/g, '<br>')}</div></div>`).join('')}` : ''}
  `);
  $app.querySelectorAll('[data-ch]').forEach((el) => el.addEventListener('click', onChallenge));
}

function challengeCard(c) {
  const logs = ME.challengeLogs[c.id] || {};
  const t = todayIso();
  const v = logs[t] || 0;
  const target = Number(c.dailyTarget) || 1;
  const daysOk = Object.values(logs).filter((x) => x >= target).length;
  const steps = target >= 1000 ? [500, 1000, 2000] : target >= 50 ? [5, 10, 25] : [1, 5, 10];
  const last7 = weekDays().map((d) => iso(d));
  return `<div class="card ch"><div class="row between"><b>${esc(c.title)}</b><span class="pill accent">${daysOk} ${daysOk === 1 ? 'giorno' : 'giorni'} completati</span></div>
    ${c.description ? `<div class="muted small">${esc(c.description)}</div>` : ''}
    <div class="chval"><b>${v.toLocaleString('it-IT')}</b><span class="muted"> / ${target.toLocaleString('it-IT')} ${esc(c.unit)} oggi</span></div>
    <div class="meter"><i style="width:${Math.min(100, (v / target) * 100)}%"></i></div>
    <div class="row">${steps.map((n) => `<button class="sbtn" data-ch="${c.id}" data-add="${n}">+${n.toLocaleString('it-IT')}</button>`).join('')}
      <button class="sbtn" data-ch="${c.id}" data-set="1">Scrivi…</button>${v ? `<button class="sbtn ghost" data-ch="${c.id}" data-add="-${steps[0]}">−${steps[0]}</button>` : ''}</div>
    <div class="dots">${last7.map((k) => `<i class="${(logs[k] || 0) >= target ? 'ok' : logs[k] ? 'part' : ''}" title="${k}"></i>`).join('')}</div></div>`;
}
async function onChallenge(e) {
  const b = e.currentTarget, id = b.dataset.ch;
  const t = todayIso();
  const cur = (ME.challengeLogs[id] || {})[t] || 0;
  let value = cur + Number(b.dataset.add || 0);
  if (b.dataset.set) { const x = prompt('Quanto hai fatto oggi?', cur); if (x === null) return; value = Number(String(x).replace(',', '.')) || 0; }
  try { ME.challengeLogs[id] = await api(`/api/me/challenge/${id}`, 'PUT', { date: t, value: Math.max(0, value) }); homeView(); } catch (err) { toast(err.message, true); }
}

// ---- allenamenti ---------------------------------------------------------------
async function trainView() {
  const list = await api('/api/programs');
  const { current, past, base } = sortPrograms(list);
  const mine = (p) => (p.id === (ME.activeProgramId || (current[0] || base[0])?.id) ? '<span class="pill ok">Il tuo programma</span>' : '');
  page('train', `<div class="h1">Allena<em>menti</em></div>
    ${current.length ? `<div class="h2">Ciclo in corso</div>${current.map((p) => programCard(p, `<span class="pill">Settimana ${cycleWeek(p)} di ${p.weeks}</span>${mine(p)}`)).join('')}` : ''}
    ${base.length ? `<div class="h2">Programmi base</div>${base.map((p) => programCard(p, mine(p))).join('')}` : ''}
    ${past.length ? `<div class="h2">Cicli passati</div>${past.map((p) => programCard(p, mine(p))).join('')}` : ''}
    ${!list.length ? '<div class="empty">Nessun programma pubblicato per ora.</div>' : ''}`);
}

async function programView(pid) {
  const p = await getProgram(pid);
  const done = new Set(ME.history.filter((h) => h.programId === pid).map((h) => h.workoutId));
  const wk = cycleWeek(p);
  const byWeek = new Map();
  for (const w of p.workouts) {
    const k = w.week ? Number(w.week) : 0;
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k).push(w);
  }
  const isMine = ME.activeProgramId === pid;
  page('train', `<a class="back" href="#/train">‹ Allenamenti</a>
    ${p.cover ? `<div class="prog"><div class="cover" style="background-image:url('${esc(p.cover)}')"></div></div>` : ''}
    <div class="row"><span class="pill accent">${esc(p.level)}</span>${p.weeks ? `<span class="pill">${esc(p.weeks)} settimane</span>` : ''}${wk ? `<span class="pill">Settimana ${wk}</span>` : ''}</div>
    <div class="h1">${esc(p.title)}</div><div class="muted">${esc(p.description)}</div>
    <button class="btn ${isMine ? '' : 'primary'} block" style="margin-top:14px" id="setmine" ${isMine ? 'disabled' : ''}>${isMine ? '✓ È il tuo programma' : 'Segui questo programma'}</button>
    ${[...byWeek].sort((a, b) => a[0] - b[0]).map(([k, ws]) => `<div class="h2">${k ? `Settimana ${k}${k === wk ? ' · <em>questa settimana</em>' : ''}` : 'Allenamenti'}</div>` + ws.map((w, i) => `
      <a class="wo ${done.has(w.id) ? 'done' : ''}" href="#/w/${pid}/${w.id}"><div class="num">${done.has(w.id) ? '✓' : i + 1}</div>
        <div><div class="t">${esc(w.title)}</div><div class="muted small">~${Math.round(estimateSeconds(w) / 60)} min${w.description ? ` · ${esc(w.description)}` : ''}</div></div><div class="go">›</div></a>`).join('')).join('')}`);
  document.getElementById('setmine').onclick = async () => { ME = await api('/api/me', 'PUT', { activeProgramId: pid }); toast('Programma impostato'); programView(pid); };
}

async function workoutView(pid, wid) {
  const p = await getProgram(pid);
  const w = p.workouts.find((x) => x.id === wid);
  if (!w) throw new Error('Allenamento non trovato');
  const ex = (id) => p.exercises[id] || { name: '?' };
  page('train', `<a class="back" href="#/p/${pid}">‹ ${esc(p.title)}</a>
    <div class="h1">${esc(w.title)}</div><div class="muted">${esc(w.description || '')}</div>
    <div class="row" style="margin:12px 0 18px"><span class="pill accent">~${Math.round(estimateSeconds(w) / 60)} min</span></div>
    <div class="blocklist">${(w.phases || []).map((ph) => `<div class="ph">${esc(ph.title || PHASE_TYPES[ph.type])}</div>` + (ph.blocks || []).map((b) => `
      <div class="bl"><div style="font-weight:800">${esc(b.title || '')} <span class="muted small">${esc(blockSummary(b))}</span></div>
      ${(b.items || []).map((it) => `<div class="ex">${thumb(ex(it.exerciseId))}<div><b>${esc(it.reps || (it.time ? it.time + 's' : ''))}</b> ${esc(ex(it.exerciseId).name)}</div></div>`).join('')}</div>`).join('')).join('')}</div>
    <div style="height:16px"></div><a class="btn primary block" href="#/play/${pid}/${wid}">▶ Inizia allenamento</a>`);
}
const thumb = (e) => (e.video ? `<video class="thumb" src="${esc(e.video)}#t=0.5" muted playsinline preload="metadata"></video>` : '<div class="thumb"></div>');

async function playView(pid, wid) {
  const p = await getProgram(pid);
  const w = p.workouts.find((x) => x.id === wid);
  if (!w) throw new Error('Allenamento non trovato');
  startPlayer($app, p, w, {
    onExit: () => { location.hash = `#/w/${pid}/${wid}`; },
    onFinish: async (res) => {
      let saved = true;
      try { ME.history.push(await api('/api/me/workouts', 'POST', res)); } catch { saved = false; }
      $app.innerHTML = `<div class="wrap finish"><div class="big">✓</div><div class="h1">Fatto!</div><div class="muted">${esc(res.workoutTitle)}</div>
        <div style="margin:24px 0;text-align:left"><div class="stat"><span>Durata</span><b>${fmt(res.seconds)}</b></div>
        ${Object.entries(res.results).map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
        ${saved ? '' : '<div class="muted small">Non sono riuscito a salvarlo: controlla la connessione.</div>'}
        <a class="btn primary block" href="#/">Torna a oggi</a></div>`;
    },
  });
}

// ---- progressi -----------------------------------------------------------------
function progressView() {
  const h = ME.history;
  const mins = Math.round(h.reduce((a, x) => a + x.seconds, 0) / 60);
  const memberDays = Math.floor((Date.now() - new Date(ME.joined).getTime()) / DAY) + 1;
  const ws = ME.weights;
  const photos = ME.photos.slice().sort((a, b) => a.date.localeCompare(b.date));
  const before = photos.find((x) => x.kind === 'before') || photos[0];
  const after = [...photos].reverse().find((x) => x.kind === 'after') || (photos.length > 1 ? photos.at(-1) : null);
  const src = (ph) => `/api/me/photos/${ph.file}`;
  page('progress', `<div class="h1">Progressi</div>
    <div class="stats3"><div><b>${h.length}</b><span>allenamenti</span></div><div><b>${mins}</b><span>minuti</span></div><div><b>${memberDays}</b><span>giorni membro</span></div></div>
    <div class="h2">Peso</div>
    <div class="card">${weightChart(ws)}
      <form class="row" id="wform" style="margin-top:10px"><input name="kg" type="number" step="0.1" min="20" max="300" placeholder="Peso di oggi (kg)" style="flex:1" required><button class="btn primary">Salva</button></form>
      ${ws.length ? `<div class="muted small" style="margin-top:8px">Inizio ${ws[0].kg} kg · ora ${ws.at(-1).kg} kg · ${(ws.at(-1).kg - ws[0].kg >= 0 ? '+' : '')}${(ws.at(-1).kg - ws[0].kg).toFixed(1)} kg</div>` : ''}</div>
    <div class="h2">Foto prima e dopo</div>
    <div class="card">
      ${before && after ? `<div class="ba"><figure><img src="${src(before)}" alt="Prima"><figcaption>Prima · ${new Date(before.date).toLocaleDateString('it-IT')}</figcaption></figure><figure><img src="${src(after)}" alt="Dopo"><figcaption>Dopo · ${new Date(after.date).toLocaleDateString('it-IT')}</figcaption></figure></div>`
        : '<div class="muted small">Carica la tua foto "prima": tra qualche settimana la confronterai con il "dopo". Le foto le vedi solo tu.</div>'}
      <form id="pform" class="row" style="margin-top:12px"><select name="kind"><option value="before">Prima</option><option value="progress" ${photos.length ? 'selected' : ''}>Progresso</option><option value="after">Dopo</option></select>
        <label class="btn primary" style="flex:1">+ Foto<input type="file" name="file" accept="image/*" hidden></label></form>
      ${photos.length ? `<div class="pgrid">${photos.map((ph) => `<div><img src="${src(ph)}" alt=""><span>${new Date(ph.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span><button class="x" data-delph="${ph.id}">✕</button></div>`).join('')}</div>` : ''}
    </div>
    <div class="h2">Storico allenamenti</div>
    ${h.length ? h.slice().reverse().map((x) => `<div class="wo"><div class="num">✓</div><div><div class="t">${esc(x.workoutTitle)}</div>
      <div class="muted small">${esc(x.programTitle)} · ${new Date(x.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · ${fmt(x.seconds)}</div>
      ${Object.entries(x.results || {}).map(([k, v]) => `<div class="small" style="color:var(--accent)">${esc(k)}: ${esc(v)}</div>`).join('')}</div></div>`).join('') : '<div class="empty">Ancora nessun allenamento completato.</div>'}`);
  document.getElementById('wform').onsubmit = async (e) => {
    e.preventDefault();
    try { ME.weights = await api('/api/me/weight', 'PUT', { date: todayIso(), kg: e.target.kg.value }); progressView(); } catch (err) { toast(err.message, true); }
  };
  document.querySelector('#pform input[type=file]').onchange = async (e) => {
    const fd = new FormData();
    fd.append('kind', document.querySelector('#pform select').value);
    fd.append('date', todayIso());
    fd.append('file', e.target.files[0]);
    try { ME.photos.push(await api('/api/me/photos', 'POST', fd)); toast('Foto salvata'); progressView(); } catch (err) { toast(err.message, true); }
  };
  $app.querySelectorAll('[data-delph]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Eliminare la foto?')) return;
    await api(`/api/me/photos/${b.dataset.delph}`, 'DELETE');
    ME.photos = ME.photos.filter((x) => x.id !== b.dataset.delph);
    progressView();
  }));
}

function weightChart(ws) {
  if (ws.length < 2) return `<div class="muted small">${ws.length ? `Ultimo peso: <b>${ws[0].kg} kg</b>. ` : ''}Segna il peso una volta a settimana per vedere il grafico.</div>`;
  const W = 320, H = 110, pad = 10;
  const ks = ws.map((w) => w.kg), lo = Math.min(...ks) - 0.5, hi = Math.max(...ks) + 0.5;
  const pts = ws.map((w, i) => [pad + (i / (ws.length - 1)) * (W - 2 * pad), pad + (1 - (w.kg - lo) / (hi - lo)) * (H - 2 * pad)]);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Andamento del peso">
    <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 4.5 : 2.5}" fill="var(--accent)"><title>${ws[i].date}: ${ws[i].kg} kg</title></circle>`).join('')}</svg>`;
}

// ---- cibo (conta calorie e macro) ------------------------------------------------
// Fattore attività dagli allenamenti a settimana (giorni scelti nel profilo).
const activityFactor = (n) => (n <= 0 ? 1.2 : n <= 2 ? 1.375 : n <= 4 ? 1.55 : n <= 6 ? 1.725 : 1.9);
const MACRO_PRESETS = [['Bilanciato', 30, 40, 30], ['Più proteine', 40, 35, 25], ['Low carb', 35, 25, 40], ['Più carboidrati', 25, 50, 25]];
function targets() {
  const pr = ME.profile, n = ME.nutrition;
  const kg = ME.weights.at(-1)?.kg;
  let kcal = Number(n.kcal) || 0, auto = false;
  if (!kcal) {
    if (!kg || !pr.heightCm || !pr.birthYear || !pr.sex) return null;
    const age = new Date().getFullYear() - Number(pr.birthYear);
    const bmr = 10 * kg + 6.25 * Number(pr.heightCm) - 5 * age + (pr.sex === 'M' ? 5 : -161); // Mifflin-St Jeor
    const adj = { lose: -400, maintain: 0, gain: 300 }[pr.goal] || 0;
    kcal = Math.round((bmr * activityFactor((pr.trainingDays || []).length) + adj) / 10) * 10;
    auto = true;
  }
  return { kcal, auto, p: Math.round((kcal * n.p) / 100 / 4), c: Math.round((kcal * n.c) / 100 / 4), f: Math.round((kcal * n.f) / 100 / 9) };
}
const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
const macroBar = (label, val, tgt, color) => `<div class="mac"><div class="row between small"><span>${label}</span><span><b>${val}</b>${tgt ? ` / ${tgt} g` : ' g'}</span></div><div class="meter thin"><i style="width:${tgt ? Math.min(100, (val / tgt) * 100) : 0}%;background:${color}"></i></div></div>`;
function foodView(day) {
  const d = day || todayIso();
  const items = ME.food.filter((f) => f.date === d);
  const sum = (k) => items.reduce((a, f) => a + (f[k] || 0), 0);
  const kcal = sum('kcal');
  const tg = targets();
  const n = ME.nutrition;
  const coach = n.by === 'coach';
  const shift = (x) => iso(new Date(new Date(d + 'T12:00').getTime() + x * DAY));
  const recent = [...new Map(ME.food.slice().reverse().map((f) => [f.name.toLowerCase(), f])).values()].slice(0, 8);
  const hour = new Date().getHours();
  const defMeal = hour < 11 ? 'Colazione' : hour < 16 ? 'Pranzo' : hour < 22 ? 'Cena' : 'Spuntino';
  page('food', `<div class="h1">Cibo</div>
    <div class="row between daynav"><a class="sbtn" href="#/food/${shift(-1)}">‹</a><b>${d === todayIso() ? 'Oggi' : new Date(d + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}</b>${d < todayIso() ? `<a class="sbtn" href="#/food/${shift(1)}">›</a>` : '<span class="sbtn" style="opacity:.3">›</span>'}</div>
    <div class="card">
      ${tg ? `<div class="kcal"><b>${kcal}</b><span>/ ${tg.kcal} kcal</span></div><div class="meter"><i style="width:${Math.min(100, (kcal / tg.kcal) * 100)}%;${kcal > tg.kcal ? 'background:#ff6b6b' : ''}"></i></div>
        <div class="muted small" style="margin:-4px 0 10px">${tg.kcal - kcal >= 0 ? `Ti restano ${tg.kcal - kcal} kcal` : `Sei sopra di ${kcal - tg.kcal} kcal`}</div>
        ${macroBar(`Proteine ${n.p}%`, sum('protein'), tg.p, 'var(--accent)')}${macroBar(`Carboidrati ${n.c}%`, sum('carbs'), tg.c, '#3aa0ff')}${macroBar(`Grassi ${n.f}%`, sum('fat'), tg.f, '#f5c542')}`
        : `<div class="kcal"><b>${kcal}</b><span>kcal</span></div><div class="muted small">Inserisci peso, altezza, sesso e anno di nascita nel <a href="#/profile">profilo</a>: calcolo io le tue calorie e i tuoi macro.</div>`}
    </div>
    <form class="card form" id="fform">
      <div class="row"><input name="name" placeholder="Cosa hai mangiato?" required style="flex:2"><select name="meal" style="flex:1">${MEALS.map((m) => `<option ${m === defMeal ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="row four"><input name="kcal" type="number" min="0" placeholder="kcal"><input name="protein" type="number" min="0" placeholder="P g"><input name="carbs" type="number" min="0" placeholder="C g"><input name="fat" type="number" min="0" placeholder="G g"></div>
      <div class="muted small" style="margin-top:-4px">Se non sai le kcal, scrivi solo i grammi dei macro: le calcolo io.</div>
      <button class="btn primary block">Aggiungi</button>
      ${recent.length ? `<div class="muted small">Aggiungi di nuovo:</div><div class="row">${recent.map((f, i) => `<button type="button" class="sbtn" data-re="${i}">${esc(f.name)} · ${f.kcal}</button>`).join('')}</div>` : ''}
    </form>
    ${MEALS.map((m) => { const xs = items.filter((f) => f.meal === m); return xs.length ? `<div class="h2">${m} <span class="muted small">${xs.reduce((a, f) => a + f.kcal, 0)} kcal</span></div>${xs.map((f) => `<div class="food"><div><b>${esc(f.name)}</b><div class="muted small">${f.kcal} kcal · P ${f.protein || 0} · C ${f.carbs || 0} · G ${f.fat || 0}</div></div><button class="sbtn ghost" data-delf="${f.id}">✕</button></div>`).join('')}` : ''; }).join('')}
    ${!items.length ? '<div class="empty">Niente segnato per questa giornata.</div>' : ''}
    <div class="h2">I tuoi macro</div>
    <div class="card">
      ${coach ? `<div class="pill accent">Impostati dal tuo coach${n.coach ? ` · ${esc(n.coach)}` : ''}</div>
        <div class="macpct"><span><b>${n.p}%</b>Proteine</span><span><b>${n.c}%</b>Carboidrati</span><span><b>${n.f}%</b>Grassi</span></div>
        ${n.kcal ? `<div class="muted small">Calorie giornaliere: <b>${esc(n.kcal)}</b> kcal</div>` : ''}${n.note ? `<div class="note-coach">${esc(n.note).replace(/\n/g, '<br>')}</div>` : ''}`
      : `<div class="muted small" style="margin-bottom:10px">Scegli come dividere le calorie. Le percentuali devono fare 100.</div>
        <div class="row">${MACRO_PRESETS.map(([l, p, c, f]) => `<button class="sbtn ${n.p === p && n.c === c && n.f === f ? 'on' : ''}" data-preset="${p},${c},${f}">${l}</button>`).join('')}</div>
        <form id="mform" class="row four" style="margin-top:12px"><label>P %<input name="p" type="number" min="0" max="100" value="${n.p}"></label><label>C %<input name="c" type="number" min="0" max="100" value="${n.c}"></label><label>G %<input name="f" type="number" min="0" max="100" value="${n.f}"></label><button class="btn primary">Salva</button></form>
        <div class="muted small" id="msum"></div>`}
    </div>`);
  const add = async (f) => { try { ME.food.push(await api('/api/me/food', 'POST', { ...f, date: d })); foodView(day); } catch (err) { toast(err.message, true); } };
  document.getElementById('fform').onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!Number(f.kcal) && !Number(f.protein) && !Number(f.carbs) && !Number(f.fat)) return toast('Scrivi le kcal o almeno un macro', true);
    add(f);
  };
  $app.querySelectorAll('[data-re]').forEach((b) => (b.onclick = () => { const f = recent[Number(b.dataset.re)]; add({ name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, meal: document.querySelector('#fform [name=meal]').value }); }));
  $app.querySelectorAll('[data-delf]').forEach((b) => (b.onclick = async () => { await api(`/api/me/food/${b.dataset.delf}`, 'DELETE'); ME.food = ME.food.filter((x) => x.id !== b.dataset.delf); foodView(day); }));
  const saveMacros = async (p, c, f) => { try { ME = await api('/api/me', 'PUT', { nutrition: { p, c, f } }); toast('Macro salvati'); foodView(day); } catch (err) { toast(err.message, true); } };
  $app.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => saveMacros(...b.dataset.preset.split(',').map(Number))));
  const mf = document.getElementById('mform');
  if (mf) {
    const upd = () => { const t = ['p', 'c', 'f'].reduce((a, k) => a + (Number(mf[k].value) || 0), 0); document.getElementById('msum').textContent = `Totale ${t}%${t === 100 ? ' ✓' : ' (deve fare 100)'}`; };
    mf.oninput = upd; upd();
    mf.onsubmit = (e) => { e.preventDefault(); saveMacros(Number(mf.p.value), Number(mf.c.value), Number(mf.f.value)); };
  }
}

// ---- profilo -------------------------------------------------------------------
function accessInfo() {
  if (!ME.accessUntil) return '<span class="pill">Abbonamento non attivo</span>';
  const left = Math.ceil((new Date(ME.accessUntil + 'T23:59').getTime() - Date.now()) / DAY);
  const date = new Date(ME.accessUntil + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  return ME.active ? `<span class="pill ${left <= 7 ? 'accent' : 'ok'}">Attivo fino al ${date}${left <= 7 ? ` · ${left} ${left === 1 ? 'giorno' : 'giorni'}` : ''}</span>` : `<span class="pill">Scaduto il ${date}</span>`;
}
function profileView() {
  const pr = ME.profile;
  const days = [1, 2, 3, 4, 5, 6, 0];
  const kg = ME.weights.at(-1)?.kg || '';
  page('profile', `<div class="h1">Profilo</div>
    <div class="card"><div class="row between"><b>Abbonamento</b>${accessInfo()}</div>
      ${SETTINGS.shopUrl ? `<a class="btn block" style="margin-top:12px" href="${esc(SETTINGS.shopUrl)}" target="_blank" rel="noopener">${ME.active ? 'Rinnova sul sito' : 'Attiva sul sito'}</a>` : ''}</div>
    <form class="card form" id="prof">
      <label>Nome<input name="name" value="${esc(ME.name)}"></label>
      <div class="muted small">${esc(ME.email)} · iscritto dal ${new Date(ME.joined).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="lbl2">Giorni in cui ti alleni</div>
      <div class="daypick">${days.map((d) => `<label><input type="checkbox" name="td" value="${d}" ${(pr.trainingDays || []).includes(d) ? 'checked' : ''}><span>${WD[d]}</span></label>`).join('')}</div>
      <div class="muted small" id="tdn"></div>
      <div class="row"><label style="flex:1">Peso (kg)<input name="kg" type="number" step="0.1" min="30" max="300" value="${esc(kg)}"></label>
        <label style="flex:1">Altezza (cm)<input name="heightCm" type="number" min="120" max="230" value="${esc(pr.heightCm)}"></label></div>
      <div class="row"><label style="flex:1">Sesso<select name="sex"><option value="">—</option><option value="M" ${pr.sex === 'M' ? 'selected' : ''}>Uomo</option><option value="F" ${pr.sex === 'F' ? 'selected' : ''}>Donna</option></select></label>
        <label style="flex:1">Anno di nascita<input name="birthYear" type="number" min="1930" max="2015" value="${esc(pr.birthYear)}"></label></div>
      <label>Obiettivo<select name="goal">${[['lose', 'Dimagrire'], ['maintain', 'Mantenere'], ['gain', 'Aumentare massa']].map(([v, l]) => `<option value="${v}" ${pr.goal === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn primary block">Salva profilo</button>
    </form>
    <button class="btn block" style="margin-top:12px" id="logout">Esci</button>`);
  const form = document.getElementById('prof');
  const tdn = () => { const n = form.querySelectorAll('[name=td]:checked').length; document.getElementById('tdn').textContent = `${n} allenamenti a settimana: li uso anche per calcolare le tue calorie.`; };
  form.addEventListener('change', tdn); tdn();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const profile = { trainingDays: f.getAll('td').map(Number), sex: f.get('sex'), birthYear: f.get('birthYear'), heightCm: f.get('heightCm'), goal: f.get('goal') };
    try {
      ME = await api('/api/me', 'PUT', { name: f.get('name'), profile });
      if (f.get('kg') && Number(f.get('kg')) !== Number(kg)) ME.weights = await api('/api/me/weight', 'PUT', { date: todayIso(), kg: f.get('kg') });
      toast('Profilo salvato');
    } catch (err) { toast(err.message, true); }
  };
  document.getElementById('logout').onclick = async () => { await api('/api/auth/logout', 'POST'); ME = null; progCache.clear(); location.hash = '#/login'; };
}

// ---- abbonamento non attivo -----------------------------------------------------
function paywallView() {
  const expired = !!ME.accessUntil;
  page('', `<div class="topbar">${brand(24)}</div>
    <div class="h1">${expired ? 'Abbonamento <em>scaduto</em>' : 'Quasi <em>dentro</em>'}</div>
    <div class="card">
      <p style="margin-top:0">${expired ? `Il tuo accesso è scaduto il ${new Date(ME.accessUntil + 'T12:00').toLocaleDateString('it-IT')}. Rinnova per tornare ai tuoi allenamenti: progressi e storico restano salvati.`
        : 'Il tuo account è creato. Per sbloccare programmi, challenge e allenamenti serve un abbonamento attivo.'}</p>
      <p class="muted small">Hai già pagato sul sito? Usa la stessa email (<b>${esc(ME.email)}</b>): ti attiviamo l'accesso il prima possibile.</p>
      ${SETTINGS.shopUrl ? `<a class="btn primary block" href="${esc(SETTINGS.shopUrl)}" target="_blank" rel="noopener">Scegli il tuo abbonamento</a>` : ''}
      ${SETTINGS.supportEmail ? `<a class="btn block" style="margin-top:8px" href="mailto:${esc(SETTINGS.supportEmail)}">Scrivici</a>` : ''}
      <button class="btn block" style="margin-top:8px" id="recheck">Ho già pagato, ricontrolla</button>
    </div>
    <a class="sbtn" href="#/profile">Vai al profilo</a>`);
  document.getElementById('recheck').onclick = async () => { ME = await api('/api/me'); if (ME.active) { toast('Accesso attivo!'); route(); } else toast('Non ancora attivo: riprova più tardi', true); };
}

// ---- avvio -------------------------------------------------------------------
(async () => {
  try {
    SETTINGS = await (await fetch('/api/settings')).json();
    document.title = SETTINGS.appName;
  } catch {}
  route();
})();
