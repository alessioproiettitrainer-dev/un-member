// Email automatiche a chi è in settimana di prova (le spedisce da Gmail un'attività programmata).
// Giorno 0 = giorno in cui ha attivato la prova. Ogni email parte una volta sola e solo nella sua finestra:
// chi entra tardi non riceve di colpo quelle vecchie.
const STAGES = [
  { key: 'd2', from: 2, to: 3 },
  { key: 'd4', from: 4, to: 5 },
  { key: 'last', last: true },
  { key: 'after', after: [2, 4] }, // 2-4 giorni dopo la fine della prova, solo a chi non si è abbonato
];

const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0] || '';
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : '';
};

function render(key, name, url, settings = {}) {
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
    after: {
      subject: `${name ? `${name}, tutto` : 'Tutto'} ok? 🙂`,
      paras: [
        ciao,
        'La tua settimana di prova è finita da un paio di giorni e volevo sapere: <b>tutto ok? Come va? Hai avuto modo di pensarci?</b>',
        ...(settings.consultUrl ? ['Ti ricordo che se hai bisogno di qualcosa di <b>più personalizzato</b>, puoi prenotare una <b>consulenza gratuita</b> con il mio collaboratore: è gratis e senza impegno, quindi fattela, che te frega? 😄', '__CONSULT__'] : []),
        'Se invece vuoi continuare ad allenarti con l\'app, i piani li trovi qui:',
        '__PLANS__',
        'E se l\'app in qualche modo <b>non ti è piaciuta</b>, fammelo sapere: rispondi a questa email anche con una riga sola. Mi serve davvero per migliorarla.',
        'Un abbraccio,<br>Alessio',
      ],
    },
    last: {
      subject: `${name ? `${name}, com'è` : 'Com\'è'} andata la settimana di prova? 🙏`,
      paras: [
        ciao,
        'Oggi è l\'ultimo giorno della tua settimana di prova: <b>com\'è andata? Ti è piaciuta?</b> Rispondimi anche solo con due righe: cosa ti è piaciuto, cosa cambieresti. Lo leggo io personalmente ed è il feedback che mi serve per migliorarla.',
        '<b>Vuoi continuare ad allenarti con l\'app?</b> Scegli il piano che fa per te:',
        '__PLANS__',
        ...(settings.consultUrl ? ['<b>Preferisci un percorso su misura?</b> Se vuoi un servizio personalizzato, prenota una <b>consulenza gratuita</b> con il mio collaboratore: insieme capite qual è la soluzione giusta per te.', '__CONSULT__'] : []),
        'Grazie di cuore, ci vediamo dentro!<br>Alessio',
      ],
    },
  }[key];
  const plans = (settings.plans || []).filter((x) => x.url);
  const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const plansHtml = plans.map((x) => `<div style="border:1px solid ${x.best ? '#ff7a00' : '#e3e3e3'};border-radius:12px;padding:12px 14px;margin:8px 0"><b>${esc(x.title)}</b>${x.best ? ' <span style="color:#ff7a00;font-size:12px;font-weight:bold">· consigliato</span>' : ''}<br><span style="font-size:18px;font-weight:bold">${esc(x.price)}</span> <span style="color:#777">${esc(x.period)}</span>${x.note ? `<br><span style="color:#777;font-size:13px">${esc(x.note)}</span>` : ''}<br><a href="${esc(x.url)}" style="display:inline-block;margin-top:8px;background:${x.best ? '#ff7a00' : '#1a1a1a'};color:#ffffff;text-decoration:none;font-weight:bold;padding:9px 16px;border-radius:9px">Scegli questo piano</a></div>`).join('');
  const consult = settings.consultUrl ? `<p style="margin:18px 0"><a href="${esc(settings.consultUrl)}" style="background:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px;display:inline-block">${esc(settings.consultLabel || 'Prenota la consulenza gratuita')}</a></p>` : '';
  const part = (p) => (p === '__PLANS__' ? plansHtml || btn('Scegli il tuo piano') : p === '__CONSULT__' ? consult : p.startsWith('__BTN__') ? btn(p.slice(7)) : `<p>${p}</p>`);
  const html = wrap(T.paras.map(part).join(''));
  const text = (p) => (p === '__PLANS__' ? (plans.length ? plans.map((x) => `• ${x.title}: ${x.price} ${x.period} → ${x.url}`).join('\n') : `Scegli il tuo piano: ${url}/#/abbonati`)
    : p === '__CONSULT__' ? `${settings.consultLabel || 'Prenota la consulenza gratuita'}: ${settings.consultUrl}`
    : p.startsWith('__BTN__') ? `${p.slice(7)}: ${url}` : p.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''));
  const body = T.paras.map(text).join('\n\n');
  return { subject: T.subject, body, htmlBody: html };
}

// quale email (se c'è) deve ricevere oggi questo utente in prova
function dueStage(u, today, trialDays) {
  if (!u.trialUntil) return null;
  if (u.trialUntil < today) { // prova finita: solo l'email "tutto ok?" 2-4 giorni dopo
    const after = Math.round((new Date(today + 'T12:00Z') - new Date(u.trialUntil + 'T12:00Z')) / 864e5);
    const st = STAGES.find((x) => x.after);
    return !(u.trialMails || {})[st.key] && after >= st.after[0] && after <= st.after[1] ? { key: st.key, day: after } : null;
  }
  const end = new Date(u.trialUntil + 'T12:00Z');
  const start = u.trialStart ? new Date(u.trialStart + 'T12:00Z') : new Date(end.getTime() - (trialDays - 1) * 864e5);
  const day = Math.round((new Date(today + 'T12:00Z') - start) / 864e5);
  const sent = u.trialMails || {};
  for (const s of STAGES) {
    if (sent[s.key] || s.after) continue;
    if (s.last ? today === u.trialUntil && day >= 1 : day >= s.from && day <= s.to) return { key: s.key, day };
  }
  return null;
}

module.exports = { render, dueStage, firstName };
