// Lettura dei clienti low ticket dal gestionale Kalos (piattaforma esterna, NON nostra).
// REGOLA: solo lettura. Si fanno esattamente due chiamate e nient'altro:
//   1. il login (lo stesso che fa il browser quando si entra nel sito)
//   2. la lettura della lista dei clienti low ticket
// Niente chat, schede cliente, modifiche o cancellazioni: qualsiasi altro indirizzo viene rifiutato qui sotto.
const BASE = 'https://server.kalosfit.com/kalosapi';
const ALLOWED = new Map([
  ['/user/signinadmin', 'POST'],
  ['/lowticketclients/fetchLowTicketClients', 'GET'],
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

async function fetchLowTicketClients(email, password) {
  if (!email || !password) throw new Error('Mancano KALOS_EMAIL e KALOS_PASSWORD nelle variabili d\'ambiente');
  const login = await call('/user/signinadmin', 'POST', { body: { email, password } });
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get('set-cookie') || ''])
    .map((c) => c.split(';')[0]).filter((c) => c.startsWith('jwt_operator=')).join('; ');
  if (!cookie) throw new Error('Kalos: login non riuscito (controlla email e password)');
  const data = await (await call('/lowticketclients/fetchLowTicketClients', 'GET', { cookie })).json();
  const list = Array.isArray(data) ? data : data.result || data.clients || [];
  const today = romeDate(new Date().toISOString());
  return list.filter((c) => c?.email).map((c) => {
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
  });
}
module.exports = { fetchLowTicketClients };
