import { BLOCK_TYPES, PHASE_TYPES, blockSummary, estimateSeconds } from './engine.js';

const root = document.getElementById('admin');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)) || ''; } catch { return ''; } };
let KEY = lsGet('adminKey');      // proprietario
let TOKEN = lsGet('staffToken');  // delegato
const authHeaders = () => (KEY ? { 'x-admin-key': KEY } : TOKEN ? { 'x-staff-token': TOKEN } : {});

const S = { role: 'owner', me: '', staff: [], pending: {}, uq: '', uf: 'all', openU: {}, tab: 'programs', exercises: [], programs: [], tips: [], challenges: [], users: [], settings: {}, exId: null, progId: null, draft: null, openWk: {}, dirty: false };

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
function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    x.open('POST', '/api/admin/upload');
    for (const [k, v] of Object.entries(authHeaders())) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status < 300 ? resolve(JSON.parse(x.responseText).url) : reject(new Error(JSON.parse(x.responseText || '{}').error || 'Upload fallito')));
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
    [S.exercises, S.programs, S.tips, S.challenges, S.users, S.pending, S.staff, S.settings] = await Promise.all(['exercises', 'programs', 'tips', 'challenges', 'users', 'pending', 'staff'].map((x) => call('GET', `/api/admin/${x}`)).concat(settings));
  } else {
    [S.users, S.pending, S.settings] = await Promise.all([call('GET', '/api/admin/users'), call('GET', '/api/admin/pending'), settings]);
    S.tab = 'users';
  }
  render();
}

const exName = (id) => S.exercises.find((e) => e.id === id)?.name || '—';
const exOptions = (sel, empty = '— scegli —') => `<option value="">${empty}</option>` + S.exercises.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('');

function render() {
  root.innerHTML = `<div class="adm">
    <header><div class="h1">${esc(S.settings.appName || 'Admin')} <em style="color:var(--accent);font-style:normal">admin</em></div>
      <div class="tabs">${(S.role === 'owner' ? [['programs', 'Programmi'], ['exercises', 'Esercizi & video'], ['board', 'Bacheca'], ['users', 'Membri'], ['staff', 'Staff'], ['settings', 'Impostazioni']] : [['users', 'Membri']]).map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="muted small">${esc(S.me)}</span><button class="sbtn" data-act="logout">Esci</button>${S.role === 'owner' ? '<a class="sbtn" href="/" target="_blank">Apri app ↗</a>' : ''}</header>
    ${({ exercises: exercisesView, board: boardView, users: usersView, staff: staffView, settings: settingsView }[S.tab] || programsView)()}
  </div>`;
}

// ---- esercizi ---------------------------------------------------------------
function exercisesView() {
  const e = S.exercises.find((x) => x.id === S.exId);
  return `<div class="cols ${e ? 'has-sel' : ''}">
    <div class="side"><button class="btn primary add" data-act="ex-new">+ Nuovo esercizio</button>
      ${S.exercises.map((x) => `<button class="it ${x.id === S.exId ? 'on' : ''}" data-ex="${x.id}">
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
          <div class="muted small">Consigliato: verticale 4:5 o 9:16, 5–10 s, MP4 (H.264), senza audio.</div></div></div></div>
      <div class="grid2"><div class="f"><label>Ripetizioni nel video demo</label><input type="number" min="0" step="1" data-exf="repsInVideo" value="${esc(e.repsInVideo)}" placeholder="es. 7"></div>
        <div class="f"><label>Secondi per ripetizione</label><input type="number" min="0" step="0.1" data-exf="secPerRep" id="spr" value="${esc(e.secPerRep)}" placeholder="es. 1 per lo swing"></div></div>
      <div class="muted small" style="margin:-4px 0 12px">Serve al giro guidato di AMRAP e AFAP: 50 swing a 1 s = 50 s, poi passa da solo all'esercizio dopo. Se scrivi quante ripetizioni ci sono nel video, il ritmo lo calcolo io dalla durata del video.</div>
      <div class="grid2"><div class="f"><label>Variante più facile</label><select data-exf="easierId">${exOptions(e.easierId, '— nessuna —')}</select></div>
      <div class="f"><label>Variante più difficile</label><select data-exf="harderId">${exOptions(e.harderId, '— nessuna —')}</select></div></div>
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
        <div class="f"><label>Immagine (opzionale)</label><input type="file" accept="image/*" data-upload="tip:${x.id}">${x.image ? `<img src="${esc(x.image)}" style="width:160px;border-radius:10px;margin-top:6px">` : ''}</div>
        <div class="grid2">${dates('tips', x)}</div>${foot('tips', x)}</div>`).join('') || '<div class="muted">Nessun consiglio.</div>'}</div>
  </div>`;
}

const fmtDate = (d) => (d ? new Date(d + (d.length === 10 ? 'T12:00' : '')).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const daysLeft = (u) => (u.accessUntil ? Math.ceil((new Date(u.accessUntil + 'T23:59').getTime() - Date.now()) / 864e5) : null);
function userStatus(u) {
  const d = daysLeft(u);
  if (!u.accessUntil) return ['pending', 'In attesa'];
  if (d < 0 || !u.active) return ['expired', 'Scaduto'];
  if (d <= 7) return ['soon', `Scade tra ${d} g`];
  return ['ok', 'Attivo'];
}
function usersView() {
  const q = S.uq.toLowerCase();
  const counts = { all: S.users.length };
  for (const u of S.users) { const k = userStatus(u)[0]; counts[k] = (counts[k] || 0) + 1; }
  const list = S.users.filter((u) => (S.uf === 'all' || userStatus(u)[0] === S.uf) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)))
    .sort((a, b) => (a.accessUntil || '').localeCompare(b.accessUntil || ''));
  const filters = [['all', 'Tutti'], ['pending', 'In attesa'], ['soon', 'In scadenza'], ['expired', 'Scaduti'], ['ok', 'Attivi']];
  const pend = Object.entries(S.pending);
  return `<div class="cols two">
    <div class="panel">
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><input type="text" id="uq" placeholder="Cerca nome o email (es. quella del pagamento Stripe)" value="${esc(S.uq)}" style="flex:1;min-width:220px">
        ${filters.map(([k, l]) => `<button class="sbtn ${S.uf === k ? 'acc' : ''}" data-uf="${k}">${l} ${counts[k] || 0}</button>`).join('')}</div>
      ${list.map((u) => { const [st, label] = userStatus(u); const open = S.openU[u.id]; return `<div class="urow">
        <div class="uhead"><div style="flex:1;min-width:180px"><b>${esc(u.name)}</b><div class="muted small">${esc(u.email)} · iscritto ${fmtDate(u.joined)} · ${u.workouts} allenamenti</div></div>
          <span class="st ${st}">${label}${u.accessUntil ? ` · ${fmtDate(u.accessUntil)}` : ''}</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><span class="muted small">Aggiungi accesso:</span>
          ${[1, 3, 6, 12].map((m) => `<button class="sbtn acc" data-grant="${m}" data-id="${u.id}">+${m === 12 ? '1 anno' : m + (m === 1 ? ' mese' : ' mesi')}</button>`).join('')}
          ${u.accessUntil ? `<button class="sbtn ghost danger" data-act="revoke" data-id="${u.id}">Revoca</button>` : ''}
          <button class="sbtn" data-act="u-open" data-id="${u.id}">${open ? 'Chiudi' : 'Nutrizione & storico'}</button>
          ${S.role === 'owner' ? `<button class="sbtn ghost danger" data-act="u-del" data-id="${u.id}">Elimina</button>` : ''}</div>
        ${open ? userDetail(u) : ''}</div>`; }).join('') || '<div class="muted">Nessun membro trovato.</div>'}
    </div>
    <div class="panel"><div class="h2" style="margin-top:0">Pre-attiva un'email</div>
      <div class="muted small" style="margin-bottom:10px">Pagamento arrivato ma la persona non si è ancora iscritta all'app? Attiva la sua email: quando si iscrive con quella email trova già l'accesso.</div>
      <form id="pendf" class="f"><input type="text" name="email" placeholder="email@cliente.it"><select name="months"><option value="1">1 mese</option><option value="3">3 mesi</option><option value="6">6 mesi</option><option value="12">1 anno</option></select><button class="btn primary">Attiva</button></form>
      ${pend.length ? `<div class="lbl2" style="margin-top:12px">In attesa di iscrizione</div>${pend.map(([em, g]) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><div><b class="small">${esc(em)}</b><div class="muted small">${g.months} ${g.months === 1 ? 'mese' : 'mesi'} · da ${esc(g.by)} · ${fmtDate(g.date)}</div></div><button class="sbtn ghost danger" data-act="pend-del" data-email="${esc(em)}">✕</button></div>`).join('')}` : ''}
    </div></div>`;
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
    <div class="f"><label>Link al sito per comprare l'abbonamento</label><input type="text" data-set="shopUrl" value="${esc(st.shopUrl)}" placeholder="https://tuosito.it/abbonamento"></div>
    <div class="f"><label>Email di assistenza</label><input type="text" data-set="supportEmail" value="${esc(st.supportEmail)}"></div>
    <div class="f"><label>Logo (PNG trasparente, versione bianca per sfondo scuro)</label><input type="file" accept="image/*" data-upload="logo">
      ${st.logo ? `<div style="background:#0c0c0e;padding:16px;border-radius:12px;margin-top:8px"><img src="${esc(st.logo)}" style="height:48px"></div>` : ''}</div>
    <div class="savebar"><button class="btn primary" data-act="set-save">Salva impostazioni</button></div></div>`;
}

// ---- programmi --------------------------------------------------------------
function programsView() {
  const p = S.draft;
  return `<div class="cols ${p ? 'has-sel' : ''}">
    <div class="side"><button class="btn primary add" data-act="p-new">+ Nuovo programma</button>
      ${S.programs.map((x) => `<button class="it ${x.id === S.progId ? 'on' : ''}" data-prog="${x.id}"><div><div style="font-weight:800">${esc(x.title)}</div>
        <div class="meta">${x.published ? '● Pubblicato' : '○ Bozza'} · ${x.kind === 'cycle' ? `ciclo dal ${esc(x.startDate || '?')}` : 'base'} · ${(x.workouts || []).length} allenamenti</div></div></button>`).join('') || '<div class="muted small" style="padding:8px">Nessun programma ancora.</div>'}
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
      ${p.kind === 'cycle' ? `<div class="f"><label>Inizio del ciclo</label><input type="date" data-b="startDate" value="${esc(p.startDate)}"></div>` : ''}
      <div class="f"><label>Copertina</label><input type="file" accept="image/*" data-upload="cover">${p.cover ? `<img src="${esc(p.cover)}" style="width:100%;border-radius:10px;margin-top:6px">` : ''}</div></div>
    <div class="f"><label>Descrizione</label><textarea data-b="description">${esc(p.description)}</textarea></div>
    <label class="chk"><input type="checkbox" data-b="published" ${p.published ? 'checked' : ''}> Pubblicato (visibile agli utenti)</label>
    <div class="h2" style="margin-top:22px">Allenamenti</div>
    ${(p.workouts || []).map((w, wi) => workoutEditor(w, wi)).join('')}
    <button class="sbtn acc" data-act="w-add">+ Aggiungi allenamento</button>
    <div class="savebar"><button class="sbtn danger" data-act="p-del">Elimina programma</button><button class="btn primary" data-act="p-save">${S.dirty ? '● ' : ''}Salva programma</button></div>`;
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
    emom: num(P, 'minutes', b.minutes, 'Minuti totali') + num(P, 'every', b.every, 'Ogni (secondi)', '60'),
    amrap: num(P, 'cap', b.cap, 'Durata (minuti)'),
    fortime: num(P, 'rounds', b.rounds, 'Round') + num(P, 'cap', b.cap, 'Time cap (min, opz.)'),
    intervals: num(P, 'rounds', b.rounds, 'Round') + num(P, 'work', b.work, 'Lavoro (s)') + num(P, 'rest', b.rest, 'Recupero (s)') + num(P, 'restRounds', b.restRounds, 'Recupero tra round (s)'),
    sets: num(P, 'rounds', b.rounds, 'Serie') + num(P, 'rest', b.rest, 'Recupero (s)'),
  }[b.type];
  const thirdCol = b.type === 'intervals' ? 'Lavoro (s) opz.' : b.type === 'emom' ? 'Stesso minuto' : '';
  return `<div class="block"><div class="bhd"><b>${esc(BLOCK_TYPES[b.type])}</b><span class="muted small">${esc(blockSummary(b))}</span><span style="flex:1"></span>${mover(P)}</div>
    <div class="grid2"><div class="f"><label>Titolo blocco</label><input type="text" data-b="${P}.title" value="${esc(b.title)}"></div>${params}</div>
    <div class="f"><label>Note</label><input type="text" data-b="${P}.notes" value="${esc(b.notes)}" placeholder="es. Usa un peso che ti permetta tecnica perfetta"></div>
    <div class="items"><div class="irow ihdr"><span>Esercizio</span><span>Reps / tempo</span><span>${thirdCol}</span><span>Note</span><span></span></div>
      ${(b.items || []).map((it, ii) => `<div class="irow">
        <select data-b="${P}.items.${ii}.exerciseId">${exOptions(it.exerciseId)}</select>
        <input type="text" data-b="${P}.items.${ii}.reps" value="${esc(it.reps)}" placeholder="es. 10 o 8-12">
        ${b.type === 'intervals' ? `<input type="number" min="0" data-b="${P}.items.${ii}.time" value="${esc(it.time ?? '')}" placeholder="${esc(b.work || '')}">`
          : b.type === 'emom' ? `<label class="chk" title="Esegui nello stesso minuto dell'esercizio sopra"><input type="checkbox" data-b="${P}.items.${ii}.samePrev" ${it.samePrev ? 'checked' : ''} ${ii === 0 ? 'disabled' : ''}> con sopra</label>` : '<span></span>'}
        <input type="text" data-b="${P}.items.${ii}.notes" value="${esc(it.notes)}" placeholder="opzionale">
        <span class="acts">${mover(`${P}.items.${ii}`)}</span></div>`).join('')}
    </div>
    <button class="sbtn" style="margin-top:8px" data-act="i-add" data-path="${P}">+ Esercizio</button></div>`;
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
    if (t.tagName === 'SELECT' || t.type === 'checkbox' || /\.(minutes|every|cap|rounds|work|rest|restRounds|week)$/.test(t.dataset.b)) softRender();
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
  if (t.dataset.set) S.settings[t.dataset.set] = t.value;
  if (t.id === 'uq') { S.uq = t.value; softRender(); document.getElementById('uq')?.focus(); }
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
  if (!t.dataset.upload || !t.files[0]) return;
  const bar = document.getElementById('upbar');
  try {
    const url = await uploadFile(t.files[0], (f) => bar && (bar.style.width = `${f * 100}%`));
    if (t.dataset.upload === 'ex-video') {
      const ex = S.exercises.find((x) => x.id === S.exId);
      ex.video = url;
      await call('PUT', `/api/admin/exercises/${ex.id}`, ex);
      toast('Video caricato');
    } else if (t.dataset.upload === 'logo') {
      S.settings.logo = url;
      toast('Logo caricato · ricordati di salvare');
    } else if (t.dataset.upload.startsWith('tip:')) {
      const x = S.tips.find((y) => y.id === t.dataset.upload.slice(4));
      x.image = url; x._dirty = true;
    } else if (t.dataset.upload === 'cover') {
      S.draft.cover = url; S.dirty = true;
      toast('Copertina caricata · ricordati di salvare');
    }
    render();
  } catch (err) { toast(err.message, true); }
});

root.addEventListener('click', async (e) => {
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
    if (t.dataset.tab) { S.tab = t.dataset.tab; return render(); }
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
      case 'ex-save': { const x = S.exercises.find((y) => y.id === S.exId); await call('PUT', `/api/admin/exercises/${x.id}`, x); toast('Esercizio salvato'); break; }
      case 'ex-del': if (!confirm('Eliminare questo esercizio?')) return; await call('DELETE', `/api/admin/exercises/${S.exId}`); S.exercises = await call('GET', '/api/admin/exercises'); S.exId = null; break;
      case 'p-new': { const x = await call('POST', '/api/admin/programs', {}); S.programs.push(x); S.progId = x.id; S.draft = structuredClone(x); S.dirty = false; render(); window.scrollTo(0, 0); return; }
      case 'p-save': { const x = await call('PUT', `/api/admin/programs/${S.draft.id}`, S.draft); S.programs = S.programs.map((y) => (y.id === x.id ? x : y)); S.dirty = false; toast('Programma salvato'); break; }
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
        const defaults = { emom: { minutes: 10, every: 60 }, amrap: { cap: 12 }, fortime: { rounds: 3, cap: 0 }, intervals: { rounds: 3, work: 40, rest: 20, restRounds: 60 }, sets: { rounds: 3, rest: 60 } }[t.dataset.type];
        getPath(S.draft, path).blocks.push({ id: uid(), type: t.dataset.type, title: '', notes: '', items: [], ...defaults }); S.dirty = true; break;
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
    if (f.id === 'pendf') {
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
