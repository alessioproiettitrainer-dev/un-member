// Server dell'app: account membri, programmi, bacheca (tips e challenge), progressi privati, API admin.
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cambiami';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS = path.join(DATA_DIR, 'uploads'); // dentro data/: su un server basta salvare una cartella
const PRIVATE = path.join(DATA_DIR, 'private'); // foto progressi: mai servite in pubblico

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(PRIVATE, { recursive: true });

// ---- storage: un file JSON, scritto in modo atomico ------------------------
const EMPTY = {
  settings: { appName: 'UN-MEMBER', logo: '', tagline: 'Allenati ovunque.', shopUrl: '', supportEmail: '', communityRules: 'Rispetto per tutti. Niente spam, pubblicità o contenuti offensivi. Chi non rispetta le regole viene escluso dalla community.' },
  exercises: [], programs: [], tips: [], challenges: [], tutorials: [], users: [], sessions: {}, staff: [], staffSessions: {}, pendingGrants: {},
  messages: [], reports: [],
};
function load() {
  const d = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
  return { ...structuredClone(EMPTY), ...d, settings: { ...EMPTY.settings, ...(d.settings || {}) } };
}
let db = load();
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
const newId = () => crypto.randomBytes(6).toString('hex');
const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (iso, m) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
const hasAccess = (u) => !!u.accessUntil && u.accessUntil >= today();
// L'accesso si somma: se è ancora attivo, i mesi partono dalla scadenza attuale.
function grant(u, months, by) {
  const from = hasAccess(u) ? u.accessUntil : today();
  u.accessUntil = addMonths(from, months);
  (u.accessLog ||= []).push({ date: new Date().toISOString(), months, by, until: u.accessUntil });
}
const DEFAULT_NUTRITION = { kcal: '', p: 30, c: 40, f: 30, by: 'user', note: '' };

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- sessioni membri (cookie httpOnly) -------------------------------------
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((x) => x[0]));
}
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function startSession(res, userId) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = { userId, created: Date.now() };
  save();
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`);
}
const isAdmin = (req) => req.get('x-admin-key') === ADMIN_KEY;
const staffOf = (req) => { const s = db.staffSessions[req.get('x-staff-token') || '']; return s && db.staff.find((x) => x.id === s.staffId); };
function currentUser(req) {
  const s = db.sessions[cookies(req).sid];
  return s && db.users.find((u) => u.id === s.userId);
}
function member(req, res, next) {
  req.user = currentUser(req);
  if (req.user || isAdmin(req)) return next();
  res.status(401).json({ error: 'Accedi per continuare' });
}
const publicUser = (u) => {
  const { password, accessLog, ...rest } = u;
  const c = u.community || {};
  return { ...rest, nutrition: { ...DEFAULT_NUTRITION, ...(u.nutrition || {}) }, active: hasAccess(u),
    community: { joined: !!c.joined, bio: c.bio || '', avatar: c.avatar ? `/api/avatars/${c.avatar}` : '', blocked: c.blocked || [], banned: !!c.banned } };
};
// Contenuti riservati a chi ha l'abbonamento attivo (l'admin passa sempre).
function active(req, res, next) {
  if (isAdmin(req) || (req.user && hasAccess(req.user))) return next();
  res.status(402).json({ error: 'Abbonamento non attivo', inactive: true });
}

// ---- auth -------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  const em = String(email).trim().toLowerCase();
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(em)) return res.status(400).json({ error: 'Inserisci nome ed email validi' });
  if (String(password).length < 6) return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
  if (db.users.some((u) => u.email === em)) return res.status(409).json({ error: 'Esiste già un account con questa email' });
  const u = {
    id: newId(), name: name.trim(), email: em, password: hashPassword(password), joined: today(),
    profile: { sex: '', birthYear: '', heightCm: '', activity: 1.375, goal: 'maintain', trainingDays: [1, 3, 5], kcalTarget: '' },
    history: [], challengeLogs: {}, weights: [], food: [], photos: [], activeProgramId: '',
    accessUntil: '', accessLog: [], nutrition: { ...DEFAULT_NUTRITION },
  };
  const pending = db.pendingGrants[em];
  if (pending) { grant(u, pending.months, `${pending.by} (pre-attivazione)`); delete db.pendingGrants[em]; }
  db.users.push(u);
  startSession(res, u.id);
  res.json(publicUser(u));
});
app.post('/api/auth/login', (req, res) => {
  const u = db.users.find((x) => x.email === String(req.body?.email || '').trim().toLowerCase());
  if (!u || !checkPassword(String(req.body?.password || ''), u.password)) return res.status(401).json({ error: 'Email o password sbagliate' });
  startSession(res, u.id);
  res.json(publicUser(u));
});
app.post('/api/auth/logout', (req, res) => {
  delete db.sessions[cookies(req).sid];
  save();
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---- contenuti per i membri -------------------------------------------------
app.get('/api/settings', (req, res) => res.json(db.settings));

const addWeeks = (d, w) => new Date(new Date(d).getTime() + w * 7 * 864e5).toISOString().slice(0, 10);
const summary = (p) => ({
  id: p.id, title: p.title, subtitle: p.subtitle, level: p.level, weeks: p.weeks, kind: p.kind || 'base',
  startDate: p.startDate || '', endDate: p.kind === 'cycle' && p.startDate ? addWeeks(p.startDate, Number(p.weeks) || 4) : '',
  description: p.description, cover: p.cover, workoutCount: (p.workouts || []).length,
});

app.get('/api/programs', member, active, (req, res) => {
  const t = today();
  // i cicli futuri restano nascosti finché non partono
  res.json(db.programs.filter((p) => p.published && !(p.kind === 'cycle' && p.startDate > t)).map(summary));
});

// Il programma arriva con tutti gli esercizi che usa (anche le varianti), così il player lavora offline.
app.get('/api/programs/:id', member, active, (req, res) => {
  const p = db.programs.find((x) => x.id === req.params.id);
  if (!p || (!p.published && !isAdmin(req))) return res.status(404).json({ error: 'Programma non trovato' });
  const byId = new Map(db.exercises.map((e) => [e.id, e]));
  const used = new Map();
  const add = (id) => {
    const e = byId.get(id);
    if (!e || used.has(id)) return;
    used.set(id, e);
    add(e.easierId);
    add(e.harderId);
  };
  for (const w of p.workouts || []) for (const ph of w.phases || []) for (const b of ph.blocks || []) for (const it of b.items || []) add(it.exerciseId);
  // tutorial collegati agli esercizi del programma, per il tasto "Tutorial" nel player
  const tutorials = {};
  for (const t of db.tutorials) if (t.published && t.exerciseId && used.has(t.exerciseId)) tutorials[t.exerciseId] = { id: t.id, title: t.title, videoUrl: t.videoUrl };
  res.json({ ...summary(p), ...p, exercises: Object.fromEntries(used), tutorials });
});

app.get('/api/tutorials', member, active, (req, res) => {
  const ex = new Map(db.exercises.map((e) => [e.id, e.name]));
  res.json(db.tutorials.filter((t) => t.published).map((t) => ({ ...t, exerciseName: ex.get(t.exerciseId) || '' })));
});

app.get('/api/board', member, active, (req, res) => {
  const t = today();
  const live = (x) => x.published && (!x.start || x.start <= t) && (!x.end || x.end >= t);
  res.json({ tips: db.tips.filter(live), challenges: db.challenges.filter(live) });
});

// ---- area personale -----------------------------------------------------------
const me = express.Router();
// L'admin senza account entra con un profilo temporaneo (non salvato) per provare le anteprime.
const previewUser = () => ({ id: 'admin-preview', name: 'Admin', email: '', joined: today(), profile: { trainingDays: [1, 3, 5], activity: 1.375, goal: 'maintain' }, history: [], challengeLogs: {}, weights: [], food: [], photos: [], activeProgramId: '', accessUntil: '2999-12-31', nutrition: { ...DEFAULT_NUTRITION } });
me.use((req, res, next) => {
  req.user = currentUser(req) || (isAdmin(req) ? previewUser() : null);
  if (!req.user) return res.status(401).json({ error: 'Accedi per continuare' });
  // l'anteprima admin serve solo a guardare: niente viene salvato
  if (req.user.id === 'admin-preview' && req.method !== 'GET') return res.status(403).json({ error: 'Sei in anteprima admin: per salvare iscriviti come membro (anche tu, con la tua email).' });
  next();
});
me.get('/', (req, res) => res.json(publicUser(req.user)));
me.put('/', (req, res) => {
  const u = req.user;
  if (typeof req.body.name === 'string' && req.body.name.trim()) u.name = req.body.name.trim();
  if (req.body.profile) u.profile = { ...u.profile, ...req.body.profile };
  if (typeof req.body.activeProgramId === 'string') u.activeProgramId = req.body.activeProgramId;
  const n = req.body.nutrition;
  if (n && (u.nutrition?.by !== 'coach')) {
    const p = Number(n.p), c = Number(n.c), f = Number(n.f);
    if (p + c + f !== 100 || [p, c, f].some((x) => x < 0)) return res.status(400).json({ error: 'Le percentuali devono fare 100' });
    u.nutrition = { ...DEFAULT_NUTRITION, ...u.nutrition, p, c, f, kcal: n.kcal ?? u.nutrition?.kcal ?? '', by: 'user' };
  }
  save();
  res.json(publicUser(u));
});
me.post('/workouts', (req, res) => {
  const { programId, programTitle, workoutId, workoutTitle, seconds, results, scores } = req.body || {};
  const clean = (Array.isArray(scores) ? scores : []).slice(0, 20).map((x) => (x.type === 'amrap'
    ? { key: String(x.key), block: String(x.block || ''), type: 'amrap', rounds: Math.max(0, Math.round(+x.rounds || 0)), reps: Math.max(0, Math.round(+x.reps || 0)) }
    : { key: String(x.key), block: String(x.block || ''), type: 'fortime', seconds: Math.max(0, Math.round(+x.seconds || 0)), capped: !!x.capped }));
  const h = { id: newId(), programId, programTitle, workoutId, workoutTitle, seconds: Number(seconds) || 0, results: results || {}, scores: clean, date: new Date().toISOString() };
  req.user.history.push(h);
  save();
  res.json(h);
});
me.put('/challenge/:cid', (req, res) => {
  const { date = today(), value = 0 } = req.body || {};
  const logs = (req.user.challengeLogs[req.params.cid] ||= {});
  if (Number(value) > 0) logs[date] = Number(value); else delete logs[date];
  save();
  res.json(logs);
});
me.put('/weight', (req, res) => {
  const { date = today(), kg } = req.body || {};
  req.user.weights = req.user.weights.filter((w) => w.date !== date);
  if (Number(kg) > 0) req.user.weights.push({ date, kg: Number(kg) });
  req.user.weights.sort((a, b) => a.date.localeCompare(b.date));
  save();
  res.json(req.user.weights);
});
me.post('/food', (req, res) => {
  const { date = today(), name = '', kcal = 0, protein = 0, carbs = 0, fat = 0, meal = '' } = req.body || {};
  if (!String(name).trim()) return res.status(400).json({ error: 'Scrivi cosa hai mangiato' });
  const g = (x) => Math.round(Number(x) || 0);
  // se mancano le kcal ma ci sono i macro, le calcolo (4/4/9 kcal per grammo)
  const k = g(kcal) || g(protein) * 4 + g(carbs) * 4 + g(fat) * 9;
  const f = { id: newId(), date, name: String(name).trim(), kcal: k, protein: g(protein), carbs: g(carbs), fat: g(fat), meal };
  req.user.food.push(f);
  save();
  res.json(f);
});
me.delete('/food/:id', (req, res) => {
  req.user.food = req.user.food.filter((f) => f.id !== req.params.id);
  save();
  res.json({ ok: true });
});

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(PRIVATE, req.user.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, newId() + (path.extname(file.originalname).toLowerCase() || '.jpg')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
me.post('/photos', photoUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica una foto' });
  const p = { id: newId(), file: req.file.filename, date: req.body.date || today(), kind: req.body.kind || 'progress' };
  req.user.photos.push(p);
  save();
  res.json(p);
});
me.get('/photos/:file', (req, res) => {
  const p = req.user.photos.find((x) => x.file === req.params.file);
  if (!p) return res.status(404).end();
  res.sendFile(path.join(PRIVATE, req.user.id, p.file));
});
me.delete('/photos/:id', (req, res) => {
  const p = req.user.photos.find((x) => x.id === req.params.id);
  if (p) fs.rm(path.join(PRIVATE, req.user.id, p.file), () => {});
  req.user.photos = req.user.photos.filter((x) => x.id !== req.params.id);
  save();
  res.json({ ok: true });
});
// ---- community: profilo, chat di gruppo, messaggi privati ------------------------
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(DATA_DIR, 'avatars'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, newId() + (path.extname(file.originalname).toLowerCase() || '.jpg')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
me.put('/community', (req, res) => {
  const u = req.user, c = (u.community ||= { joined: false, bio: '', avatar: '', blocked: [] });
  if (typeof req.body.bio === 'string') c.bio = req.body.bio.trim().slice(0, 200);
  if (typeof req.body.joined === 'boolean') c.joined = req.body.joined;
  save();
  res.json(publicUser(u));
});
me.post('/avatar', avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica una foto' });
  const c = (req.user.community ||= { joined: false, bio: '', avatar: '', blocked: [] });
  if (c.avatar) fs.rm(path.join(DATA_DIR, 'avatars', c.avatar), () => {});
  c.avatar = req.file.filename;
  save();
  res.json(publicUser(req.user));
});
me.post('/block/:id', (req, res) => {
  const c = (req.user.community ||= { joined: false, bio: '', avatar: '', blocked: [] });
  const b = new Set(c.blocked || []);
  b.has(req.params.id) ? b.delete(req.params.id) : b.add(req.params.id);
  c.blocked = [...b];
  save();
  res.json({ blocked: c.blocked });
});

const inCommunity = (u) => u && u.community?.joined && !u.community?.banned;
const card = (u) => ({ id: u.id, name: u.name, bio: u.community?.bio || '', avatar: u.community?.avatar ? `/api/avatars/${u.community.avatar}` : '', since: u.joined, workouts: u.history.length });
const dmKey = (a, b) => `dm:${[a, b].sort().join(':')}`;
const blockedBy = (u, otherId) => (u.community?.blocked || []).includes(otherId);
function community(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Accedi per continuare' });
  if (!hasAccess(req.user)) return res.status(402).json({ error: 'Abbonamento non attivo', inactive: true });
  if (req.user.community?.banned) return res.status(403).json({ error: 'Sei stato escluso dalla community' });
  if (!inCommunity(req.user)) return res.status(409).json({ error: 'Entra prima nella community', notJoined: true });
  next();
}
const cm = express.Router();
cm.use((req, res, next) => { req.user = currentUser(req); next(); }, community);
app.get('/api/avatars/:file', (req, res) => {
  if (!currentUser(req) && !isAdmin(req) && !staffOf(req)) return res.status(401).end();
  res.sendFile(path.join(DATA_DIR, 'avatars', path.basename(req.params.file)));
});
cm.get('/members', (req, res) => res.json(db.users.filter((u) => inCommunity(u) && hasAccess(u)).map(card)));
cm.get('/members/:id', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id && inCommunity(x));
  if (!u) return res.status(404).json({ error: 'Membro non trovato' });
  res.json({ ...card(u), blocked: blockedBy(req.user, u.id) });
});
// room: "general" oppure "dm-<idAltro>"
function resolveRoom(req, res) {
  const r = req.params.room;
  if (r === 'general') return { key: 'general' };
  const other = r.startsWith('dm-') && db.users.find((x) => x.id === r.slice(3));
  if (!other || other.id === req.user.id || !inCommunity(other)) { res.status(404).json({ error: 'Chat non trovata' }); return null; }
  return { key: dmKey(req.user.id, other.id), other };
}
const msgOut = (m) => { const u = db.users.find((x) => x.id === m.from); return { id: m.id, ts: m.ts, text: m.deleted ? '' : m.text, deleted: !!m.deleted, from: m.from, name: u?.name || 'Ex membro', avatar: u?.community?.avatar ? `/api/avatars/${u.community.avatar}` : '' }; };
cm.get('/rooms', (req, res) => {
  const me_ = req.user.id, lr = req.user.lastRead || {};
  const rooms = new Map([['general', { room: 'general', title: 'Chat di gruppo', last: null, unread: 0 }]]);
  for (const m of db.messages) {
    let key;
    if (m.room === 'general') key = 'general';
    else if (m.room.startsWith('dm:') && m.room.split(':').includes(me_)) {
      const otherId = m.room.split(':').slice(1).find((x) => x !== me_);
      if (blockedBy(req.user, otherId)) continue;
      key = `dm-${otherId}`;
      if (!rooms.has(key)) { const o = db.users.find((x) => x.id === otherId); rooms.set(key, { room: key, title: o?.name || 'Ex membro', avatar: o?.community?.avatar ? `/api/avatars/${o.community.avatar}` : '', last: null, unread: 0 }); }
    } else continue;
    const r = rooms.get(key);
    r.last = { text: m.deleted ? 'Messaggio eliminato' : m.text.slice(0, 80), ts: m.ts, mine: m.from === me_ };
    if (m.from !== me_ && m.ts > (lr[key] || 0) && !(key === 'general' && blockedBy(req.user, m.from))) r.unread++;
  }
  res.json([...rooms.values()].sort((a, b) => (a.room === 'general' ? -1 : b.room === 'general' ? 1 : (b.last?.ts || 0) - (a.last?.ts || 0))));
});
cm.get('/chat/:room', (req, res) => {
  const r = resolveRoom(req, res);
  if (!r) return;
  const after = Number(req.query.after) || 0;
  const list = db.messages.filter((m) => m.room === r.key && m.ts > after && !blockedBy(req.user, m.from)).slice(-200).map(msgOut);
  (req.user.lastRead ||= {})[req.params.room] = Date.now();
  res.json({ messages: list, other: r.other ? card(r.other) : null, blocked: r.other ? blockedBy(req.user, r.other.id) : false });
});
cm.post('/chat/:room', (req, res) => {
  const r = resolveRoom(req, res);
  if (!r) return;
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Scrivi un messaggio' });
  if (r.other && (blockedBy(r.other, req.user.id) || blockedBy(req.user, r.other.id))) return res.status(403).json({ error: 'Non puoi scrivere a questo membro' });
  const last = db.messages.findLast?.((m) => m.from === req.user.id);
  if (last && Date.now() - last.ts < 1000) return res.status(429).json({ error: 'Piano, un messaggio alla volta' });
  const m = { id: newId(), room: r.key, from: req.user.id, text, ts: Date.now() };
  db.messages.push(m);
  if (db.messages.length > 20000) db.messages.splice(0, db.messages.length - 20000);
  (req.user.lastRead ||= {})[req.params.room] = m.ts;
  save();
  res.json(msgOut(m));
});
cm.post('/report/:id', (req, res) => {
  const m = db.messages.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).end();
  if (!db.reports.some((x) => x.messageId === m.id && x.by === req.user.id)) db.reports.push({ id: newId(), messageId: m.id, by: req.user.id, reason: String(req.body?.reason || '').slice(0, 200), ts: Date.now() });
  save();
  res.json({ ok: true });
});
cm.get('/unread', (req, res) => {
  const lr = req.user.lastRead || {}, me_ = req.user.id;
  let n = 0;
  for (const m of db.messages) {
    if (m.from === me_ || blockedBy(req.user, m.from)) continue;
    if (m.room.startsWith('dm:') && m.room.split(':').includes(me_) && m.ts > (lr[`dm-${m.from}`] || 0)) n++;
  }
  res.json({ dm: n });
});
app.use('/api/community', cm);

app.use('/api/me', me);

// ---- API admin -------------------------------------------------------------
// Login staff (delegati): email + password, ricevono un token per il pannello.
app.post('/api/admin/login', (req, res) => {
  const st = db.staff.find((x) => x.email === String(req.body?.email || '').trim().toLowerCase());
  if (!st || !checkPassword(String(req.body?.password || ''), st.password)) return res.status(401).json({ error: 'Email o password sbagliate' });
  const token = crypto.randomBytes(24).toString('hex');
  db.staffSessions[token] = { staffId: st.id, created: Date.now() };
  save();
  res.json({ token, name: st.name, role: 'staff' });
});

const admin = express.Router();
// Proprietario (ADMIN_KEY): tutto. Staff: solo membri, accessi, pre-attivazioni e nutrizione.
const STAFF_PATHS = /^\/(ping|users|pending|moderation)(\/|$)/;
admin.use((req, res, next) => {
  if (isAdmin(req)) { req.who = 'Admin'; req.role = 'owner'; return next(); }
  const st = staffOf(req);
  if (!st) return res.status(401).json({ error: 'Accesso admin non valido' });
  if (!STAFF_PATHS.test(req.path)) return res.status(403).json({ error: 'Sezione riservata al proprietario' });
  req.who = st.name; req.role = 'staff';
  next();
});

admin.get('/ping', (req, res) => res.json({ ok: true, role: req.role, name: req.who }));
admin.put('/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  save();
  res.json(db.settings);
});

// CRUD generico per esercizi, programmi, tips e challenge
function crud(name, defaults, beforeDelete, afterSave) {
  admin.get(`/${name}`, (req, res) => res.json(db[name]));
  admin.post(`/${name}`, (req, res) => {
    const x = { ...defaults(), ...req.body, id: newId() };
    db[name].push(x);
    save();
    res.json(x);
  });
  admin.put(`/${name}/:id`, (req, res) => {
    const i = db[name].findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).end();
    db[name][i] = { ...req.body, id: req.params.id };
    afterSave?.(db[name][i]);
    save();
    res.json(db[name][i]);
  });
  admin.delete(`/${name}/:id`, (req, res) => {
    const err = beforeDelete?.(req.params.id);
    if (err) return res.status(409).json({ error: err });
    db[name] = db[name].filter((x) => x.id !== req.params.id);
    save();
    res.json({ ok: true });
  });
}
const usesExercise = (id) => db.programs.some((p) => (p.workouts || []).some((w) => (w.phases || []).some((ph) => (ph.blocks || []).some((b) => (b.items || []).some((it) => it.exerciseId === id)))));
crud('exercises', () => ({ name: 'Nuovo esercizio', category: '', cues: '', video: '', repsInVideo: '', secPerRep: '', easierId: '', harderId: '' }), (id) => {
  if (usesExercise(id)) return 'Esercizio usato in un programma: toglilo prima dal programma';
  for (const e of db.exercises) {
    if (e.easierId === id) e.easierId = '';
    if (e.harderId === id) e.harderId = '';
  }
}, (ex) => {
  // collegamento nei due sensi: se B è la versione più facile di A, A diventa la più difficile di B (se B non ne ha già una)
  if (ex.easierId === ex.id) ex.easierId = '';
  if (ex.harderId === ex.id) ex.harderId = '';
  const easier = db.exercises.find((e) => e.id === ex.easierId);
  if (easier && !easier.harderId) easier.harderId = ex.id;
  const harder = db.exercises.find((e) => e.id === ex.harderId);
  if (harder && !harder.easierId) harder.easierId = ex.id;
});
crud('programs', () => ({ title: 'Nuovo programma', subtitle: '', kind: 'base', startDate: '', level: 'Principiante', weeks: 8, description: '', cover: '', published: false, workouts: [] }));
crud('tips', () => ({ title: 'Nuovo consiglio', text: '', image: '', start: '', end: '', published: false }));
crud('tutorials', () => ({ title: 'Nuovo tutorial', category: 'Swing', level: 'Tutti', minutes: '', videoUrl: '', description: '', exerciseId: '', published: false }));
admin.get('/moderation', (req, res) => {
  const name = (id) => db.users.find((u) => u.id === id)?.name || 'Ex membro';
  const reports = db.reports.map((r) => { const m = db.messages.find((x) => x.id === r.messageId); return m && { ...r, byName: name(r.by), message: { ...m, name: name(m.from), where: m.room === 'general' ? 'Chat di gruppo' : 'Messaggio privato' } }; }).filter(Boolean).reverse();
  const general = db.messages.filter((m) => m.room === 'general').slice(-100).reverse().map((m) => ({ ...m, name: name(m.from) }));
  const banned = db.users.filter((u) => u.community?.banned).map((u) => ({ id: u.id, name: u.name, email: u.email }));
  res.json({ reports, general, banned });
});
admin.delete('/moderation/messages/:id', (req, res) => {
  const m = db.messages.find((x) => x.id === req.params.id);
  if (m) { m.deleted = true; m.text = ''; }
  db.reports = db.reports.filter((r) => r.messageId !== req.params.id);
  save();
  res.json({ ok: true });
});
admin.delete('/moderation/reports/:id', (req, res) => { db.reports = db.reports.filter((r) => r.id !== req.params.id); save(); res.json({ ok: true }); });
admin.post('/moderation/ban/:userId', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.userId);
  if (!u) return res.status(404).end();
  u.community = { ...(u.community || {}), banned: !!req.body?.banned };
  save();
  res.json({ ok: true, banned: u.community.banned });
});
crud('challenges', () => ({ title: 'Nuova challenge', description: '', unit: 'ripetizioni', dailyTarget: 100, start: today(), end: '', published: false }));

admin.get('/users', (req, res) => res.json(db.users.map((u) => ({
  id: u.id, name: u.name, email: u.email, joined: u.joined, workouts: u.history.length,
  lastWorkout: u.history.at(-1)?.date || '', accessUntil: u.accessUntil || '', active: hasAccess(u),
  accessLog: (u.accessLog || []).slice(-5), nutrition: { ...DEFAULT_NUTRITION, ...(u.nutrition || {}) },
  profile: { sex: u.profile?.sex, birthYear: u.profile?.birthYear, heightCm: u.profile?.heightCm, goal: u.profile?.goal, trainingDays: u.profile?.trainingDays },
  weight: u.weights.at(-1)?.kg || '',
}))));
admin.post('/users/:id/access', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).end();
  if (req.body?.revoke) {
    u.accessUntil = '';
    (u.accessLog ||= []).push({ date: new Date().toISOString(), months: 0, by: req.who, until: 'revocato' });
  } else {
    const m = Number(req.body?.months);
    if (![1, 3, 6, 12].includes(m)) return res.status(400).json({ error: 'Scegli 1, 3, 6 o 12 mesi' });
    grant(u, m, req.who);
  }
  save();
  res.json({ accessUntil: u.accessUntil, active: hasAccess(u), accessLog: u.accessLog.slice(-5) });
});
admin.put('/users/:id/nutrition', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).end();
  const { kcal = '', p, c, f, note = '', byCoach } = req.body || {};
  if (byCoach && Number(p) + Number(c) + Number(f) !== 100) return res.status(400).json({ error: 'Le percentuali devono fare 100' });
  u.nutrition = byCoach
    ? { kcal, p: Number(p), c: Number(c), f: Number(f), note, by: 'coach', coach: req.who }
    : { ...DEFAULT_NUTRITION, ...u.nutrition, note, kcal: '', by: 'user' }; // restituisce la scelta al membro
  save();
  res.json(u.nutrition);
});
admin.get('/pending', (req, res) => res.json(db.pendingGrants));
admin.post('/pending', (req, res) => {
  const em = String(req.body?.email || '').trim().toLowerCase();
  const m = Number(req.body?.months);
  if (!/^\S+@\S+\.\S+$/.test(em) || ![1, 3, 6, 12].includes(m)) return res.status(400).json({ error: 'Email valida e 1, 3, 6 o 12 mesi' });
  const u = db.users.find((x) => x.email === em);
  if (u) { grant(u, m, req.who); save(); return res.json({ applied: true, user: u.name, accessUntil: u.accessUntil }); }
  db.pendingGrants[em] = { months: m, by: req.who, date: today() };
  save();
  res.json({ applied: false });
});
// Attivazione multipla: incolli un elenco di email (da Stripe o dal sito), tutte con la stessa durata.
admin.post('/pending/bulk', (req, res) => {
  const m = Number(req.body?.months);
  if (![1, 3, 6, 12].includes(m)) return res.status(400).json({ error: 'Scegli 1, 3, 6 o 12 mesi' });
  const emails = [...new Set(String(req.body?.emails || '').toLowerCase().match(/[^\s,;<>"']+@[^\s,;<>"']+\.[a-z]{2,}/g) || [])];
  if (!emails.length) return res.status(400).json({ error: 'Nessuna email trovata nel testo' });
  let activated = 0, pending = 0;
  for (const em of emails) {
    const u = db.users.find((x) => x.email === em);
    if (u) { grant(u, m, req.who); activated++; } else { db.pendingGrants[em] = { months: m, by: req.who, date: today() }; pending++; }
  }
  save();
  res.json({ total: emails.length, activated, pending });
});
admin.delete('/pending/:email', (req, res) => {
  delete db.pendingGrants[req.params.email];
  save();
  res.json({ ok: true });
});
admin.get('/staff', (req, res) => res.json(db.staff.map(({ password, ...s }) => s)));
admin.post('/staff', (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  const em = String(email).trim().toLowerCase();
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(em) || String(password).length < 8) return res.status(400).json({ error: 'Nome, email valida e password di almeno 8 caratteri' });
  if (db.staff.some((x) => x.email === em)) return res.status(409).json({ error: 'Email già usata' });
  const st = { id: newId(), name: name.trim(), email: em, password: hashPassword(password), created: today() };
  db.staff.push(st);
  save();
  const { password: _, ...pub } = st;
  res.json(pub);
});
admin.delete('/staff/:id', (req, res) => {
  db.staff = db.staff.filter((x) => x.id !== req.params.id);
  for (const [k, s] of Object.entries(db.staffSessions)) if (s.staffId === req.params.id) delete db.staffSessions[k];
  save();
  res.json({ ok: true });
});
admin.delete('/users/:id', (req, res) => {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Solo il proprietario può eliminare un membro' });
  db.users = db.users.filter((u) => u.id !== req.params.id);
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === req.params.id) delete db.sessions[k];
  fs.rm(path.join(PRIVATE, req.params.id), { recursive: true, force: true }, () => {});
  save();
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, newId() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(video|image)\//.test(file.mimetype)),
});
// I video caricati (anche 4K dal telefono) diventano MP4 H.264 a 720p senza audio:
// pesano 1-2 MB, partono subito sul telefono dei clienti e vanno in loop puliti.
let FFMPEG = null;
try { FFMPEG = require('ffmpeg-static'); } catch {}
function compressVideo(src) {
  return new Promise((resolve) => {
    if (!FFMPEG) return resolve(null);
    const out = src.replace(/\.[^.]+$/, '') + '-720.mp4';
    const { execFile } = require('child_process');
    execFile(FFMPEG, ['-y', '-i', src, '-vf', "scale='if(gt(iw,ih),1280,-2)':'if(gt(iw,ih),-2,1280)'", '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out],
    { timeout: 10 * 60 * 1000 }, (err) => resolve(err ? null : out));
  });
}
admin.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica un video o un\'immagine' });
  if (/^video\//.test(req.file.mimetype)) {
    const before = req.file.size;
    const out = await compressVideo(req.file.path);
    if (out) {
      fs.rm(req.file.path, () => {});
      return res.json({ url: '/uploads/' + path.basename(out), before, after: fs.statSync(out).size });
    }
  }
  res.json({ url: '/uploads/' + req.file.filename });
});

app.use('/api/admin', admin);
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`App su http://localhost:${PORT}  ·  admin su http://localhost:${PORT}/admin`);
  if (ADMIN_KEY === 'cambiami') console.log('ATTENZIONE: imposta ADMIN_KEY prima di metterla online');
});
