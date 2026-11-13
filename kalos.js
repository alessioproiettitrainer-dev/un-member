// Lettura dei clienti low ticket dal gestionale Kalos (piattaforma esterna, NON nostra).
// REGOLA: solo lettura. Si fanno esattamente due chiamate e nient'altro:
//   1. il login (lo stesso che fa il browser quando si entra nel sito)
//   2. la lettura della lista dei clienti low ticket
//   3. la lettura della lista "Clienti" (abbonamenti con alimentazione da 56 €, che nella lista low ticket non ci sono) — ok di Alessio del 13/11
// Niente chat, schede cliente, modifiche o cancellazioni: qualsiasi altro indirizzo viene rifiutato qui sotto.
const BASE = 'https://server.kalosfit.com/kalosapi';
const ALLOWED = new Map([
  ['/user/signinadmin', 'POST'],
  ['/lowticketclients/fetchLowTicketClients', 'GET'],
  ['/salesclients/fetchSalesClients', 'GET'],
]);

async function call(pathname, method, { body, cookie } = {}) {
  if (ALLOWED.get(pathname) !== method) throw new Error(`Kalos: chiamata non permessa (${method} ${pathname})`);
  const r = await fetch(BASE + pathname, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: 'https://backend.kalosfit.com',
      Referer: 'https://backend.kalosfit.com/',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Kalos ${pathname}: errore ${r.status}`);
  return r;
}

// data di scadenza come la vede chi è in Italia (AAAA-MM-GG)
const romeDate = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

// login (una volta) e lettura di una lista, solo GET
async function session(email, password) {
  if (!email || !password) throw new Error('Mancano KALOS_EMAIL e KALOS_PASSWORD nelle variabili d\'ambiente');
  const login = await call('/user/signinadmin', 'POST', { body: { email, password } });
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get('set-cookie') || ''])
    .map((c) => c.split(';')[0]).filter((c) => c.startsWith('jwt_operator=')).join('; ');
  if (!cookie) throw new Error('Kalos: login non riuscito (controlla email e password)');
  return cookie;
}
async function getList(pathname, cookie) {
  const data = await (await call(pathname, 'GET', { cookie })).json();
  return Array.isArray(data) ? data : data.result || data.clients || data.data || [];
}
function toClient(c, today) {
  const until = c.expiresAt ? romeDate(c.expiresAt) : '';
  const plan = String(c.lowTicketPlan || ''), annual = c.lowTicketInterval === 'annual';
  return {
    email: String(c.email).trim().toLowerCase(),
    name: [c.firstName, c.lastName].filter(Boolean).join(' ').trim(),
    plan: plan === '56' ? (annual ? '400 €/anno' : '56 €/mese') : plan === '30' ? (annual ? '250 €/anno' : '30 €/mese') : plan,
    until,
    active: !!until && until >= today && !c.isPaused,
    paused: !!c.isPaused,
  };
}

// clienti da sincronizzare: lista low ticket + dalla lista "Clienti" quelli che lì non ci sono
// (abbonamenti con alimentazione da 56 €, passati dal low ticket a cliente "pieno"); a parità di email vince il low ticket
async function fetchLowTicketClients(email, password) {
  const cookie = await session(email, password);
  const today = romeDate(new Date().toISOString());
  const low = (await getList('/lowticketclients/fetchLowTicketClients', cookie)).filter((c) => c?.email).map((c) => toClient(c, today));
  const seen = new Set(low.map((c) => c.email));
  let extra = [];
  try {
    extra = (await getList('/salesclients/fetchSalesClients', cookie))
      .filter((c) => c?.email && c.role === 'user' && c.lowTicketPlan && !seen.has(String(c.email).trim().toLowerCase()))
      .map((c) => ({ ...toClient(c, today), from: 'clienti' }));
  } catch {} // se la seconda lista non risponde, la sincronizzazione va avanti con la prima
  return [...low, ...extra];
}

// lista "Clienti" grezza: solo per il controllo della struttura (/api/admin/kalos/probe)
async function fetchSalesClientsRaw(email, password) {
  return getList('/salesclients/fetchSalesClients', await session(email, password));
}
module.exports = { fetchLowTicketClients, fetchSalesClientsRaw };
