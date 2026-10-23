import { BLOCK_TYPES, PHASE_TYPES, blockSummary, embedUrl, emomIntervals, emomRounds, emomSlotCount, estimateSeconds, setPace } from './engine.js';

const root = document.getElementById('admin');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)) || ''; } catch { return ''; } };
let KEY = lsGet('adminKey');      // proprietario
let TOKEN = lsGet('staffToken');  // delegato
const authHeaders = () => (KEY ? { 'x-admin-key': KEY } : TOKEN ? { 'x-staff-token': TOKEN } : {});

const S = { tutorials: [], mod: { reports: [], general: [], banned: [] }, role: 'owner', me: '', staff: [], pending: {}, uq: '', uf: 'all', openU: {}, tab: 'programs', exercises: [], programs: [], tips: [], challenges: [], users: [], settings: {}, exId: null, progId: null, draft: null, openWk: {}, dirty: false };

async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);
  return j;
}
function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
function uploadFile(file, onProgress, query = '') {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    x.open('POST', '/api/admin/upload' + query);
    for (const [k, v] of Object.entries(authHeaders())) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress(e.loaded / e.total);
      if (e.loaded === e.total && /^video\//.test(file.type)) toast('Video caricato: lo sto ottimizzando, attendi qualche secondo…');
    };
    x.onload = () => {
      if (x.status >= 300) return reject(new Error(JSON.parse(x.responseText || '{}').error || 'Upload fallito'));
      const j = JSON.parse(x.responseText);
      resolve(Object.assign(new String(j.url), j)); // si usa come stringa (url) ma porta anche le dimensioni
    };
    x.onerror = () => reject(new Error('Upload fallito'));
    x.send(fd);
  });
}

// ---- login -------------------------------------------------------------------
async function start() {
  if (KEY || TOKEN) {
    try { return load(await call('GET', '/api/admin/ping')); } catch {}
  }
  root.innerHTML = `<form class="login"><div class="h1" style="font-size:26px">Admin</div>
    <div class="muted small" style="margin-bottom:16px">Staff: entra con email e password. Proprietario: usa la chiave admin.</div>
    <div class="f"><input type="text" name="email" placeholder="Email staff" autocomplete="username"></div>
    <div class="f"><input type="password" name="pw" placeholder="Password staff" autocomplete="current-password"></div>
    <div class="muted small" style="text-align:center;margin:4px 0 10px">oppure</div>
    <div class="f"><input type="password" name="k" placeholder="Chiave admin (proprietario)"></div><button class="btn primary block">Entra</button></form>`;
  root.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.k.value.trim()) {
        KEY = f.k.value.trim(); TOKEN = '';
        const who = await call('GET', '/api/admin/ping');
        localStorage.setItem('adminKey', JSON.stringify(KEY)); localStorage.removeItem('staffToken');
        load(who);
      } else {
        const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email.value, password: f.pw.value }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        TOKEN = j.token; KEY = '';
        localStorage.setItem('staffToken', JSON.stringify(TOKEN)); localStorage.removeItem('adminKey');
        load(await call('GET', '/api/admin/ping'));
      }
    } catch (err) { KEY = ''; TOKEN = ''; toast(err.message, true); }
  };
}

async function load(who) {
  S.role = who.role; S.me = who.name;
  const settings = fetch('/api/settings').then((r) => r.json());
  if (S.role === 'owner') {
    [S.exercises, S.programs, S.tips, S.challenges, S.users, S.pending, S.staff, S.tutorials, S.mod, S.settings] = await Promise.all(['exercises', 'programs', 'tips', 'challenges', 'users', 'pending', 'staff', 'tutorials', 'moderation'].map((x) => call('GET', `/api/admin/${x}`)).concat(settings));
  } else {
    [S.users, S.pending, S.mod, S.settings] = await Promise.all([call('GET', '/api/admin/users'), call('GET', '/api/admin/pending'), call('GET', '/api/admin/moderation'), settings]);
    S.tab = 'users';
  }
  setPace(S.settings.paceFactor);
  render();
}

const exName = (id) => S.exercises.find((e) => e.id === id)?.name || '—';
// Esercizi raggruppati per categoria e in ordine alfabetico, per trovarli in fretta anche quando sono tanti
const exOptions = (sel, empty = '— scegli —', skipId = '') => {
  const groups = new Map();
  for (const e of S.exercises.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.id === skipId) continue;
    const c = e.category || 'Senza categoria';
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(e);
  }
  return `<option value="">${empty}</option>` + [...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([c, xs]) => `<optgroup label="${esc(c)}">${xs.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
};
// Ricerca esercizi: senza maiuscole e accenti, cerca nel nome e nella categoria
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const exMatch = (e, q) => !q || norm(`${e.name} ${e.category}`).includes(norm(q).trim());
// Menu esercizio con barra di ricerca sopra: scrivi il nome e tocchi il risultato, oppure scegli dal menu come prima
const exPick = (attrs, sel, empty, skipId) => `<div class="exsel"><input type="search" class="exq" placeholder="🔍 Cerca esercizio…" autocomplete="off" data-skip="${esc(skipId || '')}"><div class="exres" hidden></div><select ${attrs}>${exOptions(sel, empty, skipId)}</select></div>`;
// La scala completa (più facili ← esercizio → più difficili), per vederla nell'admin
function exLadder(id) {
  const by = new Map(S.exercises.map((e) => [e.id, e])), out = [id], seen = new Set([id]);
  for (let x = by.get(id)?.easierId; x && by.has(x) && !seen.has(x); x = by.get(x).easierId) { out.unshift(x); seen.add(x); }
  for (let x = by.get(id)?.harderId; x && by.has(x) && !seen.has(x); x = by.get(x).harderId) { out.push(x); seen.add(x); }
  return out.map((x) => (x === id ? `<b style="color:var(--accent)">${esc(by.get(x).name)}</b>` : esc(by.get(x).name))).join(' → ');
}

function render() {
  root.innerHTML = `<div class="adm">
    <header><div class="h1">${esc(S.settings.appName || 'Admin')} <em style="color:var(--accent);font-style:normal">admin</em></div>
      <div class="tabs">${(S.role === 'owner' ? [['programs', 'Programmi'], ['exercises', 'Esercizi & video'], ['tutorials', 'Tutorial'], ['board', 'Bacheca'], ['users', 'Membri'], ['moderation', `Moderazione${S.mod.reports.length ? ` (${S.mod.reports.length})` : ''}`], ['staff', 'Staff'], ['kalos', 'Kalos'], ['email', 'Email'], ['settings', 'Impostazioni']] : [['users', 'Membri'], ['moderation', `Moderazione${S.mod.reports.length ? ` (${S.mod.reports.length})` : ''}`]]).map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="muted small">${esc(S.me)}</span><button class="sbtn" data-act="logout">Esci</button>${S.role === 'owner' ? '<a class="sbtn" href="/" target="_blank">Apri app ↗</a>' : ''}</header>
    ${({ exercises: exercisesView, tutorials: tutorialsView, board: boardView, users: usersView, kalos: kalosView, email: emailView, moderation: moderationView, staff: staffView, settings: settingsView }[S.tab] || programsView)()}
  </div>`;
  if (S.tab === 'moderation') loadModPhotos();
}

// ---- esercizi ---------------------------------------------------------------
function exercisesView() {
  const e = S.exercises.find((x) => x.id === S.exId);
  return `<div class="cols ${e ? 'has-sel' : ''}">
    <div class="side"><button class="btn primary add" data-act="ex-new">+ Nuovo esercizio</button>
      <input type="search" id="exlistq" class="listq" placeholder="🔍 Cerca per nome o categoria…" value="${esc(S.exQ || '')}" autocomplete="off">
      ${S.exercises.slice().sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<button class="it ${x.id === S.exId ? 'on' : ''}" data-ex="${x.id}" ${exMatch(x, S.exQ) ? '' : 'hidden'}>
        ${x.video ? `<video class="thumb" src="${esc(x.video)}#t=0.5" muted preload="metadata"></video>` : '<div class="thumb"></div>'}
        <div><div style="font-weight:800">${esc(x.name)}</div><div class="meta">${esc(x.category || '')}${x.video ? '' : ' · senza video'}</div></div></button>`).join('') || '<div class="muted small" style="padding:8px">Nessun esercizio ancora.</div>'}
    </div>
    <div class="panel">${e ? `<button class="sbtn mback" data-act="ex-back">‹ Torna all\'elenco</button>
      <div class="grid2"><div class="f"><label>Nome</label><input type="text" data-exf="name" value="${esc(e.name)}"></div>
      <div class="f"><label>Categoria</label><input type="text" data-exf="category" value="${esc(e.category)}" placeholder="es. Swing, Squat, Core"></div></div>
      <div class="f"><label>Indicazioni tecniche (cue)</label><textarea data-exf="cues" placeholder="es. Spingi l'anca, braccia rilassate">${esc(e.cues)}</textarea></div>
      <div class="f"><label>Video demo (in loop nel player)</label>
        <div class="upl">${e.video ? `<video class="vid" id="exvid" src="${esc(e.video)}" autoplay muted loop playsinline></video>` : '<div class="vid" style="display:grid;place-items:center;color:var(--muted)">Nessun video</div>'}
          <div style="display:grid;gap:8px"><input type="file" accept="video/*" data-upload="ex-video"><div class="prog-bar"><i id="upbar"></i></div>
          <div class="muted small">Consigliato: verticale 4:5 o 9:16, 5–10 s, MP4 (H.264), senza audio.</div>
          ${e.video ? '<button class="sbtn ghost danger" data-act="ex-unvideo">Togli il video caricato</button>' : ''}</div></div></div>
      <div class="f"><label>Video per il riquadro 4:5 (opzionale)</label>
        <div class="upl">${e.videoBox ? `<video class="vid" style="aspect-ratio:4/5" src="${esc(e.videoBox)}" autoplay muted loop playsinline></video>` : ''}
          <div style="display:grid;gap:8px"><input type="file" accept="video/*" data-upload="ex-videobox">
          <div class="muted small">Se c'è, il player lo usa nella vista normale (riempie il riquadro senza bordi sfocati); il video sopra resta per il tutto schermo.</div>
          ${e.videoBox ? '<button class="sbtn ghost danger" data-act="ex-unvideobox">Togli il video 4:5</button>' : ''}</div></div></div>
      <div class="f"><label>Oppure link YouTube / Google Drive / Vimeo</label><input type="text" data-exf="videoUrl" value="${esc(e.videoUrl)}" placeholder="https://youtu.be/… oppure https://drive.google.com/file/d/…">
        <div class="muted small">Usato solo se non c'è un video caricato. YouTube e Vimeo girano in loop senza audio; Drive si avvia con un tocco. Su Drive il file va condiviso con "Chiunque abbia il link".</div>
        ${!e.video && embedUrl(e.videoUrl) ? `<iframe class="vid" style="border:0" src="${esc(embedUrl(e.videoUrl, { loop: true }))}" allow="autoplay; encrypted-media"></iframe>` : e.videoUrl && !embedUrl(e.videoUrl) ? '<div class="small danger">Link non riconosciuto: usa un link di YouTube, Google Drive o Vimeo.</div>' : ''}</div>
      <div class="grid2"><div class="f"><label>Ripetizioni nel video demo</label><input type="number" min="0" step="1" data-exf="repsInVideo" value="${esc(e.repsInVideo)}" placeholder="es. 7"></div>
        <div class="f"><label>Secondi per ripetizione</label><input type="number" min="0" step="0.1" data-exf="secPerRep" id="spr" value="${esc(e.secPerRep)}" placeholder="es. 1 per lo swing"></div></div>
      <div class="muted small" style="margin:-4px 0 12px">Serve al giro guidato di AMRAP e AFAP: 50 swing a 1 s = 50 s, poi passa da solo all'esercizio dopo. Se scrivi quante ripetizioni ci sono nel video, il ritmo lo calcolo io dalla durata del video.</div>
      <div class="grid2"><div class="f"><label>Regressione (più facile)</label>${exPick('data-exf="easierId"', e.easierId, '— nessuna —', e.id)}</div>
      <div class="f"><label>Progressione (più difficile)</label>${exPick('data-exf="harderId"', e.harderId, '— nessuna —', e.id)}</div></div>
      <div class="muted small" style="margin:-4px 0 12px">Scegli tra gli esercizi già caricati: non serve rifarli. Il collegamento vale nei due sensi (se le Ginocchia sono la regressione del Push-up, il Push-up diventa la progressione delle Ginocchia).
        ${e.easierId || e.harderId ? `<div style="margin-top:6px">Scala: ${exLadder(e.id)}</div>` : ''}</div>
      <div class="savebar"><button class="sbtn danger" data-act="ex-del">Elimina</button><button class="btn primary" data-act="ex-save">Salva esercizio</button></div>`
      : '<div class="muted">Scegli un esercizio a sinistra o creane uno nuovo. Per ogni esercizio carichi il video demo e colleghi le varianti più facile / più difficile.</div>'}
    </div></div>`;
}

// ---- bacheca: consigli e challenge --------------------------------------------
function boardView() {
  const dates = (k, x) => `<div class="f"><label>Dal</label><input type="date" data-bd="${k}.${x.id}.start" value="${esc(x.start)}"></div><div class="f"><label>Al (opzionale)</label><input type="date" data-bd="${k}.${x.id}.end" value="${esc(x.end)}"></div>`;
  const foot = (k, x) => `<div class="row" style="justify-content:space-between;margin-top:6px"><label class="chk"><input type="checkbox" data-bd="${k}.${x.id}.published" ${x.published ? 'checked' : ''}> Pubblicato</label>
    <span><button class="sbtn danger" data-act="bd-del" data-kind="${k}" data-id="${x.id}">Elimina</button> <button class="sbtn acc" data-act="bd-save" data-kind="${k}" data-id="${x.id}">Salva</button></span></div>`;
  return `<div class="grid2" style="align-items:start;gap:16px">
    <div class="panel"><div class="row" style="justify-content:space-between"><div class="h2" style="margin:0">Challenge</div><button class="sbtn acc" data-act="bd-new" data-kind="challenges">+ Nuova</button></div>
      <div class="muted small" style="margin:6px 0 12px">Es. "100 push-up al giorno" o "10.000 passi": ogni membro segna ogni giorno quanto ha fatto e vede i giorni completati.</div>
      ${S.challenges.map((c) => `<div class="block">
        <div class="f"><label>Titolo</label><input type="text" data-bd="challenges.${c.id}.title" value="${esc(c.title)}"></div>
        <div class="f"><label>Descrizione</label><textarea data-bd="challenges.${c.id}.description">${esc(c.description)}</textarea></div>
        <div class="grid2"><div class="f"><label>Obiettivo al giorno</label><input type="number" min="1" data-bd="challenges.${c.id}.dailyTarget" value="${esc(c.dailyTarget)}"></div>
          <div class="f"><label>Unità</label><input type="text" data-bd="challenges.${c.id}.unit" value="${esc(c.unit)}" placeholder="push-up, passi, km"></div>${dates('challenges', c)}</div>
        ${foot('challenges', c)}</div>`).join('') || '<div class="muted">Nessuna challenge.</div>'}</div>
    <div class="panel"><div class="row" style="justify-content:space-between"><div class="h2" style="margin:0">Consigli lifestyle</div><button class="sbtn acc" data-act="bd-new" data-kind="tips">+ Nuovo</button></div>
      <div class="muted small" style="margin:6px 0 12px">Compaiono nella schermata "Oggi" dei membri nel periodo che scegli.</div>
      ${S.tips.map((x) => `<div class="block">
        <div class="f"><label>Titolo</label><input type="text" data-bd="tips.${x.id}.title" value="${esc(x.title)}"></div>
        <div class="f"><label>Testo</label><textarea data-bd="tips.${x.id}.text">${esc(x.text)}</textarea></div>
        <div class="f"><label>Video (opzionale): link YouTube, Google Drive o Vimeo</label><input type="text" data-bd="tips.${x.id}.videoUrl" value="${esc(x.videoUrl)}" placeholder="https://youtu.be/…"></div>
        <div class="f"><label>Immagine (opzionale)</label><input type="file" accept="image/*" data-upload="tip:${x.id}">${x.image ? `<img src="${esc(x.image)}" style="width:160px;border-radius:10px;margin-top:6px">` : ''}</div>
        <div class="grid2">${dates('tips', x)}</div>${foot('tips', x)}</div>`).join('') || '<div class="muted">Nessun consiglio.</div>'}</div>
  </div>`;
}

const fmtDate = (d) => (d ? new Date(d + (d.length === 10 ? 'T12:00' : '')).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const daysLeft = (u) => (u.accessUntil ? Math.ceil((new Date(u.accessUntil + 'T23:59').getTime() - Date.now()) / 864e5) : null);
function userStatus(u) {
  const d = daysLeft(u);
  if (u.trial && !u.active) return ['trial', `In prova fino al ${fmtDate(u.trialUntil)}`];
  if (!u.accessUntil) return ['pending', u.trialUntil ? `Prova finita il ${fmtDate(u.trialUntil)}` : 'In attesa'];
  if (d < 0 || !u.active) return ['expired', 'Scaduto'];
  if (d <= 7) return ['soon', `Scade tra ${d} g`];
  return ['ok', 'Attivo'];
}
// ultimo accesso in parole semplici
function seenText(iso) {
  if (!iso) return 'Ultimo accesso: nessun dato';
  const ms = Date.now() - Date.parse(iso), min = Math.round(ms / 60000);
  if (min < 5) return 'Online adesso';
  if (min < 60) return `Visto ${min} min fa`;
  const d = new Date(iso), today = new Date(), y = new Date(Date.now() - 864e5);
  const hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Visto oggi alle ${hh}`;
  if (d.toDateString() === y.toDateString()) return `Visto ieri alle ${hh}`;
  return `Visto ${Math.round(ms / 864e5)} giorni fa`;
}
const seenClass = (u) => { const ms = u.lastSeen ? Date.now() - Date.parse(u.lastSeen) : Infinity; return ms < 5 * 60e3 ? 'st ok' : ms < 2 * 864e5 ? '' : 'muted'; };
function activitySummary() {
  const now = Date.now(), d = (u, ms) => u.lastSeen && now - Date.parse(u.lastSeen) < ms;
  const online = S.users.filter((u) => d(u, 5 * 60e3)).length, today = S.users.filter((u) => u.lastSeen && new Date(u.lastSeen).toDateString() === new Date().toDateString()).length;
  const week = S.users.filter((u) => d(u, 7 * 864e5)).length, trials = S.users.filter((u) => u.trialStart).length, conv = S.users.filter((u) => u.convertedFromTrial).length;
  const tile = (n, l) => `<div style="flex:1;min-width:120px;background:var(--card-2,#1c1c20);border-radius:12px;padding:10px 12px"><div style="font-size:24px;font-weight:900">${n}</div><div class="muted small">${l}</div></div>`;
  return `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">${tile(online, 'Online adesso')}${tile(today, 'Entrati oggi')}${tile(week, 'Entrati negli ultimi 7 giorni')}${tile(`${conv}/${trials}`, 'Prove → abbonati')}</div>`;
}
function usersView() {
  const q = S.uq.toLowerCase();
  const counts = { all: S.users.length };
  for (const u of S.users) { const k = userStatus(u)[0]; counts[k] = (counts[k] || 0) + 1; if ((u.active || u.trial) && (!u.lastSeen || Date.now() - Date.parse(u.lastSeen) > 3 * 864e5)) counts.idle = (counts.idle || 0) + 1; }
  const idle = (u) => !u.lastSeen || Date.now() - Date.parse(u.lastSeen) > 3 * 864e5;
  const list = S.users.filter((u) => (S.uf === 'all' || (S.uf === 'idle' ? idle(u) && (u.active || u.trial) : userStatus(u)[0] === S.uf)) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)))
    .sort((a, b) => (a.accessUntil || '').localeCompare(b.accessUntil || ''));
  const filters = [['all', 'Tutti'], ['trial', 'In prova'], ['pending', 'In attesa'], ['soon', 'In scadenza'], ['expired', 'Scaduti'], ['ok', 'Attivi'], ['idle', 'Spariti da 3+ giorni']];
  const pend = Object.entries(S.pending);
  return `<div class="cols two">
    <div class="panel">
      ${activitySummary()}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><input type="text" id="uq" placeholder="Cerca nome o email (es. quella del pagamento Stripe)" value="${esc(S.uq)}" style="flex:1;min-width:220px">
        ${filters.map(([k, l]) => `<button class="sbtn ${S.uf === k ? 'acc' : ''}" data-uf="${k}">${l} ${counts[k] || 0}</button>`).join('')}</div>
      ${list.map((u) => { const [st, label] = userStatus(u); const open = S.openU[u.id]; return `<div class="urow">
        <div class="uhead"><div style="flex:1;min-width:180px"><b>${esc(u.name)}</b><div class="muted small">${esc(u.email)} · iscritto ${fmtDate(u.joined)} · ${u.workouts} allenamenti${u.lastWorkout ? ` (ultimo ${fmtDate(String(u.lastWorkout).slice(0, 10))})` : ''}</div>
          <div class="small" style="margin-top:2px"><span class="${seenClass(u)}">● ${esc(seenText(u.lastSeen))}</span>${u.lastSeen ? ` <span class="muted">· ${u.visits} ${u.visits === 1 ? 'accesso' : 'accessi'} · attivo ${u.days7}/7 giorni, ${u.days30}/30</span>` : ''}${u.convertedFromTrial ? ` <span class="st ok">dalla prova all'abbonamento ✓</span>` : ''}</div><div class="muted small">${Object.keys(u.trialMails || {}).length ? `Email prova: ${[['d2', '2° giorno'], ['d4', '4° giorno'], ['last', 'ultimo giorno']].filter(([k]) => u.trialMails[k]).map(([, l]) => l).join(', ')} ✓` : ''}</div></div>
          <span class="st ${st}">${label}${u.accessUntil ? ` · ${fmtDate(u.accessUntil)}` : ''}</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><span class="muted small">Aggiungi accesso:</span>
          ${[1, 3, 6, 12].map((m) => `<button class="sbtn acc" data-grant="${m}" data-id="${u.id}">+${m === 12 ? '1 anno' : m + (m === 1 ? ' mese' : ' mesi')}</button>`).join('')}
          ${u.accessUntil ? `<button class="sbtn ghost danger" data-act="revoke" data-id="${u.id}">Revoca</button>` : ''}
          ${!u.accessUntil && !u.trialUntil ? `<button class="sbtn" data-act="u-trial" data-id="${u.id}">Attiva prova gratis</button>` : ''}
          <button class="sbtn" data-act="u-open" data-id="${u.id}">${open ? 'Chiudi' : 'Nutrizione & storico'}</button>
          <button class="sbtn ghost" data-act="u-reset" data-id="${u.id}" title="Link per scegliere una nuova password, da mandare su WhatsApp">🔑 Link password</button>
          ${S.role === 'owner' ? `<button class="sbtn ghost danger" data-act="u-del" data-id="${u.id}">Elimina</button>` : ''}</div>
        ${open ? userDetail(u) : ''}</div>`; }).join('') || '<div class="muted">Nessun membro trovato.</div>'}
    </div>
    <div class="panel"><div class="h2" style="margin-top:0">Pre-attiva un'email</div>
      <div class="muted small" style="margin-bottom:10px">Pagamento arrivato ma la persona non si è ancora iscritta all'app? Attiva la sua email: quando si iscrive con quella email trova già l'accesso.</div>
      <form id="bulkf" class="f"><label>Più clienti insieme</label><textarea name="emails" placeholder="Incolla qui le email (una per riga, o separate da virgola). Puoi incollare anche un elenco copiato da Stripe: le email le trovo io."></textarea>
        <select name="months"><option value="1">1 mese</option><option value="3">3 mesi</option><option value="6">6 mesi</option><option value="12">1 anno</option></select><button class="btn primary">Attiva tutte</button></form>
      <div class="lbl2" style="margin:14px 0 6px">Un cliente alla volta</div>
      <form id="pendf" class="f"><input type="text" name="email" placeholder="email@cliente.it"><select name="months"><option value="1">1 mese</option><option value="3">3 mesi</option><option value="6">6 mesi</option><option value="12">1 anno</option></select><button class="btn primary">Attiva</button></form>
      ${pend.length ? `<div class="lbl2" style="margin-top:12px">In attesa di iscrizione</div>${pend.map(([em, g]) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><div><b class="small">${esc(em)}</b><div class="muted small">${g.until ? `fino al ${fmtDate(g.until)}` : `${g.months} ${g.months === 1 ? 'mese' : 'mesi'}`} · da ${esc(g.by)} · ${fmtDate(g.date)}</div></div><button class="sbtn ghost danger" data-act="pend-del" data-email="${esc(em)}">✕</button></div>`).join('')}` : ''}
    </div></div>`;
}
// ---- Email: scrivi e invia a un gruppo (parte dall'app con la Gmail del coach) ----
const MAIL_GROUPS = {
  all: ['Tutti gli iscritti all\'app', () => S.users],
  trial: ['In prova', () => S.users.filter((u) => u.trial)],
  ok: ['Abbonati attivi', () => S.users.filter((u) => u.active)],
  lapsed: ['Iscritti senza accesso (prova finita o scaduti)', () => S.users.filter((u) => !u.active && !u.trial)],
  kexp: ['Kalos: scaduti non ancora invitati', () => (S.kalos?.clients || []).filter((c) => c.status !== 'attivo' && !c.invited)],
  kact: ['Kalos: attivi non ancora iscritti all\'app', () => (S.kalos?.clients || []).filter((c) => c.status === 'attivo' && !c.registered)],
  paste: ['Incolla un elenco di email', null],
};
function mailRecipients() {
  const g = S.mg || 'trial';
  if (g === 'paste') return [...new Set(String(S.mp || '').toLowerCase().match(/[^\s,;<>"']+@[^\s,;<>"']+\.[a-z]{2,}/g) || [])].map((email) => ({ email, name: '' }));
  return MAIL_GROUPS[g][1]().map((x) => ({ email: x.email, name: String(x.name || '').trim().split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase()) }));
}
function mailHtml(text, link, btn) {
  const paras = String(text || '').split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const b = link ? `<p style="margin:22px 0"><a href="${esc(link)}" style="background:#ff7a00;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px;display:inline-block">${esc(btn || 'Apri')}</a></p>` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">${paras}${b}</div>`;
}
function emailView() {
  const m = S.mail;
  if (!m) return '<div class="panel muted">Carico…</div>';
  const d = S.md ||= { subject: '', text: 'Ciao {nome}!\n\n', link: location.origin, btn: 'Apri l\'app', label: '' };
  const rec = mailRecipients();
  const sample = rec[0]?.name || 'Marco';
  const fillPrev = (x) => String(x).replace(/\{nome\}/gi, sample);
  return `<div class="cols two"><div class="panel">
    <div class="h2" style="margin-top:0">Scrivi un'email</div>
    ${m.configured ? `<div class="muted small" style="margin-bottom:10px">Parte da <b>${esc(m.from)}</b> · oggi già inviate ${m.today} su ${m.cap}. Le risposte arrivano lì.</div>` : '<div class="st pending" style="margin-bottom:10px;display:inline-block">Gmail non collegata: aggiungi GMAIL_USER e GMAIL_APP_PASSWORD su Render</div>'}
    <div class="f"><label>A chi</label><select id="mg">${Object.entries(MAIL_GROUPS).map(([k, [l, f]]) => `<option value="${k}" ${(S.mg || 'trial') === k ? 'selected' : ''}>${l}${f ? ` (${f().length})` : ''}</option>`).join('')}</select></div>
    ${(S.mg || 'trial') === 'paste' ? `<div class="f"><textarea id="mp" rows="4" placeholder="Incolla qui le email">${esc(S.mp || '')}</textarea></div>` : ''}
    <div class="f"><label>Nome dell'invio (serve a non mandarla due volte alla stessa persona)</label><input type="text" id="ml" value="${esc(d.label)}" placeholder="es. Evento sabato 8 novembre"></div>
    <div class="f"><label>Oggetto</label><input type="text" id="ms" value="${esc(d.subject)}" placeholder="es. {nome}, sabato ci alleniamo insieme 🔥"></div>
    <div class="f"><label>Testo (lascia una riga vuota tra i paragrafi · {nome} = nome della persona)</label><textarea id="mt" rows="10">${esc(d.text)}</textarea></div>
    <div class="grid2"><div class="f"><label>Tasto: link (opzionale)</label><input type="text" id="mk" value="${esc(d.link)}" placeholder="https://…"></div>
      <div class="f"><label>Tasto: scritta</label><input type="text" id="mb" value="${esc(d.btn)}"></div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="mail-send" ${m.configured && rec.length ? '' : 'disabled'}>Invia a ${rec.length} ${rec.length === 1 ? 'persona' : 'persone'}</button>
      <button class="sbtn" data-act="mail-test" ${m.configured ? '' : 'disabled'}>Manda una prova a me</button></div>
    ${rec.length > m.cap - m.today ? `<div class="muted small" style="margin-top:8px">Gmail ne permette circa ${m.cap} al giorno: le altre partono da sole domani.</div>` : ''}
  </div>
  <div class="panel"><div class="h2" style="margin-top:0">Anteprima</div>
    <div class="muted small">Come la vede ${esc(sample)}:</div>
    <div style="background:#fff;border-radius:12px;padding:16px;margin-top:8px"><div style="font:700 15px Arial;color:#111;margin-bottom:10px">${esc(fillPrev(d.subject || '(senza oggetto)'))}</div>${mailHtml(fillPrev(d.text), d.link, d.btn)}</div>
    ${m.campaigns.length ? `<div class="lbl2" style="margin-top:16px">Invii fatti</div>${m.campaigns.slice().reverse().slice(0, 10).map((c) => `<div class="muted small">${esc(c.label)} · ${c.sent}/${c.total} inviate${c.failed ? ` · ${c.failed} errori` : ''}${c.done ? ` · ${new Date(c.done).toLocaleDateString('it-IT')}` : ' · in corso'}</div>`).join('')}` : ''}
  </div></div>`;
}

// ---- Kalos: clienti low ticket letti ogni giorno dal gestionale (solo lettura) ----
function kalosView() {
  const k = S.kalos;
  if (!k) return '<div class="panel muted">Carico…</div>';
  const f = S.kf || 'attivo';
  const groups = { attivo: 'Attivi', scaduto: 'Scaduti', pausa: 'In pausa' };
  const list = k.clients.filter((c) => c.status === f).sort((a, b) => (a.until || '').localeCompare(b.until || ''));
  const n = (st) => k.clients.filter((c) => c.status === st).length;
  const last = k.last;
  return `<div class="panel">
    <div class="row between" style="flex-wrap:wrap;gap:10px"><div><div class="h2" style="margin:0">Clienti low ticket da Kalos</div>
      <div class="muted small">Ogni giorno alle ${k.hour}:00 legge da Kalos email, piano e scadenza (solo lettura: su Kalos non viene mai modificato niente). Chi è attivo ha l'accesso all'app fino alla sua scadenza.</div></div>
      <button class="btn primary" data-act="kalos-run" ${k.configured && !k.running ? '' : 'disabled'}>${k.running ? 'In corso…' : 'Sincronizza ora'}</button></div>
    ${!k.configured ? '<div class="st pending" style="margin-top:10px;display:inline-block">Da collegare: su Render aggiungi KALOS_EMAIL e KALOS_PASSWORD nelle variabili d\'ambiente</div>' : ''}
    ${last ? `<div class="muted small" style="margin-top:10px">Ultima lettura: ${new Date(last.date).toLocaleString('it-IT')} · ${last.ok ? `${last.total} clienti (${last.attivi} attivi, ${last.scaduti} scaduti/in pausa) · ${last.activated} attivati, ${last.extended} rinnovati, ${last.pending} in attesa di iscrizione` : `<b style="color:var(--danger,#e55)">errore: ${esc(last.error)}</b>`}</div>` : ''}
    <div class="row" style="gap:8px;flex-wrap:wrap;margin:14px 0 10px">${Object.entries(groups).map(([st, l]) => `<button class="sbtn ${f === st ? 'acc' : ''}" data-act="kalos-f" data-f="${st}">${l} ${n(st)}</button>`).join('')}
      <button class="sbtn" data-act="kalos-copy" ${list.some((c) => !c.invited) ? '' : 'disabled'}>Copia le ${list.filter((c) => !c.invited).length} email non ancora invitate</button>
      <span class="muted small">Ora della lettura: <select id="khour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === k.hour ? 'selected' : ''}>${h}:00</option>`).join('')}</select></span></div>
    ${list.map((c) => `<div class="urow"><div class="uhead"><div style="flex:1;min-width:180px"><b>${esc(c.name || c.email)}</b><div class="muted small">${esc(c.email)} · ${esc(c.plan)}${c.invited ? ` · <b>email inviata il ${fmtDate(c.invited)}</b>${c.inviteLabel ? ` (${esc(c.inviteLabel)})` : ''}` : ''}</div></div>
      <span class="st ${c.status === 'attivo' ? 'ok' : 'expired'}">${{ attivo: 'scade', scaduto: 'scaduto', pausa: 'in pausa · scade' }[c.status]} ${fmtDate(c.until)}</span>
      <span class="st ${c.registered ? 'ok' : 'pending'}">${c.linkedTo ? `Collegato a ${esc(c.linkedTo)}` : c.registered ? 'Iscritto all\'app' : 'Non ancora iscritto'}</span>
      ${!c.registered || c.linkedTo ? `<button class="sbtn" data-act="kalos-link" data-email="${esc(c.email)}">${c.linkedTo ? 'Cambia' : 'Collega a un iscritto'}</button>` : ''}</div></div>`).join('') || '<div class="muted">Nessun cliente in questo elenco.</div>'}
  </div>`;
}
function userDetail(u) {
  const n = u.nutrition, pr = u.profile || {};
  const age = pr.birthYear ? new Date().getFullYear() - Number(pr.birthYear) : '';
  return `<div class="udetail">
    <div class="muted small">${[u.weight && `${u.weight} kg`, pr.heightCm && `${pr.heightCm} cm`, age && `${age} anni`, pr.sex && (pr.sex === 'M' ? 'uomo' : 'donna'), pr.trainingDays && `${pr.trainingDays.length} allenamenti/sett.`, pr.goal && { lose: 'vuole dimagrire', maintain: 'mantenimento', gain: 'vuole aumentare massa' }[pr.goal]].filter(Boolean).join(' · ') || 'Profilo non ancora compilato'}</div>
    <div class="lbl2" style="margin-top:12px">Nutrizione ${n.by === 'coach' ? `<span class="st ok">Impostata dal coach${n.coach ? ` · ${esc(n.coach)}` : ''}</span>` : '<span class="st pending">Scelta dal membro</span>'}</div>
    <form class="nutf" data-id="${u.id}">
      <div class="grid2" style="grid-template-columns:repeat(4,1fr)">
        <div class="f"><label>kcal/giorno (vuoto = calcolo auto)</label><input type="number" name="kcal" min="0" value="${esc(n.kcal)}"></div>
        <div class="f"><label>Proteine %</label><input type="number" name="p" min="0" max="100" value="${n.p}"></div>
        <div class="f"><label>Carboidrati %</label><input type="number" name="c" min="0" max="100" value="${n.c}"></div>
        <div class="f"><label>Grassi %</label><input type="number" name="f" min="0" max="100" value="${n.f}"></div></div>
      <div class="f"><label>Nota per il membro</label><textarea name="note" placeholder="es. Nei giorni di allenamento sposta i carboidrati intorno all'allenamento">${esc(n.note)}</textarea></div>
      <div class="row" style="gap:8px;justify-content:flex-end"><button type="button" class="sbtn" data-act="nut-free" data-id="${u.id}">Lascia scegliere al membro</button><button class="sbtn acc">Imposta come coach</button></div>
    </form>
    <div class="lbl2" style="margin-top:12px">Ultimi accessi assegnati</div>
    ${(u.accessLog || []).slice().reverse().map((l) => `<div class="muted small">${new Date(l.date).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${l.months ? `+${l.months} ${l.months === 1 ? 'mese' : 'mesi'} → ${fmtDate(l.until)}` : 'revocato'} · ${esc(l.by)}</div>`).join('') || '<div class="muted small">Nessuno</div>'}
  </div>`;
}

function tutorialsView() {
  return `<div class="panel"><div class="row" style="justify-content:space-between"><div class="h2" style="margin:0">Tutorial</div><button class="sbtn acc" data-act="bd-new" data-kind="tutorials">+ Nuovo tutorial</button></div>
    <div class="muted small" style="margin:6px 0 12px">Video lunghi di tecnica, linkati da YouTube, Google Drive o Vimeo. I membri li trovano in Allenamenti → Tutorial; se colleghi un esercizio, nel player compare il tasto "Guarda il tutorial".</div>
    ${S.tutorials.map((x) => `<div class="block">
      <div class="grid2"><div class="f"><label>Titolo</label><input type="text" data-bd="tutorials.${x.id}.title" value="${esc(x.title)}"></div>
        <div class="f"><label>Categoria</label><input type="text" data-bd="tutorials.${x.id}.category" value="${esc(x.category)}" placeholder="Swing, Squat, Mobilità…" list="tcats"></div>
        <div class="f"><label>Livello</label><select data-bd="tutorials.${x.id}.level">${['Tutti', 'Principiante', 'Intermedio', 'Avanzato'].map((l) => `<option ${x.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="f"><label>Durata (min)</label><input type="number" min="0" data-bd="tutorials.${x.id}.minutes" value="${esc(x.minutes)}"></div></div>
      <div class="f"><label>Link del video (YouTube, Google Drive o Vimeo)</label><input type="text" data-bd="tutorials.${x.id}.videoUrl" value="${esc(x.videoUrl)}" placeholder="https://youtu.be/…">
        ${x.videoUrl && !embedUrl(x.videoUrl) ? '<div class="small danger">Link non riconosciuto</div>' : ''}</div>
      <div class="f"><label>Descrizione: punti chiave ed errori comuni</label><textarea data-bd="tutorials.${x.id}.description" rows="4">${esc(x.description)}</textarea></div>
      <div class="f"><label>Esercizio collegato (opzionale)</label>${exPick(`data-bd="tutorials.${x.id}.exerciseId"`, x.exerciseId, '— nessuno —')}</div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><label class="chk"><input type="checkbox" data-bd="tutorials.${x.id}.published" ${x.published ? 'checked' : ''}> Pubblicato</label>
        <span><button class="sbtn danger" data-act="bd-del" data-kind="tutorials" data-id="${x.id}">Elimina</button> <button class="sbtn acc" data-act="bd-save" data-kind="tutorials" data-id="${x.id}">Salva</button></span></div>
    </div>`).join('') || '<div class="muted">Nessun tutorial ancora.</div>'}
    <datalist id="tcats">${[...new Set(S.tutorials.map((t) => t.category).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>`;
}

// le foto della chat chiedono l'accesso: si caricano con la chiave admin/staff e si mostrano in piccolo
const modPhoto = (file) => `<img class="modphoto" data-modphoto="/api/chatphotos/${esc(file)}" alt="foto">`;
function loadModPhotos() {
  root.querySelectorAll('img[data-modphoto]:not([src])').forEach(async (img) => {
    try { const r = await fetch(img.dataset.modphoto, { headers: authHeaders() }); img.src = URL.createObjectURL(await r.blob()); } catch {}
  });
}
function moderationView() {
  const { reports, general, banned } = S.mod;
  const t = (ts) => new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `<div class="cols two">
    <div class="panel"><div class="h2" style="margin-top:0">Segnalazioni (${reports.length})</div>
      ${reports.map((r) => `<div class="urow"><div class="muted small">${t(r.ts)} · segnalato da ${esc(r.byName)} · ${esc(r.message.where)}</div>
        <div style="margin:8px 0"><b>${esc(r.message.name)}:</b> ${r.message.photo ? modPhoto(r.message.photo) : ''}${esc(r.message.text) || (r.message.photo ? '' : '<i class="muted">già eliminato</i>')}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="sbtn danger" data-act="mod-del" data-id="${r.message.id}">Elimina messaggio</button>
          <button class="sbtn" data-act="mod-ignore" data-id="${r.id}">Ignora</button><button class="sbtn ghost danger" data-act="mod-ban" data-id="${r.message.from}" data-ban="1">Escludi ${esc(r.message.name)}</button></div></div>`).join('') || '<div class="muted">Nessuna segnalazione. 👍</div>'}
      <div class="h2">Ultimi messaggi nella chat di gruppo</div>
      ${general.map((m) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);gap:8px"><div style="min-width:0"><span class="muted small">${t(m.ts)}</span> <b>${esc(m.name)}:</b> ${m.deleted ? '<i class="muted">eliminato</i>' : `${m.photo ? modPhoto(m.photo) : ''}${esc(m.text)}`}</div>
        ${m.deleted ? '' : `<button class="sbtn ghost danger" data-act="mod-del" data-id="${m.id}">✕</button>`}</div>`).join('') || '<div class="muted">Ancora nessun messaggio.</div>'}
    </div>
    <div class="panel"><div class="h2" style="margin-top:0">Esclusi dalla community</div>
      <div class="muted small" style="margin-bottom:10px">Chi è escluso continua ad allenarsi con l'app, ma non vede la community e non può scrivere. I messaggi privati non sono visibili ai moderatori, se non quando vengono segnalati.</div>
      ${banned.map((u) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><div><b>${esc(u.name)}</b><div class="muted small">${esc(u.email)}</div></div><button class="sbtn" data-act="mod-ban" data-id="${u.id}" data-ban="0">Riammetti</button></div>`).join('') || '<div class="muted">Nessuno.</div>'}
    </div></div>`;
}

function staffView() {
  return `<div class="cols two">
    <div class="panel"><div class="h2" style="margin-top:0">Staff</div>
      <div class="muted small" style="margin-bottom:12px">I delegati entrano in /admin con email e password e vedono solo la sezione Membri: attivano gli abbonamenti, pre-attivano le email e impostano calorie e macro. Non possono toccare programmi, esercizi o impostazioni, né eliminare membri.</div>
      ${S.staff.map((x) => `<div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)"><div><b>${esc(x.name)}</b><div class="muted small">${esc(x.email)} · dal ${fmtDate(x.created)}</div></div><button class="sbtn ghost danger" data-act="staff-del" data-id="${x.id}">Rimuovi</button></div>`).join('') || '<div class="muted">Nessun delegato.</div>'}
    </div>
    <form class="panel" id="stf"><div class="h2" style="margin-top:0">Nuovo delegato</div>
      <div class="f"><label>Nome</label><input type="text" name="name"></div>
      <div class="f"><label>Email</label><input type="text" name="email"></div>
      <div class="f"><label>Password (min. 8 caratteri)</label><input type="text" name="password"></div>
      <button class="btn primary block">Crea accesso</button></form></div>`;
}

function settingsView() {
  const st = S.settings;
  return `<div class="panel" style="max-width:620px">
    <div class="f"><label>Nome dell'app</label><input type="text" data-set="appName" value="${esc(st.appName)}"></div>
    <div class="f"><label>Frase sotto il logo</label><input type="text" data-set="tagline" value="${esc(st.tagline)}"></div>
    <div class="f"><label>Link al sito per comprare l'abbonamento</label><input type="text" data-set="shopUrl" value="${esc(st.shopUrl)}" placeholder="https://tuosito.it/abbonamento">
      <div class="muted small">Ci arriva chi tocca "Abbonati": dalla prova gratuita, dagli allenamenti bloccati e dal profilo.</div></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Piani di abbonamento</label>
      <div class="muted small">Il membro tocca un piano e si apre direttamente il link di pagamento. Si vedono solo i piani con il link compilato.</div>
      ${(st.plans || []).map((x, i) => `<div class="urow" style="margin-top:8px"><div class="grid2">
        <div class="f"><label>Nome del piano</label><input type="text" data-plan="${i}.title" value="${esc(x.title)}"></div>
        <div class="f"><label>Prezzo</label><input type="text" data-plan="${i}.price" value="${esc(x.price)}" placeholder="es. 30 €"></div>
        <div class="f"><label>Periodo</label><input type="text" data-plan="${i}.period" value="${esc(x.period)}" placeholder="al mese / all'anno"></div>
        <div class="f"><label>Nota (opzionale)</label><input type="text" data-plan="${i}.note" value="${esc(x.note)}"></div></div>
        <div class="f"><label>Link di pagamento</label><input type="text" data-plan="${i}.url" value="${esc(x.url)}" placeholder="https://…"></div>
        <div class="row" style="justify-content:space-between"><label class="chk"><input type="checkbox" data-plan="${i}.best" ${x.best ? 'checked' : ''}> Consigliato</label><button class="sbtn danger" data-act="plan-rm" data-i="${i}">Elimina</button></div></div>`).join('')}
      <button class="sbtn" style="margin-top:8px" data-act="plan-add">+ Aggiungi piano</button></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Ritmo delle ripetizioni (EMOM e giri guidati)</label>
      <select id="pace">${[[1, 'Come nei video demo'], [1.15, '+15% più lento'], [1.25, '+25% più lento'], [1.35, '+35% più lento'], [1.5, '+50% più lento']].map(([v, l]) => `<option value="${v}" ${Number(st.paceFactor || 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="muted small">Vale per tutti gli esercizi a ripetizioni: es. 10 swing da 1 secondo durano 10 s "come nei video", 12,5 s con +25%. I video demo sono eseguiti a ritmo pulito; chi si allena con il peso e la fatica va più piano. Si applica subito, senza toccare i workout.</div></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Sblocco graduale delle settimane</label>
      <label class="chk"><input type="checkbox" data-set="dripWeeks" ${st.dripWeeks !== false ? 'checked' : ''}> Programmi base: una settimana nuova ogni 7 giorni da quando il membro inizia</label>
      <div class="muted small">Così chi si abbona un mese non può vedere (e fotografare) tutto il programma il primo giorno. Nei cicli si vedono sempre le settimane passate e quella in corso, mai quelle future.</div></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Settimana di prova gratuita</label>
      <label class="chk"><input type="checkbox" data-set="trialEnabled" ${st.trialEnabled ? 'checked' : ''}> Attiva: chi si registra può provare gratis</label>
      <div class="grid2" style="margin-top:8px"><div class="f" style="margin:0"><label>Giorni di prova</label><input type="number" min="1" max="30" data-set="trialDays" value="${esc(st.trialDays ?? 7)}"></div></div>
      <div class="f" style="margin-top:8px"><label>Messaggio a fine prova</label><textarea data-set="trialEndText" rows="4">${esc(st.trialEndText || '')}</textarea></div>
      <div class="grid2"><div class="f"><label>Testo del tasto per abbonarsi</label><input type="text" data-set="shopLabel" value="${esc(st.shopLabel || '')}" placeholder="es. Fai il piano da 30 € al mese"></div>
        <div class="f"><label>Seconda app da scaricare (link, opzionale)</label><input type="text" data-set="extraAppUrl" value="${esc(st.extraAppUrl || '')}" placeholder="https://…"></div>
        <div class="f"><label>Testo del tasto seconda app</label><input type="text" data-set="extraAppLabel" value="${esc(st.extraAppLabel || '')}" placeholder="es. Scarica l'app per abbonamento e dieta"></div></div>
      <div class="muted small" style="margin-bottom:6px">Link da mandare per la prova: <b>${esc(location.origin)}/#/prova</b> <button class="sbtn" data-act="copy-trial">Copia</button></div>
      <div class="muted small">In prova si vede una sola settimana di ogni programma (la settimana 1, o la settimana in corso nei cicli): le altre compaiono con il lucchetto. Si può fare una sola volta per email. Alla fine compare il tasto per abbonarsi.</div></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Video di benvenuto</label>
      <div class="f"><label>Titolo della schermata</label><input type="text" data-set="welcomeTitle" value="${esc(st.welcomeTitle || '')}" placeholder="Guarda il video di benvenuto"></div>
      <div class="f"><label>Carica il video (con audio)</label><input type="file" accept="video/*" data-upload="welcome"><div class="prog-bar"><i id="wbar"></i></div></div>
      ${st.welcomeVideo ? `<video src="${esc(st.welcomeVideo)}" controls playsinline style="width:180px;border-radius:10px;background:#000"></video><div><button class="sbtn danger" data-act="welcome-rm" style="margin-top:6px">Togli il video</button></div>` : ''}
      <div class="f" style="margin-top:8px"><label>…oppure un link (YouTube, Vimeo)</label><input type="text" data-set="welcomeUrl" value="${esc(st.welcomeUrl || '')}" placeholder="https://…"></div>
      <div class="muted small">Compare in Oggi a chi non l'ha ancora visto: sparisce quando lo guarda fino in fondo o lo chiude con ✕, e si può rivedere dal Profilo. Il video si attiva appena finisce di caricare. Se ne carichi uno nuovo, ricompare a tutti.</div></div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Email automatiche (dalla tua Gmail)</label>
      ${!S.mail ? '<div class="muted small">Carico…</div>' : `
      <div class="muted small">${S.mail.configured ? `Partono da <b>${esc(S.mail.from)}</b> · oggi inviate ${S.mail.today} su ${S.mail.cap} al giorno` : 'Da collegare: su Render aggiungi GMAIL_USER e GMAIL_APP_PASSWORD (la "password per le app" di Google).'}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <span class="muted small">Email della prova (2° giorno, 4° giorno, ultimo giorno) ogni mattina alle <select id="mhour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === S.mail.hour ? 'selected' : ''}>${h}:00</option>`).join('')}</select></span>
        <button class="sbtn" data-act="mail-test" ${S.mail.configured ? '' : 'disabled'}>Manda un'email di prova a me</button>
        <button class="sbtn" data-act="mail-run" ${S.mail.configured ? '' : 'disabled'}>Invia ora quelle di oggi</button></div>
      ${S.mail.campaigns.length ? `<div class="lbl2" style="margin-top:10px">Invii</div>${S.mail.campaigns.slice(-6).reverse().map((c) => `<div class="muted small">${esc(c.label)} · ${c.sent}/${c.total} inviate${c.failed ? ` · ${c.failed} errori` : ''}${c.done ? '' : ' · in corso'}</div>`).join('')}` : ''}
      ${S.mail.log.length ? `<div class="lbl2" style="margin-top:10px">Ultimi invii automatici</div>${S.mail.log.slice(0, 5).map((l) => `<div class="muted small">${new Date(l.date).toLocaleString('it-IT')} · ${l.kind === 'prova' ? 'prova' : esc(l.label || '')}: ${l.sent} inviate${l.failed ? `, ${l.failed} errori${l.error ? ` (${esc(l.error)})` : ''}` : ''}${l.left ? `, ${l.left} rimandate a domani` : ''}</div>`).join('')}` : ''}`}</div>
    <div class="f" style="border:1px solid var(--line);border-radius:12px;padding:12px"><label>Consulenza gratuita (servizio personalizzato)</label>
      <div class="grid2"><div class="f" style="margin:0"><label>Link per prenotare la call</label><input type="text" data-set="consultUrl" value="${esc(st.consultUrl || '')}" placeholder="es. https://calendly.com/…"></div>
        <div class="f" style="margin:0"><label>Scritta del tasto</label><input type="text" data-set="consultLabel" value="${esc(st.consultLabel || '')}" placeholder="Prenota la consulenza gratuita"></div></div>
      <div class="muted small">Compare nell'email dell'ultimo giorno di prova, sotto i piani. Ricordati di salvare.</div></div>
    <div class="f"><label>Email di assistenza</label><input type="text" data-set="supportEmail" value="${esc(st.supportEmail)}"></div>
    <div class="f"><label>Regole della community (le accetta chi entra)</label><textarea data-set="communityRules" rows="4">${esc(st.communityRules)}</textarea></div>
    <div class="f"><label>Logo (PNG trasparente, versione bianca per sfondo scuro)</label><input type="file" accept="image/*" data-upload="logo">
      ${st.logo ? `<div style="background:#0c0c0e;padding:16px;border-radius:12px;margin-top:8px"><img src="${esc(st.logo)}" style="height:48px"></div>` : ''}</div>
    <div class="savebar"><button class="btn primary" data-act="set-save">Salva impostazioni</button></div></div>`;
}

// ---- programmi --------------------------------------------------------------
// Cicli: date e stato (in arrivo / in corso / archiviato) come li vedono i membri
const isoDay = (d) => d.toISOString().slice(0, 10);
function cycleInfo(x) {
  if (x.kind !== 'cycle' || !x.startDate) return null;
  const start = new Date(x.startDate + 'T12:00:00Z');
  const last = x.endDate ? new Date(x.endDate + 'T12:00:00Z') : new Date(start.getTime() + ((Number(x.weeks) || 4) * 7 - 1) * 864e5);
  const t = isoDay(new Date()), state = x.startDate > t ? 'next' : isoDay(last) < t ? 'past' : 'now';
  const month = start.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return { state, month: month[0].toUpperCase() + month.slice(1), last: isoDay(last) };
}
function programsView() {
  const p = S.draft;
  const item = (x) => { const ci = cycleInfo(x); return `<button class="it ${x.id === S.progId ? 'on' : ''}" data-prog="${x.id}"><div><div style="font-weight:800">${esc(x.title)}</div>
    <div class="meta">${x.published ? '● Pubblicato' : '○ Bozza'} · ${ci ? `${esc(fmtDate(x.startDate))} → ${esc(fmtDate(ci.last))}` : x.kind === 'cycle' ? 'ciclo senza data' : 'base'} · ${(x.workouts || []).length} allenamenti</div></div></button>`; };
  const groups = { base: [], now: [], next: [], past: [] };
  for (const x of S.programs) { const ci = cycleInfo(x); groups[x.kind === 'cycle' ? (ci ? ci.state : 'next') : 'base'].push(x); }
  groups.next.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  groups.past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  // archivio raggruppato per mese di partenza, dal più recente
  const byMonth = new Map();
  for (const x of groups.past) { const m = cycleInfo(x).month; if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(x); }
  const sec = (title, list, note = '') => (list.length ? `<div class="lbl2" style="margin:12px 4px 6px">${title}</div>${note}${list.map(item).join('')}` : '');
  return `<div class="cols ${p ? 'has-sel' : ''}">
    <div class="side"><button class="btn primary add" data-act="p-new">+ Nuovo programma</button>
      ${sec('Programmi base', groups.base)}${sec('Cicli in corso', groups.now)}${sec('Cicli in arrivo', groups.next)}
      ${groups.past.length ? `<div class="lbl2" style="margin:16px 4px 2px">Archivio cicli</div><div class="muted small" style="margin:0 4px 6px">Finiti: i membri non li vedono più. Puoi duplicarli e riusarli con nuove date.</div>
        ${[...byMonth].map(([m, list]) => `<div class="small" style="margin:8px 4px 4px;font-weight:800">${esc(m)}</div>${list.map(item).join('')}`).join('')}` : ''}
      ${S.programs.length ? '' : '<div class="muted small" style="padding:8px">Nessun programma ancora.</div>'}
    </div>
    <div class="panel">${p ? `<button class="sbtn mback" data-act="p-back">‹ Torna all\'elenco</button>` + programEditor(p) : '<div class="muted">Scegli un programma o creane uno nuovo. Struttura: programma → allenamenti (per settimana) → fasi (riscaldamento, workout, defaticamento) → blocchi (EMOM, AMRAP, AFAP, round a tempo, serie) → esercizi.</div>'}</div>
  </div>`;
}

function programEditor(p) {
  return `
    <div class="grid2"><div class="f"><label>Titolo</label><input type="text" data-b="title" value="${esc(p.title)}"></div>
      <div class="f"><label>Sottotitolo</label><input type="text" data-b="subtitle" value="${esc(p.subtitle)}"></div></div>
    <div class="grid2"><div class="f"><label>Livello</label><select data-b="level">${['Principiante', 'Intermedio', 'Intermedio/Avanzato', 'Avanzato'].map((l) => `<option ${p.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="f"><label>Settimane</label><input type="number" min="0" data-b="weeks" value="${esc(p.weeks)}"></div>
      <div class="f"><label>Tipo</label><select data-b="kind"><option value="base" ${p.kind !== 'cycle' ? 'selected' : ''}>Programma base (sempre disponibile)</option><option value="cycle" ${p.kind === 'cycle' ? 'selected' : ''}>Ciclo (dura N settimane da una data)</option></select></div>
      ${p.kind === 'cycle' ? `<div class="f"><label>Inizio del ciclo</label><input type="date" data-b="startDate" value="${esc(p.startDate)}"></div>
        <div class="f"><label>Fine del ciclo (ultimo giorno)</label><input type="date" data-b="endDate" value="${esc(p.endDate || '')}">
          <div class="muted small">${cycleInfo(p) ? `Visibile ai membri dal ${esc(fmtDate(p.startDate))} al ${esc(fmtDate(cycleInfo(p).last))}, poi va in archivio.` : 'Se la lasci vuota: inizio + settimane.'}</div></div>` : ''}
      <div class="f"><label>Copertina</label><input type="file" accept="image/*" data-upload="cover">${p.cover ? `<img src="${esc(p.cover)}" style="width:100%;border-radius:10px;margin-top:6px">` : ''}</div></div>
    <div class="f"><label>Descrizione</label><textarea data-b="description">${esc(p.description)}</textarea></div>
    <label class="chk"><input type="checkbox" data-b="published" ${p.published ? 'checked' : ''}> Pubblicato (visibile agli utenti)</label>
    <div class="h2" style="margin-top:22px">Allenamenti</div>
    ${(p.workouts || []).map((w, wi) => workoutEditor(w, wi)).join('')}
    <button class="sbtn acc" data-act="w-add">+ Aggiungi allenamento</button>
    <div class="savebar"><button class="sbtn danger" data-act="p-del">Elimina programma</button><button class="sbtn" data-act="p-dup">Duplica programma</button><button class="btn primary" data-act="p-save">${S.dirty ? '● ' : ''}Salva programma</button></div>`;
}

function workoutEditor(w, wi) {
  const open = S.openWk[w.id];
  const P = `workouts.${wi}`;
  return `<div class="wk"><div class="hd" data-act="w-toggle" data-wid="${w.id}">
      <span>${open ? '▾' : '▸'}</span><div class="t">${w.week ? `S${esc(w.week)} · ` : ''}${esc(w.title)}</div>
      <span class="muted small">~${Math.round(estimateSeconds(w) / 60)} min</span>
      <button class="sbtn ghost" data-act="w-up" data-wi="${wi}">↑</button><button class="sbtn ghost" data-act="w-down" data-wi="${wi}">↓</button>
      <button class="sbtn ghost" data-act="w-dup" data-wi="${wi}">Duplica</button>
      <a class="sbtn ghost" href="/#/play/${S.draft.id}/${w.id}" target="_blank">Anteprima ▶</a>
      <button class="sbtn ghost danger" data-act="w-del" data-wi="${wi}">✕</button></div>
    ${open ? `<div class="bd">
      <div class="grid2"><div class="f"><label>Titolo</label><input type="text" data-b="${P}.title" value="${esc(w.title)}"></div>
        <div class="f"><label>Settimana</label><input type="number" min="0" data-b="${P}.week" value="${esc(w.week)}"></div></div>
      <div class="f"><label>Descrizione</label><input type="text" data-b="${P}.description" value="${esc(w.description)}"></div>
      ${(w.phases || []).map((ph, pi) => phaseEditor(ph, `${P}.phases.${pi}`)).join('')}
      <div class="row" style="margin-top:12px">${Object.entries(PHASE_TYPES).map(([k, v]) => `<button class="sbtn" data-act="ph-add" data-path="${P}" data-type="${k}">+ ${v}</button>`).join('')}</div>
    </div>` : ''}</div>`;
}

function phaseEditor(ph, P) {
  return `<div class="phase"><div class="phd"><span class="pill accent">${esc(PHASE_TYPES[ph.type])}</span>
      <input type="text" style="flex:1;min-width:140px" data-b="${P}.title" value="${esc(ph.title)}" placeholder="Nome fase">
      ${mover(P)}</div>
    ${(ph.blocks || []).map((b, bi) => blockEditor(b, `${P}.blocks.${bi}`)).join('')}
    <div class="row" style="margin-top:10px">${Object.entries(BLOCK_TYPES).map(([k, v]) => `<button class="sbtn" data-act="b-add" data-path="${P}" data-type="${k}">+ ${v.split(' (')[0]}</button>`).join('')}</div></div>`;
}

const num = (P, key, val, label, ph = '') => `<div class="f"><label>${label}</label><input type="number" min="0" data-b="${P}.${key}" value="${esc(val ?? '')}" placeholder="${ph}"></div>`;

function blockEditor(b, P) {
  const params = {
    emom: num(P, 'every', b.every, 'Ogni (secondi)', '60') + `<div class="f"><label>Round</label><input type="number" min="1" data-b="${P}.rounds" value="${esc(b.rounds || emomRounds(b))}">
        <div class="muted small">${emomRounds(b)} round × ${emomSlotCount(b)} ${emomSlotCount(b) === 1 ? 'intervallo' : 'intervalli'} = <b>${String(Math.round((emomIntervals(b) * (Number(b.every) || 60)) / 6) / 10).replace('.', ',')} min</b></div></div>`
      + `<div class="f"><label>Ladder: rip in più a ogni giro (tutti)</label><input type="number" data-b="${P}.ladderStep" value="${esc(b.ladderStep ?? '')}" placeholder="0 = sempre uguali"></div>`
      + `<div class="f"><label>Andamento ladder</label><label class="chk"><input type="checkbox" data-b="${P}.ladderUpDown" ${b.ladderUpDown ? 'checked' : ''}> Sale fino a metà, poi scende</label>
          ${b.ladderUpDown ? `<select data-b="${P}.ladderPeak" style="margin-top:6px"><option value="double" ${b.ladderPeak !== 'single' ? 'selected' : ''}>Punta doppia (1-2-3-3-2-1)</option><option value="single" ${b.ladderPeak === 'single' ? 'selected' : ''}>Punta singola (1-2-3-2-1)</option></select>` : ''}</div>`
      + `<div class="f"><label>Recupero a fine giro</label><label class="chk"><input type="checkbox" data-b="${P}.restSlot" ${b.restSlot ? 'checked' : ''}> Dopo l'ultimo esercizio, un intervallo intero di recupero</label><div class="muted small">es. 2 esercizi + 1 minuto di recupero, poi si ricomincia</div></div>`,
    ladder: num(P, 'from', b.from, 'Da (rip)') + num(P, 'to', b.to, 'A (rip)') + num(P, 'step', b.step, 'Salto', '1') + num(P, 'rest', b.rest, 'Recupero tra gradini (s)')
      + `<div class="f"><label>Andata e ritorno</label><label class="chk"><input type="checkbox" data-b="${P}.updown" ${b.updown ? 'checked' : ''}> es. 1→10→1</label>
          ${b.updown ? `<select data-b="${P}.peak" style="margin-top:6px"><option value="single" ${b.peak !== 'double' ? 'selected' : ''}>Punta singola (…8-10-8…)</option><option value="double" ${b.peak === 'double' ? 'selected' : ''}>Punta doppia (…8-10-10-8…)</option></select>` : ''}</div>`,
    amrap: num(P, 'cap', b.cap, 'Durata (minuti)'),
    fortime: num(P, 'rounds', b.rounds, 'Round') + num(P, 'cap', b.cap, 'Time cap (min, opz.)'),
    intervals: num(P, 'rounds', b.rounds, 'Round') + num(P, 'work', b.work, 'Lavoro (s)') + num(P, 'rest', b.rest, 'Recupero (s)') + num(P, 'restRounds', b.restRounds, 'Recupero tra round (s)'),
    sets: num(P, 'rounds', b.rounds, 'Serie') + num(P, 'rest', b.rest, 'Recupero (s)'),
    video: num(P, 'minutes', b.minutes, 'Durata (minuti, circa)'),
    rest: num(P, 'seconds', b.seconds, 'Pausa (secondi)', '60'),
  }[b.type];
  // recupero automatico dopo il blocco (comodo con i blocchi duplicati, es. 6 tabata di fila)
  const after = b.type === 'rest' || b.type === 'video' ? '' : num(P, 'restAfter', b.restAfter, 'Recupero dopo il blocco (s)', '0 = nessuno');
  if (b.type === 'rest') return `<div class="block pauseblock"><div class="bhd"><b>⏸ Pausa</b><span class="muted small">${esc(blockSummary(b))}</span><span style="flex:1"></span><button class="sbtn ghost" data-act="b-dup" data-path="${P}">⧉ Duplica</button>${mover(P)}</div>
    <div class="grid2">${params}</div><div class="muted small">Recupero tra il blocco sopra e quello sotto: il membro vede il conto alla rovescia e il primo esercizio del blocco che arriva.</div></div>`;
  const thirdCol = b.type === 'intervals' ? 'Lavoro (s) opz.' : b.type === 'emom' ? 'Stesso minuto · ladder' : '';
  return `<div class="block"><div class="bhd"><b>${esc(BLOCK_TYPES[b.type])}</b><span class="muted small">${esc(blockSummary(b))}</span><span style="flex:1"></span><button class="sbtn ghost" data-act="b-dup" data-path="${P}" title="Duplica blocco">⧉ Duplica</button>${mover(P)}</div>
    <div class="grid2"><div class="f"><label>Titolo blocco</label><input type="text" data-b="${P}.title" value="${esc(b.title)}"></div>${params}${after}</div>
    <div class="f"><label>Note</label><input type="text" data-b="${P}.notes" value="${esc(b.notes)}" placeholder="es. Usa un peso che ti permetta tecnica perfetta"></div>
    ${b.type === 'emom' ? '<div class="muted small" style="margin:-4px 0 8px">Un esercizio per riga = round diversi (round 1, round 2…). Spunta "con sopra" per farli nello stesso round. Ladder: "+rip" accanto all\'esercizio = quante ripetizioni aggiunge a ogni giro (vale solo per lui); il campo sopra vale per tutti. Con "sale fino a metà" le ripetizioni salgono e poi tornano indietro (es. 10 round: 1-2-3-4-5-5-4-3-2-1).</div>' : ''}
    ${b.type === 'ladder' ? '<div class="muted small" style="margin:-4px 0 8px">Ogni gradino fa tutti gli esercizi con lo stesso numero di ripetizioni (es. 1 pull-up + 1 push-up, poi 2 + 2…). Il tempo totale diventa il risultato del membro.</div>' : ''}
    ${b.type === 'video' ? `<div class="f"><label>Link del video (YouTube, Google Drive o Vimeo)</label><input type="text" data-b="${P}.url" value="${esc(b.url)}" placeholder="https://youtu.be/…">
      ${b.url ? (embedUrl(b.url) ? `<iframe style="width:100%;max-width:420px;aspect-ratio:16/9;border:0;border-radius:10px" src="${esc(embedUrl(b.url))}" allowfullscreen></iframe>` : '<div class="small danger">Link non riconosciuto: usa un link di YouTube, Google Drive o Vimeo.</div>') : ''}
      <div class="muted small">Su Drive il file va condiviso con "Chiunque abbia il link". Su YouTube puoi usare video "Non in elenco": li vede solo chi ha il link.</div></div></div>` : `
    <div class="items"><div class="irow ihdr"><span>Esercizio</span><span>Reps / tempo</span><span>${thirdCol}</span><span>Note</span><span></span></div>
      ${(b.items || []).map((it, ii) => `<div class="irow">
        ${exPick(`data-b="${P}.items.${ii}.exerciseId"`, it.exerciseId)}
        ${b.type === 'ladder' ? '<span class="muted small">rip dal gradino</span>' : `<input type="text" data-b="${P}.items.${ii}.reps" value="${esc(it.reps)}" placeholder="es. 10 o 8-12">`}
        ${b.type === 'intervals' ? `<input type="number" min="0" data-b="${P}.items.${ii}.time" value="${esc(it.time ?? '')}" placeholder="${esc(b.work || '')}">`
          : b.type === 'emom' ? `<span class="row" style="gap:6px;flex-wrap:nowrap"><label class="chk" title="Esegui nello stesso minuto dell'esercizio sopra"><input type="checkbox" data-b="${P}.items.${ii}.samePrev" ${it.samePrev ? 'checked' : ''} ${ii === 0 ? 'disabled' : ''}> con sopra</label>
              <input type="number" style="width:70px" title="Ladder di questo esercizio: rip in più a ogni giro" data-b="${P}.items.${ii}.ladderStep" value="${esc(it.ladderStep ?? '')}" placeholder="+rip"></span>` : '<span></span>'}
        <input type="text" data-b="${P}.items.${ii}.notes" value="${esc(it.notes)}" placeholder="opzionale">
        <span class="acts">${mover(`${P}.items.${ii}`)}</span></div>`).join('')}
    </div>
    <button class="sbtn" style="margin-top:8px" data-act="i-add" data-path="${P}">+ Esercizio</button></div>`}`;
}

const mover = (P) => `<button class="sbtn ghost" data-act="mv-up" data-path="${P}">↑</button><button class="sbtn ghost" data-act="mv-down" data-path="${P}">↓</button><button class="sbtn ghost danger" data-act="rm" data-path="${P}">✕</button>`;

// ---- utilità sui percorsi tipo "workouts.0.phases.1.blocks.2" -----------------
function getPath(obj, path) { return path.split('.').reduce((o, k) => o?.[k], obj); }
function setPath(obj, path, val) {
  const ks = path.split('.');
  const last = ks.pop();
  const o = ks.reduce((x, k) => x[k], obj);
  o[last] = val;
}
function parentOf(path) {
  const ks = path.split('.');
  const i = Number(ks.pop());
  return { arr: getPath(S.draft, ks.join('.')), i };
}

// ---- eventi ----------------------------------------------------------------
root.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.b && S.draft) {
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    setPath(S.draft, t.dataset.b, v);
    S.dirty = true;
    if (t.tagName === 'SELECT' || t.type === 'checkbox' || /^(startDate|endDate|weeks)$/.test(t.dataset.b) || /\.(minutes|every|cap|rounds|work|rest|restRounds|week|url|ladderStep|ladderUpDown|ladderPeak|restSlot|peak|from|to|step|updown|seconds|restAfter)$/.test(t.dataset.b)) softRender();
  }
  if (t.dataset.exf) {
    const ex = S.exercises.find((x) => x.id === S.exId);
    ex[t.dataset.exf] = t.value;
    const v = document.getElementById('exvid');
    if (t.dataset.exf === 'repsInVideo' && Number(t.value) > 0 && v?.duration) {
      ex.secPerRep = String(Math.round((v.duration / Number(t.value)) * 10) / 10);
      document.getElementById('spr').value = ex.secPerRep;
    }
  }
  if (t.dataset.bd) {
    const [kind, id, field] = t.dataset.bd.split('.');
    const x = S[kind].find((y) => y.id === id);
    x[field] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
    x._dirty = true;
  }
  if (t.dataset.plan) { const [i, f] = t.dataset.plan.split('.'); S.settings.plans[Number(i)][f] = t.type === 'checkbox' ? t.checked : t.value; }
  if (t.dataset.set) S.settings[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
  if (['ms', 'mt', 'mk', 'mb', 'ml'].includes(t.id)) {
    S.md[{ ms: 'subject', mt: 'text', mk: 'link', mb: 'btn', ml: 'label' }[t.id]] = t.value;
    const pos = t.selectionStart; softRender(); const el = document.getElementById(t.id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch {} }
  }
  if (t.id === 'mp') { S.mp = t.value; const pos = t.selectionStart; softRender(); const el = document.getElementById('mp'); el?.focus(); try { el.setSelectionRange(pos, pos); } catch {} }
  if (t.id === 'uq') { S.uq = t.value; softRender(); document.getElementById('uq')?.focus(); }
  if (t.id === 'exlistq') {
    S.exQ = t.value;
    root.querySelectorAll('.side .it[data-ex]').forEach((b) => { b.hidden = !exMatch(S.exercises.find((x) => x.id === b.dataset.ex) || {}, S.exQ); });
  }
  if (t.classList.contains('exq')) {
    const res = t.nextElementSibling, q = t.value.trim();
    const hits = q ? S.exercises.filter((x) => x.id !== t.dataset.skip && exMatch(x, q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8) : [];
    res.innerHTML = hits.map((x) => `<button type="button" class="exhit" data-pick="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.category || '')}</small></button>`).join('') || (q ? '<div class="muted small" style="padding:8px">Nessun esercizio trovato</div>' : '');
    res.hidden = !q;
  }
});
// Scelta dai risultati della ricerca: imposta il menu e salva come se l'avessi scelto lì
function pickExercise(btn) {
  const box = btn.closest('.exsel'), sel = box.querySelector('select');
  sel.value = btn.dataset.pick;
  box.querySelector('.exq').value = '';
  box.querySelector('.exres').hidden = true;
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList?.contains('exq')) { e.preventDefault(); const first = e.target.nextElementSibling.querySelector('.exhit'); if (first) pickExercise(first); }
});

// Ridisegna senza perdere il punto in cui stavi scrivendo.
function softRender() {
  const a = document.activeElement?.dataset?.b;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
  if (a) { const el = root.querySelector(`[data-b="${a}"]`); el?.focus?.(); }
}

root.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'pace') {
    await call('PUT', '/api/admin/settings', { paceFactor: Number(t.value) });
    S.settings.paceFactor = Number(t.value); setPace(S.settings.paceFactor);
    return toast(Number(t.value) === 1 ? 'Ritmo come nei video demo' : `Ripetizioni ${Math.round((Number(t.value) - 1) * 100)}% più lente per tutti`);
  }
  if (t.id === 'mg') { S.mg = t.value; return render(); }
  if (t.id === 'mhour') {
    await call('PUT', '/api/admin/settings', { trialMailHour: Number(t.value) });
    S.settings.trialMailHour = S.mail.hour = Number(t.value);
    return toast(`Email della prova ogni mattina alle ${t.value}:00`);
  }
  if (t.id === 'khour') {
    await call('PUT', '/api/admin/settings', { kalosHour: Number(t.value) });
    S.settings.kalosHour = S.kalos.hour = Number(t.value);
    return toast(`Lettura da Kalos ogni giorno alle ${t.value}:00`);
  }
  if (!t.dataset.upload || !t.files[0]) return;
  const bar = document.getElementById('upbar');
  try {
    const welcome = t.dataset.upload === 'welcome';
    const url = await uploadFile(t.files[0], (f) => { const b = welcome ? document.getElementById('wbar') : bar; if (b) b.style.width = `${f * 100}%`; }, welcome ? '?audio=1' : '');
    if (t.dataset.upload === 'ex-video' || t.dataset.upload === 'ex-videobox') {
      const ex = S.exercises.find((x) => x.id === S.exId);
      ex[t.dataset.upload === 'ex-video' ? 'video' : 'videoBox'] = url.url || url;
      await call('PUT', `/api/admin/exercises/${ex.id}`, ex);
      toast(url.after ? `Video pronto: da ${Math.round(url.before / 1048576)} MB a ${(url.after / 1048576).toFixed(1)} MB` : 'Video caricato');
    } else if (welcome) {
      S.settings.welcomeVideo = (await call('PUT', '/api/admin/settings', { welcomeVideo: String(url) })).welcomeVideo; // si salva subito, senza dover premere Salva
      toast('Video di benvenuto caricato e attivo');
    } else if (t.dataset.upload === 'logo') {
      S.settings.logo = String(url);
      toast('Logo caricato · ricordati di salvare');
    } else if (t.dataset.upload.startsWith('tip:')) {
      const x = S.tips.find((y) => y.id === t.dataset.upload.slice(4));
      x.image = String(url); x._dirty = true;
    } else if (t.dataset.upload === 'cover') {
      S.draft.cover = String(url); S.dirty = true;
      toast('Copertina caricata · ricordati di salvare');
    }
    render();
  } catch (err) { toast(err.message, true); }
});

root.addEventListener('click', async (e) => {
  const hit = e.target.closest('[data-pick]');
  if (hit) return pickExercise(hit);
  const t = e.target.closest('[data-tab],[data-ex],[data-prog],[data-act],[data-grant],[data-uf]');
  if (!t) return;
  try {
    if (t.dataset.uf) { S.uf = t.dataset.uf; return render(); }
    if (t.dataset.grant) {
      const u = S.users.find((y) => y.id === t.dataset.id), m = Number(t.dataset.grant);
      if (!confirm(`Aggiungere ${m === 12 ? '1 anno' : m + (m === 1 ? ' mese' : ' mesi')} di accesso a ${u.name}?`)) return;
      Object.assign(u, await call('POST', `/api/admin/users/${u.id}/access`, { months: m }));
      toast(`Attivo fino al ${fmtDate(u.accessUntil)}`);
      return softRender();
    }
    if (t.dataset.tab) {
      S.tab = t.dataset.tab;
      if (S.tab === 'kalos') { S.kalos = null; render(); S.kalos = await call('GET', '/api/admin/kalos'); }
      if (S.tab === 'email') { S.mail = null; render(); [S.mail, S.kalos] = await Promise.all([call('GET', '/api/admin/mail').catch(() => null), call('GET', '/api/admin/kalos').catch(() => ({ clients: [] }))]); }
      if (S.tab === 'settings') { S.mail = null; render(); S.mail = await call('GET', '/api/admin/mail').catch(() => null); }
      return render();
    }
    if (t.dataset.ex) { S.exId = t.dataset.ex; render(); return window.scrollTo(0, 0); }
    if (t.dataset.prog) {
      if (S.dirty && !confirm('Ci sono modifiche non salvate. Continuare?')) return;
      S.progId = t.dataset.prog; S.draft = structuredClone(S.programs.find((x) => x.id === S.progId)); S.dirty = false;
      render(); return window.scrollTo(0, 0);
    }
    const act = t.dataset.act;
    const path = t.dataset.path;
    switch (act) {
      case 'ex-new': { const x = await call('POST', '/api/admin/exercises', { name: 'Nuovo esercizio' }); S.exercises.push(x); S.exId = x.id; render(); window.scrollTo(0, 0); return; }
      case 'ex-save': { const x = S.exercises.find((y) => y.id === S.exId); await call('PUT', `/api/admin/exercises/${x.id}`, x);
        // aggiorna i collegamenti automatici senza perdere quello che stai scrivendo altrove
        for (const f of await call('GET', '/api/admin/exercises')) {
          const o = S.exercises.find((y) => y.id === f.id);
          if (!o) S.exercises.push(f); else if (o.id !== S.exId) { o.easierId = f.easierId; o.harderId = f.harderId; }
        }
        toast('Esercizio salvato'); break; }
      case 'ex-del': if (!confirm('Eliminare questo esercizio?')) return; await call('DELETE', `/api/admin/exercises/${S.exId}`); S.exercises = await call('GET', '/api/admin/exercises'); S.exId = null; break;
      case 'p-new': { const x = await call('POST', '/api/admin/programs', {}); S.programs.push(x); S.progId = x.id; S.draft = structuredClone(x); S.dirty = false; render(); window.scrollTo(0, 0); return; }
      case 'p-save': { const x = await call('PUT', `/api/admin/programs/${S.draft.id}`, S.draft); S.programs = S.programs.map((y) => (y.id === x.id ? x : y)); S.dirty = false; toast('Programma salvato'); break; }
      case 'p-dup': {
        // copia completa (allenamenti, fasi, blocchi, esercizi) con id nuovi; "Vol. 1" diventa "Vol. 2", nascosta ai membri finché non la pubblichi
        if (S.dirty && !confirm('Ci sono modifiche non salvate: verranno copiate anche quelle nel nuovo programma. Continuare?')) return;
        const copy = JSON.parse(JSON.stringify(S.draft), (k, v) => (k === 'id' ? uid() : v));
        delete copy.id;
        copy.title = /\d+\s*$/.test(copy.title) ? copy.title.replace(/(\d+)\s*$/, (m, n) => String(Number(n) + 1)) : `${copy.title} (copia)`;
        copy.published = false;
        if (copy.kind === 'cycle') { copy.startDate = ''; copy.endDate = ''; }
        const x = await call('POST', '/api/admin/programs', copy);
        S.programs.push(x); S.progId = x.id; S.draft = structuredClone(x); S.dirty = false; S.openWk = {};
        toast(x.kind === 'cycle' ? `Creato "${x.title}" · metti le nuove date e pubblicalo` : `Creato "${x.title}" · è nascosto ai membri finché non lo pubblichi`); render(); window.scrollTo(0, 0); return;
      }
      case 'p-del': if (!confirm('Eliminare il programma e tutti i suoi allenamenti?')) return; await call('DELETE', `/api/admin/programs/${S.draft.id}`); S.programs = S.programs.filter((y) => y.id !== S.draft.id); S.draft = null; S.progId = null; S.dirty = false; break;
      case 'w-add': {
        const w = { id: uid(), title: `Allenamento ${S.draft.workouts.length + 1}`, week: 1, description: '', phases: [{ id: uid(), type: 'warmup', title: 'Riscaldamento', blocks: [] }, { id: uid(), type: 'workout', title: 'Workout', blocks: [] }, { id: uid(), type: 'cooldown', title: 'Defaticamento', blocks: [] }] };
        S.draft.workouts.push(w); S.openWk[w.id] = true; S.dirty = true; break;
      }
      case 'w-toggle': if (e.target.closest('button,a')) return; S.openWk[t.dataset.wid] = !S.openWk[t.dataset.wid]; break;
      case 'w-dup': {
        const src = S.draft.workouts[Number(t.dataset.wi)];
        const copy = JSON.parse(JSON.stringify(src), (k, v) => (k === 'id' ? uid() : v));
        copy.title = src.title + ' (copia)';
        S.draft.workouts.splice(Number(t.dataset.wi) + 1, 0, copy); S.dirty = true; break;
      }
      case 'w-up': case 'w-down': case 'w-del': {
        const i = Number(t.dataset.wi), arr = S.draft.workouts;
        if (act === 'w-del') { if (!confirm('Eliminare questo allenamento?')) return; arr.splice(i, 1); }
        else { const j = act === 'w-up' ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
        S.dirty = true; break;
      }
      case 'ph-add': getPath(S.draft, path).phases.push({ id: uid(), type: t.dataset.type, title: PHASE_TYPES[t.dataset.type], blocks: [] }); S.dirty = true; break;
      case 'b-add': {
        const defaults = { emom: { rounds: 10, every: 60 }, amrap: { cap: 12 }, fortime: { rounds: 3, cap: 0 }, intervals: { rounds: 3, work: 40, rest: 20, restRounds: 60 }, sets: { rounds: 3, rest: 60 }, ladder: { from: 1, to: 10, step: 1, rest: 0, updown: false }, video: { minutes: 20, url: '' }, rest: { seconds: 60 } }[t.dataset.type];
        getPath(S.draft, path).blocks.push({ id: uid(), type: t.dataset.type, title: '', notes: '', items: [], ...defaults }); S.dirty = true; break;
      }
      case 'plan-add': (S.settings.plans ||= []).push({ title: '', price: '', period: 'al mese', note: '', url: '', best: false }); break;
      case 'kalos-f': S.kf = t.dataset.f; break;
      case 'u-trial': {
        try { const r = await call('POST', `/api/admin/users/${t.dataset.id}/trial`); toast(`Prova attiva fino al ${fmtDate(r.trialUntil)}`); S.users = await call('GET', '/api/admin/users'); } catch (err) { toast(err.message, true); }
        break;
      }
      case 'u-reset': {
        const { link } = await call('POST', `/api/admin/users/${t.dataset.id}/reset-link`);
        try { await navigator.clipboard.writeText(link); toast('Link copiato (vale 1 ora): mandalo al cliente'); } catch { prompt('Link per la nuova password (vale 1 ora):', link); }
        return;
      }
      case 'mail-send': {
        const d = S.md, rec = mailRecipients();
        if (!d.label.trim() || !d.subject.trim() || !d.text.trim()) return toast('Scrivi nome dell\'invio, oggetto e testo', true);
        if (!confirm(`Inviare "${d.subject}" a ${rec.length} persone?`)) return;
        try {
          const r = await call('POST', '/api/admin/campaign', { label: d.label.trim(), subject: d.subject, body: `${d.text}${d.link ? `\n\n${d.btn || 'Apri'}: ${d.link}` : ''}`, htmlBody: mailHtml(d.text, d.link, d.btn), recipients: rec });
          toast(`Invio partito a ${r.total} persone${r.skipped ? ` (${r.skipped} saltate: già ricevuta o doppie)` : ''}`);
          if (S.mg === 'kexp') await call('POST', '/api/admin/kalos/invited', { emails: rec.map((x) => x.email), label: d.label.trim() });
          S.md = null;
        } catch (err) { return toast(err.message, true); }
        S.mail = await call('GET', '/api/admin/mail'); break;
      }
      case 'mail-test': {
        const d = S.tab === 'email' && S.md;
        const payload = d && d.subject ? { subject: d.subject, body: `${d.text}${d.link ? `\n\n${d.btn || 'Apri'}: ${d.link}` : ''}`, htmlBody: mailHtml(d.text, d.link, d.btn) } : {};
        try { await call('POST', '/api/admin/mail/test', payload); toast('Email di prova inviata: controlla la tua casella'); } catch (err) { toast(err.message, true); }
        return;
      }
      case 'mail-run': { const r = await call('POST', '/api/admin/mail/run'); toast(r.log ? `Inviate ${r.log.sent}${r.log.failed ? `, ${r.log.failed} errori` : ''}` : 'Niente da inviare'); S.mail = await call('GET', '/api/admin/mail'); break; }
      case 'kalos-run': {
        S.kalos.running = true; render();
        try { const r = await call('POST', '/api/admin/kalos/run'); toast(r.ok ? `Letti ${r.total} clienti da Kalos` : `Errore: ${r.error}`, !r.ok); } catch (err) { toast(err.message, true); }
        S.kalos = await call('GET', '/api/admin/kalos'); break;
      }
      case 'kalos-link': {
        const appEmail = prompt(`Con quale email si è iscritto all'app ${t.dataset.email}?\n(lascia vuoto per scollegare)`);
        if (appEmail === null) return;
        try {
          const r = await call('POST', '/api/admin/kalos/link', { kalosEmail: t.dataset.email, appEmail });
          toast(appEmail ? `Collegato${r.accessUntil ? ` · accesso fino al ${fmtDate(r.accessUntil)}` : ''}` : 'Scollegato');
        } catch (err) { return toast(err.message, true); }
        [S.kalos, S.users] = await Promise.all([call('GET', '/api/admin/kalos'), call('GET', '/api/admin/users')]); break;
      }
      case 'kalos-copy': {
        const txt = S.kalos.clients.filter((c) => c.status === (S.kf || 'attivo') && !c.invited).map((c) => c.email).join('\n');
        try { await navigator.clipboard.writeText(txt); toast('Email copiate'); } catch { prompt('Copia le email:', txt.replace(/\n/g, ', ')); }
        return;
      }
      case 'welcome-rm': if (!confirm('Togliere il video di benvenuto?')) return; await call('PUT', '/api/admin/settings', { welcomeVideo: '' }); S.settings.welcomeVideo = ''; toast('Video tolto'); break;
      case 'plan-rm': if (!confirm('Eliminare questo piano?')) return; S.settings.plans.splice(Number(t.dataset.i), 1); break;
      case 'copy-trial': { try { await navigator.clipboard.writeText(`${location.origin}/#/prova`); toast('Link copiato'); } catch { prompt('Copia il link:', `${location.origin}/#/prova`); } return; }
      case 'b-dup': {
        const { arr, i } = parentOf(path);
        arr.splice(i + 1, 0, JSON.parse(JSON.stringify(arr[i]), (k, v) => (k === 'id' ? uid() : v))); S.dirty = true; break;
      }
      case 'i-add': getPath(S.draft, path).items.push({ exerciseId: '', reps: '', notes: '' }); S.dirty = true; break;
      case 'mv-up': case 'mv-down': case 'rm': {
        const { arr, i } = parentOf(path);
        if (act === 'rm') { if (!confirm('Eliminare?')) return; arr.splice(i, 1); }
        else { const j = act === 'mv-up' ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
        S.dirty = true; break;
      }
      case 'bd-new': { const x = await call('POST', `/api/admin/${t.dataset.kind}`, {}); S[t.dataset.kind].unshift(x); break; }
      case 'bd-save': {
        const x = S[t.dataset.kind].find((y) => y.id === t.dataset.id);
        const { _dirty, ...clean } = x;
        Object.assign(x, await call('PUT', `/api/admin/${t.dataset.kind}/${x.id}`, clean)); delete x._dirty;
        toast('Salvato'); break;
      }
      case 'bd-del': if (!confirm('Eliminare?')) return; await call('DELETE', `/api/admin/${t.dataset.kind}/${t.dataset.id}`); S[t.dataset.kind] = S[t.dataset.kind].filter((y) => y.id !== t.dataset.id); break;
      case 'u-del': if (!confirm('Eliminare questo membro e tutti i suoi dati (foto comprese)?')) return; await call('DELETE', `/api/admin/users/${t.dataset.id}`); S.users = S.users.filter((y) => y.id !== t.dataset.id); break;
      case 'ex-unvideobox': { const x = S.exercises.find((y) => y.id === S.exId); x.videoBox = ''; await call('PUT', `/api/admin/exercises/${x.id}`, x); toast('Video 4:5 tolto'); break; }
      case 'ex-unvideo': { const x = S.exercises.find((y) => y.id === S.exId); x.video = ''; await call('PUT', `/api/admin/exercises/${x.id}`, x); toast('Video tolto'); break; }
      case 'ex-back': S.exId = null; render(); return window.scrollTo(0, 0);
      case 'p-back':
        if (S.dirty && !confirm('Ci sono modifiche non salvate. Tornare all\'elenco?')) return;
        S.progId = null; S.draft = null; S.dirty = false; render(); return window.scrollTo(0, 0);
      case 'u-open': S.openU[t.dataset.id] = !S.openU[t.dataset.id]; break;
      case 'revoke': {
        const u = S.users.find((y) => y.id === t.dataset.id);
        if (!confirm(`Revocare l'accesso a ${u.name}?`)) return;
        Object.assign(u, await call('POST', `/api/admin/users/${u.id}/access`, { revoke: true })); toast('Accesso revocato'); break;
      }
      case 'nut-free': {
        const u = S.users.find((y) => y.id === t.dataset.id);
        u.nutrition = await call('PUT', `/api/admin/users/${u.id}/nutrition`, { byCoach: false, note: u.nutrition.note }); toast('Ora sceglie il membro'); break;
      }
      case 'pend-del': await call('DELETE', `/api/admin/pending/${encodeURIComponent(t.dataset.email)}`); delete S.pending[t.dataset.email]; break;
      case 'staff-del': if (!confirm('Rimuovere questo delegato?')) return; await call('DELETE', `/api/admin/staff/${t.dataset.id}`); S.staff = S.staff.filter((y) => y.id !== t.dataset.id); break;
      case 'mod-del': if (!confirm('Eliminare il messaggio per tutti?')) return; await call('DELETE', `/api/admin/moderation/messages/${t.dataset.id}`); S.mod = await call('GET', '/api/admin/moderation'); toast('Messaggio eliminato'); break;
      case 'mod-ignore': await call('DELETE', `/api/admin/moderation/reports/${t.dataset.id}`); S.mod = await call('GET', '/api/admin/moderation'); break;
      case 'mod-ban': {
        const ban = t.dataset.ban === '1';
        if (ban && !confirm('Escludere questo membro dalla community?')) return;
        await call('POST', `/api/admin/moderation/ban/${t.dataset.id}`, { banned: ban }); S.mod = await call('GET', '/api/admin/moderation');
        toast(ban ? 'Escluso dalla community' : 'Riammesso'); break;
      }
      case 'logout': localStorage.removeItem('adminKey'); localStorage.removeItem('staffToken'); KEY = ''; TOKEN = ''; return start();
      case 'set-save': S.settings = await call('PUT', '/api/admin/settings', S.settings); toast('Impostazioni salvate'); break;
      default: return;
    }
    softRender();
  } catch (err) { toast(err.message, true); }
});

root.addEventListener('submit', async (e) => {
  const f = e.target;
  e.preventDefault();
  try {
    if (f.id === 'bulkf') {
      const r = await call('POST', '/api/admin/pending/bulk', { emails: f.emails.value, months: Number(f.months.value) });
      toast(`${r.total} email: ${r.activated} già iscritti attivati, ${r.pending} pre-attivati`);
      [S.users, S.pending] = await Promise.all([call('GET', '/api/admin/users'), call('GET', '/api/admin/pending')]);
    } else if (f.id === 'pendf') {
      const r = await call('POST', '/api/admin/pending', { email: f.email.value, months: Number(f.months.value) });
      if (r.applied) { toast(`${r.user} era già iscritto: attivo fino al ${fmtDate(r.accessUntil)}`); S.users = await call('GET', '/api/admin/users'); }
      else { toast('Email pre-attivata'); S.pending = await call('GET', '/api/admin/pending'); }
    } else if (f.classList.contains('nutf')) {
      const u = S.users.find((y) => y.id === f.dataset.id);
      const body = { byCoach: true, kcal: f.kcal.value, p: Number(f.p.value), c: Number(f.c.value), f: Number(f.f.value), note: f.note.value };
      u.nutrition = await call('PUT', `/api/admin/users/${u.id}/nutrition`, body);
      toast('Nutrizione impostata');
    } else if (f.id === 'stf') {
      S.staff.push(await call('POST', '/api/admin/staff', { name: f.name.value, email: f.email.value, password: f.password.value }));
      toast('Delegato creato');
    } else return;
    softRender();
  } catch (err) { toast(err.message, true); }
});

window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

start();
