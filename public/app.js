import { blockSummary, embedUrl, estimateSeconds, fmt, PHASE_TYPES, setPace } from './engine.js';
import { startPlayer, stopPlayer } from './player.js';
import { FOODS } from './foods.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
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
  community: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.6c2.8.2 4.8 2 5.5 5"/>'),
};
// Foto profilo (o iniziali) in un cerchio
function avatar(src, name, size = 40) {
  const ini = esc(String(name || '?').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase());
  return src ? `<img class="av" src="${esc(src)}" alt="" style="width:${size}px;height:${size}px">` : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${ini}</span>`;
}
const meAvatar = () => `<a href="#/profile" class="meav" aria-label="Profilo">${avatar(ME.community?.avatar, ME.name, 38)}</a>`;
let POLL = null;
const stopPoll = () => { clearInterval(POLL); POLL = null; };
function tabbar(on) {
  const t = (h, k, label, ico) => `<a href="${h}" class="${on === k ? 'on' : ''}"><span>${ico}</span>${label}</a>`;
  return `<nav class="tabbar">${t('#/', 'home', 'Oggi', ICONS.home)}${t('#/train', 'train', 'Allenamenti', ICONS.train)}${t('#/community', 'community', 'Community<i class="badge" id="cbadge" hidden></i>', ICONS.community)}${t('#/progress', 'progress', 'Progressi', ICONS.progress)}${t('#/food', 'food', 'Cibo', ICONS.food)}</nav>`;
}
const previewBar = () => (ME?.id === 'admin-preview' ? `<div class="pvbar">Anteprima admin: qui le modifiche non vengono salvate. <a href="#/register">Iscriviti come membro</a> o <a href="#/login">accedi</a> per usare l'app come i tuoi clienti.</div>` : '');
// Piani di abbonamento: ognuno apre direttamente il suo link di pagamento (se non ci sono piani, il link del sito)
const plans = () => (SETTINGS.plans || []).filter((x) => x.url && x.title);
const hasPlans = () => plans().length > 0 || !!SETTINGS.shopUrl;
function plansHtml() {
  const list = plans();
  if (!list.length) return SETTINGS.shopUrl ? `<a class="btn primary block" href="${esc(SETTINGS.shopUrl)}" target="_blank" rel="noopener">${esc(SETTINGS.shopLabel || 'Scegli il tuo abbonamento')}</a>` : '';
  return `<div class="plans">${list.map((x) => `<a class="plan ${x.best ? 'best' : ''}" href="${esc(x.url)}" target="_blank" rel="noopener">
    ${x.best ? '<span class="tag">Consigliato</span>' : ''}<div class="pt">${esc(x.title)}</div>
    ${x.price ? `<div class="pp"><b>${esc(x.price)}</b> <span>${esc(x.period || '')}</span></div>` : ''}
    ${x.note ? `<div class="pn">${esc(x.note)}</div>` : ''}<div class="pgo">Scegli ›</div></a>`).join('')}</div>`;
}
// Durante la prova gratuita: giorni rimasti e link per abbonarsi, in cima a ogni pagina
const trialLeft = () => Math.max(0, Math.ceil((new Date(ME.trialUntil + 'T23:59').getTime() - Date.now()) / 864e5));
const trialBar = () => (ME?.trial ? `<div class="trialbar">Prova gratuita · ${trialLeft() === 1 ? 'ultimo giorno' : `ancora ${trialLeft()} giorni`}${hasPlans() ? ' · <a href="#/abbonati">Abbonati ›</a>' : ''}</div>` : '');
const dayIt = (d) => new Date(d + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const lockText = (w) => (w.lockReason === 'drip' && w.unlockOn ? `Si sblocca ${dayIt(w.unlockOn)}` : w.lockReason === 'cycle' && w.unlockOn ? `Dal ${dayIt(w.unlockOn)}` : "Con l'abbonamento");
// allenamento bloccato: in prova si propone l'abbonamento, altrimenti si dice quando si sblocca
function openLocked(pid, w) {
  location.replace(`#/p/${pid}`);
  if (w.lockReason === 'trial') return lockedSheet();
  toast(`${lockText(w)}: una settimana nuova ogni 7 giorni 💪`);
}
// Contenuto bloccato in prova: spiega e porta al sito per l'abbonamento
function lockedSheet() {
  document.querySelector('.locksheet')?.remove();
  const m = document.createElement('div');
  m.className = 'locksheet';
  m.innerHTML = `<div class="card"><div class="h1" style="font-size:24px;margin-top:0">🔒 Sblocca <em>tutto</em></div>
    <p class="muted" style="margin-top:0">Nella settimana di prova puoi fare gli allenamenti di una settimana. Con l'abbonamento sblocchi tutti i programmi, tutte le settimane e i nuovi cicli.</p>
    ${plansHtml()}
    <button class="btn block" style="margin-top:8px" data-close>Continua la prova</button></div>`;
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); };
  document.body.append(m);
}
function page(tab, html) { $app.innerHTML = `${previewBar()}${trialBar()}<div class="wrap">${html}</div>${tabbar(tab)}`; refreshBadge(); }
// Pallino con i messaggi privati non letti sull'icona Community
async function refreshBadge() {
  if (!ME?.active || !ME.community?.joined) return;
  try {
    const { dm } = await (await fetch('/api/community/unread')).json();
    const b = document.getElementById('cbadge');
    if (b) { b.hidden = !dm; b.textContent = dm > 9 ? '9+' : dm; }
  } catch {}
}
setInterval(() => document.visibilityState === 'visible' && refreshBadge(), 30000);
function fail(e) { page('', `<a class="back" href="#/">‹ Indietro</a><div class="empty">${esc(e.message)}</div>`); }

// ---- router ------------------------------------------------------------------
window.addEventListener('hashchange', route);
async function route() {
  stopPlayer();
  stopPoll();
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  // link da mandare per la prova gratuita: #/prova → registrazione e la prova parte da sola
  if (parts[0] === 'prova') {
    ls.set('wantTrial', true);
    if (!ME) { const r = await fetch('/api/me', { credentials: 'same-origin' }); if (r.ok) ME = await r.json(); }
    if (!ME) return authView('register', true);
    location.replace('#/'); return;
  }
  if (parts[0] === 'login' || parts[0] === 'register') return authView(parts[0], ls.get('wantTrial', false));
  if (parts[0] === 'forgot') return forgotView();
  if (parts[0] === 'reset' && parts[1]) return resetView(parts[1]);
  if (!ME) {
    try { ME = await api('/api/me'); } catch { return; }
  }
  // arrivato dal link della prova: la attiva appena entra (se è ancora disponibile per la sua email)
  if (ls.get('wantTrial', false)) {
    ls.set('wantTrial', false);
    if (ME.trialAvailable) { try { ME = await api('/api/me/trial', 'POST'); progCache.clear(); toast(`Settimana di prova attiva: buon allenamento!`); } catch (err) { toast(err.message, true); } }
  }
  if (parts[0] === 'abbonati') return plansView();
  if (!ME.active && parts[0] !== 'profile') return paywallView();
  try {
    if (parts[0] === 'train') return await trainView();
    if (parts[0] === 'tutorials') return await tutorialsView(decodeURIComponent(parts[1] || ''));
    if (parts[0] === 'tutorial' && parts[1]) return await tutorialView(parts[1]);
    if (parts[0] === 'community') return await communityView(parts[1] || 'chat', parts[2]);
    if (parts[0] === 'chat' && parts[1]) return await chatView(parts[1]);
    if (parts[0] === 'p' && parts[1]) return await programView(parts[1]);
    if (parts[0] === 'w' && parts[2]) return await workoutView(parts[1], parts[2]);
    if (parts[0] === 'play' && parts[2]) return await playView(parts[1], parts[2]);
    if (parts[0] === 'progress') return progressView(parts[1], parts[2]);
    if (parts[0] === 'food') return foodView(parts[1]);
    if (parts[0] === 'profile') return profileView();
    return await homeView();
  } catch (e) { fail(e); }
}

// ---- accesso -----------------------------------------------------------------
function authView(mode, trial = false) {
  const reg = mode === 'register';
  const days = Number(SETTINGS.trialDays) || 7;
  $app.innerHTML = `<div class="wrap auth">${brand(34)}<div class="muted" style="margin:6px 0 26px">${esc(SETTINGS.tagline || '')}</div>
    ${trial && SETTINGS.trialEnabled ? `<div class="card trialcard" style="margin-bottom:12px"><b>Settimana di prova gratuita</b><div class="muted small">${reg ? 'Crea il tuo account' : 'Accedi'} e hai ${days} giorni di allenamenti gratis, senza pagamento.</div></div>` : ''}
    <form class="card form">
      <div class="h2" style="margin-top:0">${reg ? 'Crea il tuo account' : 'Accedi'}</div>
      ${reg ? '<label>Nome<input name="name" autocomplete="name" required></label>' : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="6" required></label>
      <button class="btn primary block">${reg ? 'Iscriviti' : 'Entra'}</button>
    </form>
    ${reg ? '' : '<div class="small" style="text-align:center;margin-top:14px"><a href="#/forgot">Password dimenticata?</a></div>'}
    <div class="muted small" style="text-align:center;margin-top:16px">${reg ? 'Hai già un account? <a href="#/login">Accedi</a>' : 'Non hai un account? <a href="#/register">Iscriviti</a>'}</div></div>`;
  $app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { ME = await api(`/api/auth/${reg ? 'register' : 'login'}`, 'POST', f); location.hash = '#/'; } catch (err) { toast(err.message, true); }
  };
}

function forgotView() {
  $app.innerHTML = `<div class="wrap auth">${brand(34)}
    <form class="card form" style="margin-top:26px">
      <div class="h2" style="margin-top:0">Password dimenticata</div>
      <div class="muted small">Scrivi l'email con cui ti sei iscritto: ti mandiamo un link per sceglierne una nuova.</div>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <button class="btn primary block">Mandami il link</button>
    </form>
    <div class="muted small" style="text-align:center;margin-top:16px"><a href="#/login">Torna ad accedere</a></div></div>`;
  $app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    try { await api('/api/auth/forgot', 'POST', { email }); } catch { /* la risposta è sempre la stessa */ }
    e.target.outerHTML = `<div class="card"><div class="h2" style="margin-top:0">Controlla la tua email 📬</div><div class="muted">Se <b>${esc(email)}</b> è iscritta, tra un minuto ti arriva il link per la nuova password (guarda anche nello spam). Il link vale 1 ora.</div>
      ${SETTINGS.supportEmail ? `<div class="muted small" style="margin-top:10px">Non arriva? Scrivi a <b>${esc(SETTINGS.supportEmail)}</b></div>` : ''}</div>`;
  };
}
function resetView(token) {
  $app.innerHTML = `<div class="wrap auth">${brand(34)}
    <form class="card form" style="margin-top:26px">
      <div class="h2" style="margin-top:0">Nuova password</div>
      <label>Nuova password<input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
      <label>Ripetila<input name="password2" type="password" autocomplete="new-password" minlength="6" required></label>
      <button class="btn primary block">Salva e entra</button>
    </form></div>`;
  $app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.password !== f.password2) return toast('Le due password non coincidono', true);
    try { ME = await api('/api/auth/reset', 'POST', { token, password: f.password }); toast('Password cambiata: bentornato!'); location.hash = '#/'; } catch (err) { toast(err.message, true); }
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
  let pool = p.workouts.filter((w) => !w.locked);
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
    <div class="topbar">${brand(24)}<span class="row" style="gap:8px"><span class="pill">Membro da ${memberDays} ${memberDays === 1 ? 'giorno' : 'giorni'}</span>${meAvatar()}</span></div>
    <div class="h1">Ciao <em>${esc(ME.name.split(' ')[0])}</em></div>
    ${welcomeSrc() && ME.welcomeSeen !== welcomeSrc() ? `<div class="card welcome" id="welcome"><button class="wplay" data-wplay>▶</button><div style="flex:1" data-wplay><b>${esc(SETTINGS.welcomeTitle || 'Guarda il video di benvenuto')}</b><div class="muted small">Come funziona l'app, in poco più di un minuto</div></div><button class="icon" id="wclose" aria-label="Non mostrare più">✕</button></div>` : ''}
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
    ${board.tips.length ? `<div class="h2">Consigli</div>${board.tips.map((tp) => `<div class="card tip">${embedUrl(tp.videoUrl) ? `<div class="tvid"><iframe src="${esc(embedUrl(tp.videoUrl))}" allow="encrypted-media; fullscreen" allowfullscreen loading="lazy" title="${esc(tp.title)}"></iframe></div>` : tp.image ? `<img src="${esc(tp.image)}" alt="">` : ''}<b>${esc(tp.title)}</b><div class="muted">${esc(tp.text).replace(/\n/g, '<br>')}</div></div>`).join('')}` : ''}
  `);
  $app.querySelectorAll('[data-ch]').forEach((el) => el.addEventListener('click', onChallenge));
  $app.querySelectorAll('[data-wplay]').forEach((el) => { el.onclick = () => welcomePlayer(); });
  const wc = document.getElementById('wclose');
  if (wc) wc.onclick = () => welcomeDone();
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
  page('train', `<div class="h1">Allena<em>menti</em></div>${trainTabs('programs')}
    ${current.length ? `<div class="h2">Ciclo in corso</div>${current.map((p) => programCard(p, `<span class="pill">Settimana ${cycleWeek(p)} di ${p.weeks}</span>${mine(p)}`)).join('')}` : ''}
    ${base.length ? `<div class="h2">Programmi base</div>${base.map((p) => programCard(p, mine(p))).join('')}` : ''}

    ${!list.length ? '<div class="empty">Nessun programma pubblicato per ora.</div>' : ''}`);
  if (SETTINGS.trainIntro !== false && !ME.seen?.trainIntro && ME.id !== 'admin-preview') trainIntro(base, current);
}
// Prima visita di Allenamenti: da dove partire (una volta sola per account)
function trainIntro(base, current) {
  const m = document.createElement('div');
  m.className = 'tutmodal introsheet';
  const firstBase = base[0];
  m.innerHTML = `<div class="sc-box">
    <div class="h1" style="font-size:26px;margin-top:0">Da dove <em>partire?</em></div>
    <div class="intro-opt"><b>🟢 Sei nuovo o hai iniziato da poco?</b>
      <div class="muted">Parti dai <b>Kettlebell Base</b>: prima il <b>Volume 1</b>, poi il 2 e il 3. Ogni volume è un po' più difficile del precedente, così impari bene la tecnica e cresci passo dopo passo.</div></div>
    <div class="intro-opt"><b>🔥 Sei già intermedio o avanzato?</b>
      <div class="muted">Puoi allenarti con il <b>ciclo del mese</b>, quello in corso.</div></div>
    <div class="intro-warn">⚠️ Se sei nuovo, <b>non partire dal ciclo in corso</b>: è pensato per chi ha già esperienza e rischi di non riuscire a stare al passo.</div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:16px">
      ${firstBase ? `<a class="btn primary" style="flex:1" href="#/p/${firstBase.id}" data-close>Inizio dal Volume 1</a>` : ''}
      <button class="btn" style="flex:1" data-close>Ho capito</button></div></div>`;
  const close = () => { m.remove(); ME.seen = { ...(ME.seen || {}), trainIntro: true }; api('/api/me/seen', 'POST', { key: 'trainIntro' }).catch(() => {}); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.body.append(m);
}

async function programView(pid) {
  const p = await getProgram(pid);
  const done = new Set(ME.history.filter((h) => h.programId === pid).map((h) => h.workoutId));
  const wk = cycleWeek(p);
  const byWeek = new Map();
  // nei cicli le settimane future non compaiono proprio
  for (const w of p.workouts.filter((x) => !(x.locked && x.lockReason === 'cycle'))) {
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
    ${[...byWeek].sort((a, b) => a[0] - b[0]).map(([k, ws]) => `<div class="h2">${k ? `Settimana ${k}${k === wk ? ' · <em>questa settimana</em>' : ''}` : 'Allenamenti'}</div>` + ws.map((w, i) => (w.locked ? `
      <a class="wo locked" href="#/w/${pid}/${w.id}"><div class="num">🔒</div>
        <div><div class="t">${esc(w.title)}</div><div class="muted small">${lockText(w)}</div></div><div class="go">›</div></a>` : `
      <a class="wo ${done.has(w.id) ? 'done' : ''}" href="#/w/${pid}/${w.id}"><div class="num">${done.has(w.id) ? '✓' : i + 1}</div>
        <div><div class="t">${esc(w.title)}</div><div class="muted small">~${Math.round(estimateSeconds(w) / 60)} min${w.description ? ` · ${esc(w.description)}` : ''}</div></div><div class="go">›</div></a>`)).join('')).join('')}`);
  document.getElementById('setmine').onclick = async () => { ME = await api('/api/me', 'PUT', { activeProgramId: pid }); toast('Programma impostato'); programView(pid); };
}

async function workoutView(pid, wid) {
  const p = await getProgram(pid);
  const w = p.workouts.find((x) => x.id === wid);
  if (!w) throw new Error('Allenamento non trovato');
  if (w.locked) return openLocked(pid, w);
  const ex = (id) => p.exercises[id] || { name: '?' };
  // varianti più facili/difficili scelte nel player e ricordate sul telefono: qui si vedono e si possono annullare
  let subs = {}; try { subs = JSON.parse(localStorage.getItem('subs')) || {}; } catch {}
  const used = new Set((w.phases || []).flatMap((ph) => (ph.blocks || []).flatMap((b) => (b.items || []).map((it) => it.exerciseId))));
  const mySubs = [...used].filter((id) => subs[id] && p.exercises[subs[id]]);
  page('train', `<a class="back" href="#/p/${pid}">‹ ${esc(p.title)}</a>
    <div class="h1">${esc(w.title)}</div><div class="muted">${esc(w.description || '')}</div>
    <div class="row" style="margin:12px 0 18px"><span class="pill accent">~${Math.round(estimateSeconds(w) / 60)} min</span></div>
    ${mySubs.length ? `<div class="card subcard"><b>Le tue varianti</b><div class="muted small">Le hai scelte tu nel player con "più facile / più difficile":</div>
      ${mySubs.map((id) => `<div class="small" style="margin-top:6px">${esc(ex(subs[id]).name)} <span class="muted">al posto di</span> ${esc(ex(id).name)}</div>`).join('')}
      <button class="btn block" style="margin-top:10px" id="resetsubs">↺ Torna agli esercizi originali</button></div>` : ''}
    <div class="blocklist">${(w.phases || []).map((ph) => `<div class="ph">${esc(ph.title || PHASE_TYPES[ph.type])}</div>` + (ph.blocks || []).map((b) => `
      <div class="bl"><div style="font-weight:800">${esc(b.title || '')} <span class="muted small">${esc(blockSummary(b))}</span></div>
      ${b.type === 'video' ? '<div class="ex"><div class="thumb" style="display:grid;place-items:center">▶</div><div>Video da seguire</div></div>' : ''}
      ${(b.items || []).map((it) => `<button class="ex" data-demo="${esc(it.exerciseId)}">${thumb(ex(it.exerciseId))}<div style="flex:1"><b>${esc(it.reps || (it.time ? it.time + 's' : ''))}</b> ${esc(ex(it.exerciseId).name)}</div><span class="demo-go">▶</span></button>`).join('')}</div>`).join('')).join('')}</div>
    <div style="height:16px"></div><a class="btn primary block" href="#/play/${pid}/${wid}">▶ Inizia allenamento</a>
    ${(() => { const last = ME.history.filter((h) => h.workoutId === wid && h.programId === p.id).at(-1); return last ? `<div class="muted small" style="text-align:center;margin-top:10px">✓ L'hai già fatto ${new Date(last.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : ''; })()}
    <button class="btn block" style="margin-top:10px" id="markdone">✓ Segna come fatto</button>
    <div class="muted small" style="text-align:center;margin-top:6px">Ti sei allenato seguendo la scheda senza il player? Segnalo qui, anche in un giorno passato.</div>`);
  document.getElementById('markdone').onclick = () => markDone(p, w);
  // tocca un esercizio: si apre la sua demo in loop con la descrizione
  $app.querySelectorAll('[data-demo]').forEach((b) => (b.onclick = () => {
    const e = ex(b.dataset.demo), emb = !e.video && embedUrl(e.videoUrl, { loop: true });
    const m = document.createElement('div');
    m.className = 'demosheet';
    m.innerHTML = `<div class="card"><div class="row between"><div class="h2" style="margin:0">${esc(e.name)}</div><button class="icon" data-close aria-label="Chiudi">✕</button></div>
      <div class="demovid">${e.videoBox || e.video ? `<video src="${esc(e.videoBox || e.video)}" autoplay muted loop playsinline></video>` : emb ? `<iframe src="${esc(emb)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>` : '<div class="muted" style="padding:40px;text-align:center">Video non ancora caricato</div>'}</div>
      ${e.cues ? `<div class="muted" style="margin-top:10px">${esc(e.cues)}</div>` : ''}</div>`;
    m.onclick = (ev) => { if (ev.target === m || ev.target.closest('[data-close]')) m.remove(); };
    document.body.append(m);
  }));
  const rs = document.getElementById('resetsubs');
  if (rs) rs.onclick = () => { for (const id of mySubs) delete subs[id]; try { localStorage.setItem('subs', JSON.stringify(subs)); } catch {} toast('Esercizi originali ripristinati'); workoutView(pid, wid); };
}
const thumb = (e) => (e.video ? `<video class="thumb" src="${esc(e.video)}#t=0.5" muted playsinline preload="metadata"></video>` : '<div class="thumb"></div>');

// "Segna come fatto": allenamento fatto per conto suo (anche ieri o lunedì), finisce nel calendario e nello storico
function markDone(p, w) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - i * DAY); return { iso: iso(d), label: i === 0 ? 'Oggi' : i === 1 ? 'Ieri' : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' }) }; });
  const m = document.createElement('div');
  m.className = 'tutmodal introsheet';
  let pick = days[0].iso;
  const draw = () => {
    m.innerHTML = `<div class="sc-box"><div class="h1" style="font-size:24px;margin-top:0">Quando l'hai <em>fatto?</em></div>
      <div class="muted" style="margin-bottom:12px">${esc(w.title)} · ${esc(p.title)}</div>
      <div class="daychips">${days.map((d) => `<button data-day="${d.iso}" class="${d.iso === pick ? 'on' : ''}">${esc(d.label)}</button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-top:16px"><button class="btn" style="flex:1" data-cancel>Annulla</button><button class="btn primary" style="flex:1" data-save>✓ Salva</button></div></div>`;
  };
  draw();
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-day]');
    if (b) { pick = b.dataset.day; return draw(); }
    if (e.target === m || e.target.closest('[data-cancel]')) return m.remove();
    if (e.target.closest('[data-save]')) {
      try {
        ME.history.push(await api('/api/me/workouts', 'POST', { programId: p.id, programTitle: p.title, workoutId: w.id, workoutTitle: w.title, seconds: 0, results: {}, scores: [], manual: true, date: pick }));
        ME.history.sort((a, b2) => a.date.localeCompare(b2.date));
        m.remove(); toast('Segnato come fatto 💪'); location.hash = '#/';
      } catch (err) { toast(err.message, true); }
    }
  });
  document.body.append(m);
}

async function playView(pid, wid) {
  const p = await getProgram(pid);
  const w = p.workouts.find((x) => x.id === wid);
  if (!w) throw new Error('Allenamento non trovato');
  if (w.locked) return openLocked(pid, w);
  startPlayer($app, p, w, {
    onExit: () => { location.hash = `#/w/${pid}/${wid}`; },
    onFinish: async (res) => {
      let saved = true;
      try { ME.history.push(await api('/api/me/workouts', 'POST', res)); } catch { saved = false; }
      const entry = saved ? ME.history.at(-1) : null;
      $app.innerHTML = `<div class="wrap finish"><div class="big">✓</div><div class="h1">Fatto!</div><div class="muted">${esc(res.workoutTitle)}</div>
        <div style="margin:24px 0;text-align:left"><div class="stat"><span>Durata</span><b>${fmt(res.seconds)}</b></div>
        ${(res.scores || []).map((sc) => { const c = compareScore(entry, sc); return `<div class="stat"><span>${esc(sc.block)}<small class="cmp ${c.cls}">${esc(c.text)}</small></span><b>${esc(scoreText(sc))}</b></div>`; }).join('')}</div>
        ${saved ? '' : `<div class="muted small">${ME.id === 'admin-preview' ? 'Anteprima admin: il risultato non viene salvato.' : 'Non sono riuscito a salvarlo: controlla la connessione.'}</div>`}
        <a class="btn primary block" href="#/">Torna a oggi</a></div>`;
    },
  });
}

// ---- risultati e record ------------------------------------------------------------
const scoreText = (sc) => (sc.type === 'amrap' ? `${sc.rounds} round${sc.reps ? ` + ${sc.reps} rip` : ''}` : sc.capped ? `Time cap (${fmt(sc.seconds)})` : fmt(sc.seconds));
// true se a è meglio di b (AMRAP: più round/rip; AFAP: meno tempo, il time cap conta come peggiore)
const better = (a, b) => (a.type === 'amrap' ? a.rounds * 10000 + a.reps > b.rounds * 10000 + b.reps : (a.capped ? 1e9 : a.seconds) < (b.capped ? 1e9 : b.seconds));
const sameBlock = (h, entry, key) => h.programId === entry.programId && h.workoutId === entry.workoutId && (h.scores || []).some((x) => x.key === key);
function compareScore(entry, sc) {
  const prev = ME.history.filter((h) => h !== entry && h.date < (entry?.date || '9') && sameBlock(h, entry || {}, sc.key)).map((h) => h.scores.find((x) => x.key === sc.key));
  if (!prev.length) return { cls: '', text: 'Primo risultato: da battere la prossima volta' };
  const best = prev.reduce((a, b) => (better(b, a) ? b : a));
  if (better(sc, best)) return { cls: 'pr', text: '🏆 Nuovo record!' };
  const last = prev.at(-1);
  if (sc.type === 'amrap') {
    const d = sc.rounds * 1000 + sc.reps - (last.rounds * 1000 + last.reps);
    const dr = sc.rounds - last.rounds;
    return d === 0 ? { cls: '', text: 'Uguale all\'ultima volta' } : { cls: d > 0 ? 'up' : 'down', text: `${dr ? `${dr > 0 ? '+' : '−'}${Math.abs(dr)} round` : `${d > 0 ? '+' : '−'}${Math.abs(sc.reps - last.reps)} rip`} rispetto all'ultima volta` };
  }
  if (sc.capped || last.capped) return { cls: '', text: `Ultima volta: ${scoreText(last)}` };
  const d = sc.seconds - last.seconds;
  return d === 0 ? { cls: '', text: 'Stesso tempo dell\'ultima volta' } : { cls: d < 0 ? 'up' : 'down', text: `${d < 0 ? '−' : '+'}${fmt(Math.abs(d))} rispetto all'ultima volta` };
}
// I record: il miglior risultato per ogni blocco AMRAP/AFAP che hai fatto
function personalRecords() {
  const best = new Map();
  for (const h of ME.history) for (const sc of h.scores || []) {
    const k = `${h.programId}|${h.workoutId}|${sc.key}`;
    const cur = best.get(k);
    if (!cur || better(sc, cur.sc)) best.set(k, { sc, h, times: (cur?.times || 0) + 1 }); else cur.times++;
  }
  return [...best.values()].sort((a, b) => b.h.date.localeCompare(a.h.date));
}

// ---- progressi -----------------------------------------------------------------
function progressView(month, day) {
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
    <div class="h2">Diario allenamenti</div>
    ${diary(month, day)}
    ${(() => { const pr = personalRecords(); return pr.length ? `<div class="h2">I miei record</div>${pr.map(({ sc, h: x, times }) => `<div class="rec"><div><b>${esc(sc.block)}</b><div class="muted small">${esc(x.workoutTitle)} · ${new Date(x.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}${times > 1 ? ` · fatto ${times} volte` : ''}</div></div><span class="pill accent">${esc(scoreText(sc))}</span></div>`).join('')}` : ''; })()}`);
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

// Calendario del mese con i giorni allenati; tocchi un giorno e vedi cosa hai fatto
function diary(month, day) {
  const now = new Date();
  const [y, m] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12), days = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const ym = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;
  const prev = m === 1 ? ym(y - 1, 12) : ym(y, m - 1), next = m === 12 ? ym(y + 1, 1) : ym(y, m + 1);
  const byDay = new Map();
  for (const h of ME.history) { const k = iso(new Date(h.date)); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(h); }
  const inMonth = ME.history.filter((h) => iso(new Date(h.date)).startsWith(ym(y, m)));
  const t = todayIso();
  const cells = Array.from({ length: lead }, () => '<span></span>').join('') + Array.from({ length: days }, (_, i) => {
    const k = `${ym(y, m)}-${String(i + 1).padStart(2, '0')}`, n = byDay.get(k)?.length || 0;
    return `<a href="#/progress/${ym(y, m)}/${k}" class="cd ${n ? 'on' : ''} ${k === t ? 'today' : ''} ${k === day ? 'sel' : ''}">${i + 1}${n > 1 ? `<i>${n}</i>` : ''}</a>`;
  }).join('');
  const list = (day ? byDay.get(day) || [] : inMonth).slice().reverse();
  return `<div class="card"><div class="row between"><a class="sbtn" href="#/progress/${prev}">‹</a><b style="text-transform:capitalize">${first.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</b>
      ${ym(y, m) < ym(now.getFullYear(), now.getMonth() + 1) ? `<a class="sbtn" href="#/progress/${next}">›</a>` : '<span class="sbtn" style="opacity:.3">›</span>'}</div>
    <div class="cal"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span>${cells}</div>
    <div class="muted small">${inMonth.length} ${inMonth.length === 1 ? 'allenamento' : 'allenamenti'} questo mese${day ? ` · <a href="#/progress/${ym(y, m)}">mostra tutto il mese</a>` : ''}</div></div>
  ${list.map((x) => `<div class="wo"><div class="num">✓</div><div style="flex:1"><div class="t">${esc(x.workoutTitle)}</div>
      <div class="muted small">${esc(x.programTitle)} · ${new Date(x.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmt(x.seconds)}</div>
      ${(x.scores || []).length ? x.scores.map((sc) => { const c = compareScore(x, sc); return `<div class="small"><span style="color:var(--accent)">${esc(sc.block)}: ${esc(scoreText(sc))}</span> <span class="cmp ${c.cls}">${c.cls === 'pr' ? '🏆' : ''}</span></div>`; }).join('')
        : Object.entries(x.results || {}).map(([k, v]) => `<div class="small" style="color:var(--accent)">${esc(k)}: ${esc(v)}</div>`).join('')}</div></div>`).join('')
    || `<div class="empty">${day ? 'Nessun allenamento in questo giorno.' : 'Nessun allenamento questo mese.'}</div>`}`;
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
    <div class="card form">
      <div class="row"><input id="fq" type="search" placeholder="🔍 Cerca un cibo…" autocomplete="off" style="flex:2"><select id="fmeal" style="flex:1">${MEALS.map((m) => `<option ${m === defMeal ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div id="fres" class="fres"></div><div id="fpick"></div>
      <div class="muted small">Valori medi indicativi per 100 g: scegli il cibo, scrivi i grammi e calcolo io calorie e macro.</div>
    </div>
    <form class="card form" id="fform">
      <div class="muted small" style="margin-top:0"><b>Non lo trovi?</b> Scrivilo tu:</div>
      <div class="row"><input name="name" placeholder="Cosa hai mangiato?" required style="flex:2"><input type="hidden" name="meal"></div>
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
  // ricerca nel database: tutte le parole devono comparire nel nome (senza accenti)
  const nrm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fq = document.getElementById('fq'), fres = document.getElementById('fres'), fpick = document.getElementById('fpick');
  const meal = () => document.getElementById('fmeal').value;
  fq.oninput = () => {
    const words = nrm(fq.value).split(/\s+/).filter(Boolean);
    const hits = words.length ? FOODS.filter((f) => words.every((w) => nrm(f[0]).includes(w))).slice(0, 8) : [];
    fres.innerHTML = hits.map((f) => `<button type="button" data-food="${FOODS.indexOf(f)}"><b>${esc(f[0])}</b><span>${f[1]} kcal / 100 g</span></button>`).join('') || (words.length ? '<div class="muted small">Nessun risultato: scrivilo a mano qui sotto.</div>' : '');
  };
  fres.onclick = (e) => {
    const b = e.target.closest('[data-food]'); if (!b) return;
    const [name, k, p, c, g, por] = FOODS[Number(b.dataset.food)];
    fres.innerHTML = ''; fq.value = '';
    fpick.innerHTML = `<div class="fpick"><b>${esc(name)}</b>
      <div class="row" style="align-items:center;gap:8px;margin-top:8px"><input id="fg" type="number" min="1" inputmode="numeric" value="${por}" style="width:90px"><span>grammi</span>
        <button type="button" class="sbtn" data-g="${por}">porzione ${por} g</button><button type="button" class="sbtn" data-g="100">100 g</button></div>
      <div class="fcalc" id="fcalc"></div><button type="button" class="btn primary block" id="fadd">Aggiungi a ${esc(meal())}</button></div>`;
    const calc = () => { const q = (Number(document.getElementById('fg').value) || 0) / 100; return { kcal: Math.round(k * q), protein: Math.round(p * q * 10) / 10, carbs: Math.round(c * q * 10) / 10, fat: Math.round(g * q * 10) / 10, grams: Math.round(q * 100) }; };
    const show = () => { const v = calc(); document.getElementById('fcalc').innerHTML = `<b>${v.kcal} kcal</b> · P ${v.protein} g · C ${v.carbs} g · G ${v.fat} g`; };
    document.getElementById('fg').oninput = show;
    fpick.querySelectorAll('[data-g]').forEach((x) => (x.onclick = () => { document.getElementById('fg').value = x.dataset.g; show(); }));
    document.getElementById('fadd').onclick = () => { const v = calc(); if (!v.grams) return toast('Scrivi i grammi', true); add({ name: `${name} · ${v.grams} g`, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, meal: meal() }); };
    show();
  };
  document.getElementById('fform').onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.meal = meal();
    if (!Number(f.kcal) && !Number(f.protein) && !Number(f.carbs) && !Number(f.fat)) return toast('Scrivi le kcal o almeno un macro', true);
    add(f);
  };
  $app.querySelectorAll('[data-re]').forEach((b) => (b.onclick = () => { const f = recent[Number(b.dataset.re)]; add({ name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, meal: meal() }); }));
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
  if (ME.trial) return `<span class="pill accent">Prova gratuita · ${trialLeft() === 1 ? 'ultimo giorno' : `${trialLeft()} giorni rimasti`}</span>`;
  if (!ME.accessUntil) return '<span class="pill">Abbonamento non attivo</span>';
  const left = Math.ceil((new Date(ME.accessUntil + 'T23:59').getTime() - Date.now()) / DAY);
  const date = new Date(ME.accessUntil + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  return ME.paid ? `<span class="pill ${left <= 7 ? 'accent' : 'ok'}">Attivo fino al ${date}${left <= 7 ? ` · ${left} ${left === 1 ? 'giorno' : 'giorni'}` : ''}</span>` : `<span class="pill">Scaduto il ${date}</span>`;
}
function profileView() {
  const pr = ME.profile;
  const days = [1, 2, 3, 4, 5, 6, 0];
  const kg = ME.weights.at(-1)?.kg || '';
  const c = ME.community;
  page('profile', `<a class="back" href="#/">‹ Oggi</a><div class="h1">Profilo</div>
    <div class="card"><div class="row" style="gap:14px">${avatar(c.avatar, ME.name, 64)}<div style="flex:1"><b>Community</b><div class="muted small">${c.joined ? 'Sei nella community. La tua foto e la bio le vedono gli altri membri.' : 'Non sei ancora nella community.'}</div></div></div>
      <div class="row" style="margin-top:12px"><a class="btn ${c.joined ? '' : 'primary'}" href="#/community/edit" style="flex:1">${c.joined ? 'Modifica foto e bio' : 'Entra nella community'}</a>${c.joined ? '<button class="btn" id="leave">Esci</button>' : ''}</div></div>
    <div class="card"><div class="row between"><b>Abbonamento</b>${accessInfo()}</div>
      ${hasPlans() ? `<a class="btn block" style="margin-top:12px" href="#/abbonati">${ME.paid ? 'Rinnova o cambia piano' : 'Scegli il tuo piano'}</a>` : ''}</div>
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
    ${welcomeSrc() ? '<button class="btn block" style="margin-top:12px" id="rewatch">▶ Rivedi il video di benvenuto</button>' : ''}
    <button class="btn block" style="margin-top:12px" id="logout">Esci</button>`);
  const rw = document.getElementById('rewatch');
  if (rw) rw.onclick = () => welcomePlayer();
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
  const lv = document.getElementById('leave');
  if (lv) lv.onclick = async () => { if (!confirm('Uscire dalla community? Non comparirai più tra i membri e non potrai scrivere in chat.')) return; ME = await api('/api/me/community', 'PUT', { joined: false }); profileView(); };
  document.getElementById('logout').onclick = async () => { await api('/api/auth/logout', 'POST'); ME = null; progCache.clear(); location.hash = '#/login'; };
}

// ---- piani di abbonamento ---------------------------------------------------------
function plansView() {
  page('', `<a class="back" href="#/">‹ Indietro</a><div class="h1">Scegli il tuo <em>piano</em></div>
    <div class="muted" style="margin-bottom:14px">Tocca un piano: si apre la pagina di pagamento. Usa la stessa email dell'app (<b>${esc(ME.email)}</b>): entro 24 ore attiviamo il tuo accesso.</div>
    ${plansHtml()}
    ${SETTINGS.extraAppUrl ? `<a class="btn block" style="margin-top:12px" href="${esc(SETTINGS.extraAppUrl)}" target="_blank" rel="noopener">${esc(SETTINGS.extraAppLabel || 'Scarica l\'app')}</a>` : ''}`);
}

// ---- abbonamento non attivo -----------------------------------------------------
function paywallView() {
  const expired = !!ME.accessUntil, trialOver = !expired && (!!ME.trialUntil || !!ME.trialUsed);
  const days = Number(SETTINGS.trialDays) || 7;
  page('', `<div class="topbar">${brand(24)}</div>
    <div class="h1">${expired ? 'Abbonamento <em>scaduto</em>' : trialOver ? (ME.trialUsed ? 'Prova già <em>usata</em>' : 'Prova <em>finita</em>') : ME.trialAvailable ? `Prova gratis <em>${days} giorni</em>` : 'Quasi <em>dentro</em>'}</div>
    ${ME.trialAvailable ? `<div class="card trialcard">
      <p style="margin-top:0"><b>Allenati con noi gratis per ${days} giorni.</b> Hai accesso a una settimana di allenamenti con video, timer e voce guida, alla community e ai tuoi progressi.</p>
      <p class="muted small">Nessun pagamento e nessun rinnovo automatico: alla fine decidi tu se abbonarti.</p>
      <button class="btn primary block" id="starttrial">Inizia la prova gratuita</button></div>` : ''}
    <div class="card">
      <p style="margin-top:0">${expired ? `Il tuo accesso è scaduto il ${new Date(ME.accessUntil + 'T12:00').toLocaleDateString('it-IT')}. Rinnova per tornare ai tuoi allenamenti: progressi e storico restano salvati.`
        : trialOver ? `<span style="white-space:pre-line">${esc(SETTINGS.trialEndText || 'La tua settimana di prova è finita. Abbonati per sbloccare tutti i programmi e continuare da dove sei arrivato: progressi e storico restano salvati.')}</span>`
        : ME.trialAvailable ? 'Vuoi già tutto? Con l\'abbonamento sblocchi subito tutti i programmi e tutte le settimane.'
        : 'Il tuo account è creato. Per sbloccare programmi, challenge e allenamenti serve un abbonamento attivo.'}</p>
      <p class="muted small">Hai già pagato? Usa la stessa email (<b>${esc(ME.email)}</b>): ti attiviamo l'accesso il prima possibile.</p>
      ${plansHtml()}
      ${SETTINGS.extraAppUrl ? `<a class="btn block" style="margin-top:8px" href="${esc(SETTINGS.extraAppUrl)}" target="_blank" rel="noopener">${esc(SETTINGS.extraAppLabel || 'Scarica l\'app')}</a>` : ''}
      ${SETTINGS.supportEmail ? `<a class="btn block" style="margin-top:8px" href="mailto:${esc(SETTINGS.supportEmail)}">Scrivici</a>` : ''}
      <button class="btn block" style="margin-top:8px" id="recheck">Ho già pagato, ricontrolla</button>
    </div>
    <a class="sbtn" href="#/profile">Vai al profilo</a>`);
  const st = document.getElementById('starttrial');
  if (st) st.onclick = async () => { try { ME = await api('/api/me/trial', 'POST'); progCache.clear(); toast('Prova attivata: buon allenamento!'); location.hash = '#/'; route(); } catch (err) { toast(err.message, true); } };
  document.getElementById('recheck').onclick = async () => { ME = await api('/api/me'); if (ME.active) { toast('Accesso attivo!'); route(); } else toast('Non ancora attivo: riprova più tardi', true); };
}

// ---- tutorial --------------------------------------------------------------------
const trainTabs = (on) => `<div class="seg"><a href="#/train" class="${on === 'programs' ? 'on' : ''}">Programmi</a><a href="#/tutorials" class="${on === 'tutorials' ? 'on' : ''}">Tutorial</a></div>`;
async function tutorialsView(cat) {
  const list = await api('/api/tutorials');
  const cats = [...new Set(list.map((t) => t.category).filter(Boolean))];
  const shown = list.filter((t) => !cat || t.category === cat);
  page('train', `<div class="h1">Allena<em>menti</em></div>${trainTabs('tutorials')}
    ${cats.length > 1 ? `<div class="chips"><a href="#/tutorials" class="${!cat ? 'on' : ''}">Tutti</a>${cats.map((c) => `<a href="#/tutorials/${encodeURIComponent(c)}" class="${c === cat ? 'on' : ''}">${esc(c)}</a>`).join('')}</div>` : ''}
    ${shown.map((t) => `<a class="tut" href="#/tutorial/${t.id}"><div class="play">▶</div><div><div class="t">${esc(t.title)}</div>
      <div class="muted small">${[t.category, t.level, t.minutes && `${t.minutes} min`].filter(Boolean).map(esc).join(' · ')}</div></div></a>`).join('') || '<div class="empty">🎬 I tutorial approfonditi sugli esercizi più tecnici arrivano a breve.</div>'}`);
}
async function tutorialView(id) {
  const t = (await api('/api/tutorials')).find((x) => x.id === id);
  if (!t) throw new Error('Tutorial non trovato');
  const emb = embedUrl(t.videoUrl);
  page('train', `<a class="back" href="#/tutorials">‹ Tutorial</a>
    <div class="row"><span class="pill accent">${esc(t.category)}</span>${t.level ? `<span class="pill">${esc(t.level)}</span>` : ''}${t.minutes ? `<span class="pill">${esc(t.minutes)} min</span>` : ''}</div>
    <div class="h1" style="font-size:28px">${esc(t.title)}</div>
    ${emb ? `<div class="video wide" style="margin:12px 0"><iframe src="${esc(emb)}" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen title="${esc(t.title)}"></iframe></div>` : ''}
    <a class="btn block" href="${esc(t.videoUrl)}" target="_blank" rel="noopener">Apri il video a schermo intero ↗</a>
    ${t.description ? `<div class="card" style="margin-top:12px;white-space:pre-line">${esc(t.description)}</div>` : ''}
    ${t.exerciseName ? `<div class="muted small">Esercizio: <b>${esc(t.exerciseName)}</b></div>` : ''}`);
}

// ---- community ---------------------------------------------------------------
const ctabs = (on) => `<div class="seg"><a href="#/community/chat" class="${on === 'chat' ? 'on' : ''}">Chat di gruppo</a><a href="#/community/messages" class="${on === 'messages' ? 'on' : ''}">Messaggi</a><a href="#/community/members" class="${on === 'members' ? 'on' : ''}">Membri</a></div>`;
const when = (ts) => { const d = new Date(ts); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); };

async function communityView(tab, arg) {
  const c = ME.community;
  if (c.banned) return page('community', '<div class="h1">Community</div><div class="card">Sei stato escluso dalla community. Per chiarimenti scrivi all\'assistenza.</div>');
  if (tab === 'edit' || !c.joined) return joinView();
  if (tab === 'u' && arg) return memberView(arg);
  if (tab === 'chat') return chatView('general');
  if (tab === 'messages') {
    const rooms = (await api('/api/community/rooms')).filter((r) => r.room !== 'general');
    return page('community', `<div class="topbar"><div class="h1" style="margin:0">Community</div>${meAvatar()}</div>${ctabs('messages')}
      ${rooms.map((r) => `<a class="room" href="#/chat/${r.room}">${avatar(r.avatar, r.title, 46)}<div style="flex:1;min-width:0"><div class="row between"><b>${esc(r.title)}</b><span class="muted small">${r.last ? when(r.last.ts) : ''}</span></div>
        <div class="muted small ell">${r.last ? (r.last.mine ? 'Tu: ' : '') + esc(r.last.text) : ''}</div></div>${r.unread ? `<i class="badge">${r.unread}</i>` : ''}</a>`).join('') || '<div class="empty">Nessun messaggio privato. Vai su <a href="#/community/members">Membri</a> e scrivi a qualcuno.</div>'}`);
  }
  const ms = await api('/api/community/members');
  page('community', `<div class="topbar"><div class="h1" style="margin:0">Community</div>${meAvatar()}</div>${ctabs('members')}
    <div class="muted small" style="margin-bottom:10px">${ms.length} ${ms.length === 1 ? 'membro' : 'membri'} nella community</div>
    <div class="mgrid">${ms.map((m) => `<a href="#/community/u/${m.id}" class="mcard">${avatar(m.avatar, m.name, 64)}<b>${esc(m.name)}</b><span class="muted small ell2">${esc(m.bio || '')}</span></a>`).join('')}</div>`);
}

// Ritaglio della foto profilo: il membro trascina e fa zoom finché il viso sta nel cerchio.
function cropPhoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.onload = () => {
      const m = document.createElement('div');
      m.className = 'cropmodal';
      m.innerHTML = `<div class="crop-box"><div class="h1" style="font-size:22px;margin:0">Sistema la foto</div>
        <div class="muted small">Trascina per spostarla, pizzica o usa la barra per ingrandire.</div>
        <div class="crop-stage"><img src="${url}" alt="" draggable="false"><div class="crop-ring"></div></div>
        <input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
        <div class="row" style="gap:10px;flex-wrap:nowrap"><button class="btn" data-c="no" style="flex:1">Annulla</button><button class="btn primary" data-c="ok" style="flex:1.4">Usa questa foto</button></div></div>`;
      document.body.append(m);
      const stage = m.querySelector('.crop-stage'), im = stage.querySelector('img'), zr = m.querySelector('.crop-zoom');
      const W = img.naturalWidth, H = img.naturalHeight;
      let S = stage.clientWidth, base = S / Math.min(W, H), z = 1, x = 0, y = 0;
      const draw = () => {
        const mx = (W * base * z - S) / 2, my = (H * base * z - S) / 2;
        x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y));
        im.style.width = `${W * base * z}px`;
        im.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      };
      const zoomTo = (nz) => { const r = Math.max(1, Math.min(4, nz)) / z; x *= r; y *= r; z *= r; zr.value = z; draw(); };
      draw();
      const pts = new Map(); let pinch = 0;
      const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
      stage.onpointerdown = (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) pinch = dist(); };
      stage.onpointermove = (e) => {
        const p = pts.get(e.pointerId); if (!p) return;
        if (pts.size === 1) { x += e.clientX - p.x; y += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; draw(); return; }
        p.x = e.clientX; p.y = e.clientY;
        const d = dist(); if (pinch) zoomTo(z * d / pinch); pinch = d;
      };
      stage.onpointerup = stage.onpointercancel = (e) => { pts.delete(e.pointerId); pinch = pts.size === 2 ? dist() : 0; };
      stage.onwheel = (e) => { e.preventDefault(); zoomTo(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
      zr.oninput = () => zoomTo(Number(zr.value));
      const close = (val) => { m.remove(); URL.revokeObjectURL(url); resolve(val); };
      m.querySelector('[data-c=no]').onclick = () => close(null);
      m.querySelector('[data-c=ok]').onclick = () => {
        const out = 600, k = out / S, c = document.createElement('canvas');
        c.width = c.height = out;
        const ctx = c.getContext('2d'), w = W * base * z * k, h = H * base * z * k;
        ctx.drawImage(img, out / 2 + x * k - w / 2, out / 2 + y * k - h / 2, w, h);
        c.toBlob((b) => close(b ? new File([b], 'avatar.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.88);
      };
    };
    img.src = url;
  });
}

function joinView() {
  const c = ME.community;
  page('community', `${c.joined ? '<a class="back" href="#/community">‹ Community</a>' : ''}<div class="h1">${c.joined ? 'Il tuo profilo' : 'Entra nella <em>community</em>'}</div>
    <div class="card form">
      <div class="row" style="gap:16px">${avatar(c.avatar, ME.name, 84)}<label class="btn" style="flex:1">${c.avatar ? 'Cambia foto' : 'Aggiungi una foto'}<input type="file" accept="image/*" id="avf" hidden></label></div>
      <label>Bio (max 200 caratteri)<textarea id="bio" maxlength="200" rows="3" placeholder="es. Papà di due bimbi, mi alleno 3 volte a settimana in garage. Obiettivo: 100 swing di fila!">${esc(c.bio)}</textarea></label>
      ${!c.joined ? `<div class="rules"><b>Regole della community</b><div class="muted small" style="white-space:pre-line">${esc(SETTINGS.communityRules || '')}</div></div>
        <label class="chk2"><input type="checkbox" id="okrules"> Accetto le regole. Gli altri membri vedranno il mio nome, la foto e la bio.</label>` : ''}
      <button class="btn primary block" id="joinbtn">${c.joined ? 'Salva' : 'Entra nella community'}</button>
    </div>`);
  document.getElementById('avf').onchange = async (e) => {
    const picked = e.target.files[0]; e.target.value = '';
    if (!picked) return;
    const file = await cropPhoto(picked);
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { ME = await api('/api/me/avatar', 'POST', fd); joinView(); toast('Foto aggiornata'); } catch (err) { toast(err.message, true); }
  };
  document.getElementById('joinbtn').onclick = async () => {
    if (!c.joined && !document.getElementById('okrules').checked) return toast('Accetta le regole per entrare', true);
    try { ME = await api('/api/me/community', 'PUT', { bio: document.getElementById('bio').value, joined: true }); toast(c.joined ? 'Profilo salvato' : 'Benvenuto nella community!'); location.hash = '#/community/chat'; } catch (err) { toast(err.message, true); }
  };
}

async function memberView(id) {
  if (id === ME.id) return joinView();
  const m = await api(`/api/community/members/${id}`);
  page('community', `<a class="back" href="#/community/members">‹ Membri</a>
    <div class="profile-head">${avatar(m.avatar, m.name, 110)}<div class="h1" style="font-size:28px;margin-top:12px">${esc(m.name)}</div>
      <div class="muted small">Membro dal ${new Date(m.since).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} · ${m.workouts} allenamenti</div>
      ${m.bio ? `<div class="card" style="margin-top:14px;text-align:left">${esc(m.bio)}</div>` : ''}</div>
    ${m.blocked ? '' : `<a class="btn primary block" href="#/chat/dm-${m.id}">Scrivi un messaggio</a>`}
    <button class="btn block" style="margin-top:10px" id="blk">${m.blocked ? 'Sblocca' : 'Blocca'}</button>`);
  document.getElementById('blk').onclick = async () => {
    if (!m.blocked && !confirm(`Bloccare ${m.name}? Non vedrai più i suoi messaggi e non potrà scriverti.`)) return;
    const r = await api(`/api/me/block/${m.id}`, 'POST'); ME.community.blocked = r.blocked; memberView(id);
  };
}

// Foto per la chat: ridotte sul telefono (lato lungo 1280 px, JPEG ~80%) prima di caricarle
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto non leggibile: prova con un\'altra')); };
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto non leggibile'))), 'image/jpeg', 0.8);
    };
    img.src = url;
  });
}
// Video di benvenuto: la card in Oggi sparisce quando lo guardi fino in fondo o lo chiudi con ✕.
// Si ricorda quale video hai visto: se in Impostazioni ne metto uno nuovo, ricompare a tutti.
const welcomeSrc = () => SETTINGS.welcomeVideo || SETTINGS.welcomeUrl || '';
async function welcomeDone() {
  const src = welcomeSrc();
  document.getElementById('welcome')?.remove();
  if (ME.welcomeSeen === src) return;
  ME.welcomeSeen = src;
  try { await api('/api/me/welcome', 'PUT', { seen: src }); } catch { /* riprova la prossima volta */ }
}
function welcomePlayer() {
  const emb = !SETTINGS.welcomeVideo && embedUrl(SETTINGS.welcomeUrl);
  if (!SETTINGS.welcomeVideo && !emb) { if (SETTINGS.welcomeUrl) window.open(SETTINGS.welcomeUrl, '_blank'); return; }
  const m = document.createElement('div');
  m.className = 'photoview welcomeview';
  m.innerHTML = `${emb ? `<iframe src="${esc(emb)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="Video di benvenuto"></iframe>`
    : `<video src="${esc(SETTINGS.welcomeVideo)}" controls autoplay playsinline></video>`}<button class="icon" aria-label="Chiudi">✕</button>`;
  const v = m.querySelector('video');
  if (v) v.addEventListener('ended', () => { welcomeDone(); setTimeout(() => m.remove(), 600); });
  else welcomeDone(); // dei link esterni non sappiamo quando finiscono: basta averlo aperto
  m.querySelector('.icon').onclick = () => { v?.pause(); m.remove(); };
  document.body.append(m);
}

function photoViewer(src) {
  const m = document.createElement('div');
  m.className = 'photoview';
  m.innerHTML = `<img src="${esc(src)}" alt=""><button class="icon" aria-label="Chiudi">✕</button>`;
  m.onclick = () => m.remove();
  document.body.append(m);
}

// La barra per scrivere resta sempre visibile: la chat finisce esattamente sopra la barra in basso
// (che sull'iPhone è più alta per la linea home) e, con la tastiera aperta, si restringe allo spazio
// che resta visibile (iOS non ridimensiona la pagina quando compare la tastiera).
function keepComposerVisible(chat, box) {
  const vv = window.visualViewport;
  const fit = () => {
    if (!document.body.contains(chat)) { // cambiata schermata: smetto di ascoltare
      document.body.classList.remove('kbd');
      vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); window.removeEventListener('resize', fit);
      return;
    }
    const kb = vv ? window.innerHeight - vv.height : 0;
    const open = kb > 120;
    document.body.classList.toggle('kbd', open);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (open) {
      chat.style.top = `${vv.offsetTop}px`; chat.style.bottom = 'auto'; chat.style.height = `${vv.height}px`;
    } else {
      const tb = document.querySelector('.tabbar');
      chat.style.top = ''; chat.style.height = '';
      chat.style.bottom = tb ? `${tb.offsetHeight}px` : '';
    }
    if (nearBottom) box.scrollTop = box.scrollHeight;
  };
  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); window.addEventListener('resize', fit);
  fit();
}

async function chatView(room) {
  const general = room === 'general';
  let last = 0;
  const first = await api(`/api/community/chat/${room}`);
  const other = first.other;
  $app.innerHTML = `<div class="chat">
    <div class="chat-top">${general ? '' : '<a class="icon" href="#/community/messages" aria-label="Indietro">‹</a>'}
      ${general ? `<div style="flex:1"><div class="h1" style="margin:0;font-size:24px">Community</div></div>${meAvatar()}` : `<a href="#/community/u/${other.id}" class="row" style="gap:10px;flex:1;text-decoration:none">${avatar(other.avatar, other.name, 36)}<b>${esc(other.name)}</b></a>`}</div>
    ${general ? `<div style="padding:0 16px">${ctabs('chat')}</div>` : ''}
    <div class="msgs" id="msgs"></div>
    ${first.blocked ? '<div class="chat-in muted small" style="justify-content:center">Hai bloccato questo membro.</div>'
      : `<form class="chat-in" id="cform"><label class="btn photobtn" aria-label="Manda una foto">📷<input type="file" accept="image/*" id="cphoto" hidden></label><textarea id="ctext" rows="1" maxlength="1000" placeholder="Scrivi un messaggio…"></textarea><button class="btn primary" aria-label="Invia">➤</button></form>`}
  </div>${tabbar('community')}`;
  refreshBadge();
  const box = document.getElementById('msgs');
  keepComposerVisible($app.querySelector('.chat'), box);
  const add = (msgs) => {
    if (!msgs.length) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    for (const m of msgs) {
      last = Math.max(last, m.ts);
      const mine = m.from === ME.id;
      const el = document.createElement('div');
      el.className = `msg ${mine ? 'mine' : ''}`;
      el.innerHTML = `${mine || !general ? '' : `<a href="#/community/u/${m.from}">${avatar(m.avatar, m.name, 30)}</a>`}<div class="bub">${!mine && general ? `<b class="who">${esc(m.name)}</b>` : ''}
        ${m.photo ? `<img class="cphoto" src="${esc(m.photo)}" alt="Foto" loading="lazy" data-photo="${esc(m.photo)}">` : ''}
        ${m.deleted ? '<div class="txt"><i class="muted">Messaggio eliminato</i></div>' : m.text ? `<div class="txt">${esc(m.text)}</div>` : ''}<span class="tm">${when(m.ts)}${!mine && !m.deleted ? ` · <button data-rep="${m.id}">Segnala</button>` : ''}</span></div>`;
      box.append(el);
    }
    if (atBottom || msgs.some((m) => m.from === ME.id)) box.scrollTop = box.scrollHeight;
  };
  add(first.messages);
  box.scrollTop = box.scrollHeight;
  if (!first.messages.length) box.innerHTML = `<div class="empty">${general ? 'Nessun messaggio ancora: rompi il ghiaccio! 👋' : `Scrivi il primo messaggio a ${esc(other.name)}.`}</div>`;
  box.onclick = async (e) => {
    const ph = e.target.closest('[data-photo]');
    if (ph) return photoViewer(ph.dataset.photo);
    const b = e.target.closest('[data-rep]');
    if (!b || !confirm('Segnalare questo messaggio ai moderatori?')) return;
    await api(`/api/community/report/${b.dataset.rep}`, 'POST', {}); toast('Grazie, lo controlliamo');
  };
  const form = document.getElementById('cform');
  if (form) {
    const ta = document.getElementById('ctext');
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); form.requestSubmit(); } };
    document.getElementById('cphoto').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      const btn = form.querySelector('.photobtn');
      btn.classList.add('busy');
      try {
        const fd = new FormData();
        fd.append('file', await shrinkPhoto(file), 'foto.jpg');
        fd.append('text', ta.value.trim()); // il testo scritto diventa la didascalia
        const m = await api(`/api/community/chat/${room}/photo`, 'POST', fd);
        if (box.querySelector('.empty')) box.innerHTML = '';
        ta.value = ''; ta.style.height = 'auto';
        add([m]);
      } catch (err) { toast(err.message, true); }
      btn.classList.remove('busy');
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      try {
        const m = await api(`/api/community/chat/${room}`, 'POST', { text });
        if (box.querySelector('.empty')) box.innerHTML = '';
        ta.value = ''; ta.style.height = 'auto';
        add([m]);
      } catch (err) { toast(err.message, true); }
    };
  }
  // un solo controllo per volta, e si ferma da solo se hai cambiato schermata
  stopPoll();
  const view = location.hash;
  const id = setInterval(async () => {
    if (location.hash !== view) return clearInterval(id);
    if (document.visibilityState !== 'visible') return;
    try {
      const r = await api(`/api/community/chat/${room}?after=${last}`);
      if (r.messages.length && box.querySelector('.empty')) box.innerHTML = '';
      add(r.messages.filter((m) => m.ts > last));
    } catch {}
  }, 4000);
  POLL = id;
}

// ---- avvio -------------------------------------------------------------------
(async () => {
  try {
    // errori del telefono del cliente → registro nel server, per capire i blocchi che ci segnalano
    const report = (msg) => { try { navigator.sendBeacon?.('/api/log', new Blob([JSON.stringify({ msg: String(msg).slice(0, 500), page: location.hash.slice(0, 80) })], { type: 'application/json' })); } catch {} };
    window.addEventListener('error', (e) => report(`${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
    window.addEventListener('unhandledrejection', (e) => report(`promise: ${e.reason?.message || e.reason}`));
    SETTINGS = await (await fetch('/api/settings')).json();
    setPace(SETTINGS.paceFactor);
    document.title = SETTINGS.appName;
  } catch {}
  route();
})();
