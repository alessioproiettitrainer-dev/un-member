// Lettura delle risposte arrivate nella Gmail del coach (IMAP, stessa "password per le app" usata per inviare).
// Solo lettura: non segna come lette, non sposta e non cancella niente.
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const configured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// toglie la parte citata ("Il giorno ... ha scritto:", righe con ">") per tenere solo la risposta
function cleanText(t) {
  const lines = String(t || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (const l of lines) {
    if (/^\s*>/.test(l)) break;
    if (/^(Il giorno|On .+ wrote:|Da: |From: |-----Original|Inviato da|Sent from)/i.test(l.trim())) break;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3000);
}

async function fetchReplies(days = 21) {
  if (!configured()) throw new Error('Mancano GMAIL_USER e GMAIL_APP_PASSWORD su Render');
  const me = process.env.GMAIL_USER.toLowerCase();
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, logger: false,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') } });
  await client.connect();
  const list = [];
  const lock = await client.getMailboxLock('INBOX', { readOnly: true });
  try {
    const since = new Date(Date.now() - days * 864e5);
    const uids = await client.search({ since }, { uid: true });
    for await (const m of client.fetch(uids.slice(-150), { source: true, envelope: true }, { uid: true })) {
      const from = (m.envelope.from?.[0]?.address || '').toLowerCase();
      if (!from || from === me || /no-?reply|mailer-daemon|postmaster|notifications?@|google\.com$/i.test(from)) continue;
      const p = await simpleParser(m.source);
      list.push({ uid: m.uid, from, fromName: m.envelope.from?.[0]?.name || '', subject: p.subject || '', date: (p.date || m.envelope.date || new Date()).toISOString(),
        text: cleanText(p.text || ''), messageId: p.messageId || '', references: [].concat(p.references || []).join(' ') });
    }
  } finally { lock.release(); await client.logout().catch(() => {}); }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
module.exports = { fetchReplies, configured };
