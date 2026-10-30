// Email "ci manchi" a chi non apre l'app da più di 3 giorni: ogni volta un testo diverso (6 a rotazione),
// con i programmi veri dell'app, le novità e il link per cancellarsi.
const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const VARIANTS = 6;

// info = { name, url, access, programs: [{title, subtitle, month}], news, soon, weekWorkouts, unsub, settings }
function render(n, info) {
  const { name, url, access, programs, news, soon, weekWorkouts, unsub, settings = {} } = info;
  const ciao = name ? `Ciao ${name}!` : 'Ciao!';
  const month = programs.find((p) => p.month);
  const progList = programs.map((p) => `• <b>${esc(p.title)}</b>${p.subtitle ? ` · ${esc(p.subtitle)}` : ''}`).join('<br>');
  const cta = access ? 'Apri l\'app' : 'Torna ad allenarti';
  const V = [
    {
      subject: `${name ? `${name}, è` : 'È'} un po' che non ti vedo 👀`,
      paras: [ciao, 'È qualche giorno che non ti vedo nell\'app e volevo sapere: <b>tutto bene?</b>',
        month ? `Intanto è partito il <b>Programma del mese</b>: <b>${esc(month.title)}</b>. Allenamenti nuovi ogni settimana, con video, timer e voce che ti guida.` : 'I tuoi allenamenti ti aspettano, con video, timer e voce che ti guida.',
        'Non serve recuperare tutto: <b>riparti da un allenamento</b>, anche oggi. Il primo passo è sempre il più difficile 💪', '__BTN__', 'Un abbraccio,<br>Alessio'],
    },
    {
      subject: 'Cosa c\'è di nuovo nell\'app 🔥',
      paras: [ciao, 'Ti aggiorno su quello che trovi adesso nell\'app:', progList, ...(news ? [`<b>Novità:</b> ${esc(news)}`] : []),
        'Se non sai da dove partire, rispondi a questa email e ti dico io quale programma fa per te.', '__BTN__', 'A presto,<br>Alessio'],
    },
    {
      subject: `${name ? `${name}, ti` : 'Ti'} bastano 20 minuti ⏱️`,
      paras: [ciao, 'Lo so, ci sono settimane in cui il tempo non c\'è. Ma <b>20 minuti</b> li trovi: un kettlebell, un tappetino e parti.',
        'Apri l\'app, scegli un allenamento e premi ▶: <b>il timer e la voce</b> fanno il resto, tu devi solo seguire.',
        'Meglio un allenamento corto oggi che quello perfetto mai 😉', '__BTN__', 'Daje!<br>Alessio'],
    },
    {
      subject: 'Sta arrivando una cosa nuova 👀',
      paras: [ciao, soon ? `Ti spoilero cosa sto preparando: <b>${esc(soon)}</b>.` : 'Sto preparando nuovi programmi e nuovi video per l\'app.',
        '<b>Tu cosa vorresti trovarci?</b> Un programma particolare, allenamenti più corti, più esercizi a corpo libero? Rispondi a questa email anche con una riga: le idee migliori le metto davvero nell\'app.',
        '__BTN__', 'Grazie!<br>Alessio'],
    },
    {
      subject: weekWorkouts > 5 ? `Questa settimana sono stati fatti ${weekWorkouts} allenamenti 💪` : 'La community ti aspetta 💪',
      paras: [ciao, weekWorkouts > 5 ? `Negli ultimi 7 giorni i membri dell'app hanno completato <b>${weekWorkouts} allenamenti</b>. Manchi solo tu 😄` : 'Gli altri membri si stanno allenando e manchi solo tu 😄',
        'Entra nella <b>Community</b> dell\'app: scrivi come stai, chiedi un consiglio, racconta il tuo allenamento. Allenarsi in gruppo è un\'altra cosa, anche a distanza.',
        '__BTN__', 'Ci vediamo dentro,<br>Alessio'],
    },
    {
      subject: 'Hai già fatto il Test livelli? 🏆',
      paras: [ciao, 'Nell\'app c\'è il <b>Test livelli</b> (in Progressi): 5 prove tra kettlebell, piegamenti, trazioni, toes to bar e burpee, e scopri se sei <b>Base, Bronzo, Argento, Oro o Elite</b>.',
        'È il modo migliore per ripartire: fai il test oggi, ti alleni qualche settimana e lo rifai. Vedere i punti salire è la motivazione più forte che ci sia.',
        '__BTN__', 'Fammi sapere il tuo livello!<br>Alessio'],
    },
  ][n % VARIANTS];
  const plans = (settings.plans || []).filter((x) => x.url);
  // chi non ha più l'accesso trova anche i piani
  const plansHtml = !access && plans.length ? `<p>Per tornare ad allenarti scegli il tuo piano:</p>${plans.map((x) => `<div style="border:1px solid ${x.best ? '#ff7a00' : '#e3e3e3'};border-radius:12px;padding:10px 14px;margin:8px 0"><b>${esc(x.title)}</b> · <b>${esc(x.price)}</b> <span style="color:#777">${esc(x.period)}</span><br><a href="${esc(x.url)}" style="color:#ff7a00;font-weight:bold">Scegli questo piano</a></div>`).join('')}` : '';
  const btn = `<p style="margin:22px 0"><a href="${url}" style="background:#ff7a00;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px;display:inline-block">${cta}</a></p>${plansHtml}`;
  const foot = `<p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:10px">Ricevi questa email perché sei iscritto all'app UN-MEMBER. Non vuoi più riceverle? <a href="${unsub}" style="color:#999">Cancellati qui</a>.</p>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">${V.paras.map((p) => (p === '__BTN__' ? btn : `<p>${p}</p>`)).join('')}${foot}</div>`;
  const text = V.paras.map((p) => (p === '__BTN__' ? `${cta}: ${url}${!access && plans.length ? `\n\nI piani:\n${plans.map((x) => `• ${x.title}: ${x.price} ${x.period} → ${x.url}`).join('\n')}` : ''}` : p.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'))).join('\n\n')
    + `\n\n—\nNon vuoi più ricevere queste email? Cancellati qui: ${unsub}`;
  return { subject: V.subject, body: text, htmlBody: html };
}

module.exports = { render, VARIANTS };
