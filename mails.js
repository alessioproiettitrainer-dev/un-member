// Email automatiche a chi è in settimana di prova (le spedisce da Gmail un'attività programmata).
// Giorno 0 = giorno in cui ha attivato la prova. Ogni email parte una volta sola e solo nella sua finestra:
// chi entra tardi non riceve di colpo quelle vecchie.
const STAGES = [
  { key: 'd2', from: 2, to: 3 },
  { key: 'd4', from: 4, to: 5 },
  { key: 'last', last: true },
];

const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0] || '';
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : '';
};

function render(key, name, url) {
  const ciao = name ? `Ciao ${name}!` : 'Ciao!';
  const btn = (t) => `<p style="margin:22px 0"><a href="${url}" style="background:#ff7a00;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px;display:inline-block">${t}</a></p>`;
  const wrap = (html) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">${html}</div>`;
  const T = {
    d2: {
      subject: `${name ? `${name}, hai` : 'Hai'} già fatto il primo workout? 💪`,
      paras: [
        ciao,
        'Sono passati due giorni da quando hai iniziato la prova della nuova app e sono curioso: <b>hai già fatto il primo workout?</b> Com\'è andata col timer, i video e la voce che ti guida?',
        'Se ancora non hai iniziato, nessun problema: apri l\'app, vai su <b>Allenamenti</b> e premi ▶ Inizia. In mezz\'ora sei a posto.',
        'Mi fai un favore? <b>Dimmi com\'è andata.</b> Puoi:<br>👉 rispondere direttamente a questa email, anche con due righe<br>👉 oppure entrare nella <b>community</b> dell\'app e scriverlo lì, così lo leggono anche gli altri',
        'I vostri feedback sono importantissimi: in base a quello che mi dite decido se e come lanciare questa nuova versione per tutti.',
        '__BTN__Apri l\'app',
        'Daje, buon allenamento!<br>Alessio',
      ],
    },
    d4: {
      subject: `Come vanno gli allenamenti${name ? `, ${name}` : ''}? (+ 3 trucchi)`,
      paras: [
        ciao,
        'Ormai sei a metà settimana: <b>come stanno andando i workout?</b> Ti trovi con i tempi, gli esercizi sono chiari, c\'è qualcosa che ti ha fatto storcere il naso?',
        'Intanto ti lascio 3 trucchi che in pochi scoprono subito:<br>🎥 <b>Tocca un esercizio</b> nell\'anteprima del workout e vedi subito la demo<br>⛶ Durante l\'allenamento premi il tasto <b>schermo intero</b>: il video diventa grande e i comandi restano sopra<br>🔊 La <b>voce</b> ti annuncia ogni esercizio e il recupero: se ti dà fastidio la togli dall\'icona in alto',
        'E se non l\'hai ancora fatto, <b>entra nella community</b>: presentati con una foto, scrivi come ti sta andando, fai una domanda. È lì che si crea il gruppo.',
        'Come sempre, se mi rispondi a questa email la leggo io personalmente. Ogni commento, anche una critica, mi aiuta a migliorarla.',
        '__BTN__Apri l\'app',
        'A presto!<br>Alessio',
      ],
    },
    last: {
      subject: `${name ? `${name}, ultimo` : 'Ultimo'} giorno: mi dici la tua? 🙏`,
      paras: [
        ciao,
        'Oggi è l\'ultimo giorno della tua settimana di prova. Spero che sia andata alla grande!',
        'Ti chiedo solo <b>una cosa, 30 secondi</b>: rispondi a questa email con<br>1️⃣ cosa ti è piaciuto di più<br>2️⃣ cosa cambieresti<br>3️⃣ da 1 a 10, quanto la consiglieresti a un amico',
        'È davvero il feedback che mi serve per decidere se lanciare questa versione per tutti.',
        'Se vuoi continuare ad allenarti con l\'app, trovi i piani nella sezione <b>Profilo → Abbonamento</b>.',
        '__BTN__Apri l\'app',
        'Grazie di cuore, ci vediamo dentro!<br>Alessio',
      ],
    },
  }[key];
  const html = wrap(T.paras.map((p) => (p.startsWith('__BTN__') ? btn(p.slice(7)) : `<p>${p}</p>`)).join(''));
  const body = T.paras.map((p) => (p.startsWith('__BTN__') ? `${p.slice(7)}: ${url}` : p.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''))).join('\n\n');
  return { subject: T.subject, body, htmlBody: html };
}

// quale email (se c'è) deve ricevere oggi questo utente in prova
function dueStage(u, today, trialDays) {
  if (!u.trialUntil || u.trialUntil < today) return null;
  const end = new Date(u.trialUntil + 'T12:00Z');
  const start = u.trialStart ? new Date(u.trialStart + 'T12:00Z') : new Date(end.getTime() - (trialDays - 1) * 864e5);
  const day = Math.round((new Date(today + 'T12:00Z') - start) / 864e5);
  const sent = u.trialMails || {};
  for (const s of STAGES) {
    if (sent[s.key]) continue;
    if (s.last ? today === u.trialUntil && day >= 1 : day >= s.from && day <= s.to) return { key: s.key, day };
  }
  return null;
}

module.exports = { render, dueStage, firstName };
