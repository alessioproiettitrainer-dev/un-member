// Trasforma un allenamento (fasi -> blocchi -> esercizi) in una lista lineare di step che il player esegue.
// Tipi di step: 'timed' (conto alla rovescia), 'stopwatch' (cronometro, AFAP), 'manual' (si va avanti con "Fatto").

export const BLOCK_TYPES = {
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'AFAP / For Time',
  intervals: 'Round a tempo (lavoro/recupero)',
  sets: 'Serie e ripetizioni',
  ladder: 'Ladder (scala di ripetizioni)',
  video: 'Video (YouTube / Drive)',
  rest: 'Pausa (recupero tra blocchi)',
};

export const PHASE_TYPES = { warmup: 'Riscaldamento', workout: 'Workout', cooldown: 'Defaticamento' };

const GET_READY = 10;

export function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function blockSummary(b) {
  switch (b.type) {
    case 'emom': {
      const ev = Number(b.every) || 60, r = emomRounds(b), tot = Math.round((emomIntervals(b) * ev) / 60 * 10) / 10;
      const lad = Number(b.ladderStep) || (b.items || []).some((it) => Number(it.ladderStep));
      return `EMOM ${r} round · ${String(tot).replace('.', ',')} min${ev !== 60 ? ` · ogni ${ev}s` : ''}${lad ? ` · ladder${b.ladderUpDown ? ' su e giù' : ''}` : ''}`;
    }
    case 'amrap': return `AMRAP ${b.cap || 0} min`;
    case 'fortime': return `AFAP · ${b.rounds || 1} round${b.cap ? ` · cap ${b.cap} min` : ''}`;
    case 'intervals': return `${b.rounds || 1} round · ${b.work || 0}s lavoro / ${b.rest || 0}s recupero`;
    case 'ladder': { const f = Number(b.from) || 1, t = Number(b.to) || 10; return `Ladder ${f}→${t}${b.updown ? `→${f}` : ''}${b.rest ? ` · ${b.rest}s recupero` : ''}`; }
    case 'video': return `Video${b.minutes ? ` · ${b.minutes} min` : ''}`;
    case 'rest': return `Pausa ${Number(b.seconds) || 0}s`;
    case 'sets': return `${b.rounds || 1} serie${b.rest ? ` · ${b.rest}s recupero` : ''}`;
    default: return '';
  }
}

// Durata stimata in secondi (gli step manuali contano 40s, l'AFAP il cap o 8 minuti).
export function estimateSeconds(workout) {
  return buildSteps(workout).reduce((t, s) => t + (s.kind === 'timed' ? s.dur : s.kind === 'stopwatch' ? (s.cap || 480) : s.video ? (s.minutes || 10) * 60 : 40), 0);
}

// "3" + 2 → "5"; testi non numerici (es. "5 + 5") restano uguali
function shiftReps(text, delta) {
  const m = String(text || '').match(/^(\s*)(\d+)(.*)$/);
  return m && !m[3].includes('+') ? `${m[1]}${Math.max(1, Number(m[2]) + delta)}${m[3]}` : text;
}

// EMOM: un round = un giro di tutti gli esercizi (quelli "con sopra" stanno nello stesso intervallo).
// Intervalli totali = round × intervalli per giro; i blocchi vecchi (minuti totali) restano come erano.
export const emomSlotCount = (b) => Math.max(1, emomSlots(b.items || []).length);
export const emomRounds = (b) => Math.max(1, Number(b.rounds) || Math.round(emomIntervals(b) / emomSlotCount(b)));
export const emomIntervals = (b) => (Number(b.rounds) ? Number(b.rounds) * emomSlotCount(b) : Math.max(1, Math.round(((Number(b.minutes) || 1) * 60) / (Number(b.every) || 60))));
function emomSlots(items) {
  const slots = [];
  for (const it of items) {
    if (it.samePrev && slots.length) slots[slots.length - 1].push(it);
    else slots.push([it]);
  }
  return slots;
}

export function buildSteps(workout) {
  const steps = [];
  const hasContent = (b) => (b.type === 'video' ? !!b.url : b.type === 'rest' ? Number(b.seconds) > 0 : (b.items || []).length);
  // pausa tra blocchi: il "prossimo esercizio" si riempie alla fine, quando si sa cosa viene dopo
  const pause = (base, dur) => steps.push({ ...base, kind: 'timed', dur, rest: true, pause: true, items: [], label: 'RECUPERO' });
  const phases = (workout.phases || []).filter((p) => (p.blocks || []).some(hasContent));
  phases.forEach((ph, pi) => {
    const blocks = ph.blocks.filter(hasContent);
    blocks.forEach((b, bi) => {
      const base = { phase: ph.title || PHASE_TYPES[ph.type] || 'Workout', phaseType: ph.type, block: b.title || (b.type === 'video' ? 'Video' : b.type === 'rest' ? 'Pausa' : BLOCK_TYPES[b.type]), blockType: b.type, blockKey: `${pi}.${bi}`, notes: b.notes || '' };
      const items = b.items;
      const blockSteps = [];
      if (b.type === 'rest') return pause(base, Number(b.seconds));
      if (b.type === 'video') {
        // Video lungo da seguire: niente "preparati", si va avanti con "Fatto"
        steps.push({ ...base, kind: 'manual', video: b.url, minutes: Number(b.minutes) || 0, items: [], label: 'VIDEO' });
        return;
      }
      if (b.type === 'emom') {
        const every = Number(b.every) || 60;
        const n = emomIntervals(b);
        const slots = emomSlots(items);
        const giri = Math.ceil(n / slots.length);
        for (let k = 0; k < n; k++) {
          // EMOM ladder: a ogni giro completo le ripetizioni salgono del passo dell'esercizio (o di quello del blocco);
          // "su e giù": salgono fino a metà e poi tornano indietro (es. 10 min: 1-2-3-4-5-5-4-3-2-1)
          const giro = Math.floor(k / slots.length);
          const lvl = b.ladderUpDown ? (giro < Math.ceil(giri / 2) ? giro : giri - 1 - giro) : giro;
          const its = slots[k % slots.length].map((it) => { const st = it.ladderStep !== undefined && it.ladderStep !== '' ? Number(it.ladderStep) : Number(b.ladderStep) || 0; return st ? { ...it, reps: shiftReps(it.reps, st * lvl) } : it; });
          blockSteps.push({ ...base, kind: 'timed', dur: every, items: its, emom: true, label: every === 60 ? `MINUTO ${k + 1}` : `INTERVALLO ${k + 1}`, counter: `${k + 1}/${n}`, counterLabel: every === 60 ? 'MINUTI' : 'INTERVALLI' });
        }
      } else if (b.type === 'ladder') {
        // Ladder: gradini da "from" a "to" (ed eventualmente ritorno), ogni gradino tutti gli esercizi con quel numero di ripetizioni
        const f = Math.max(1, Number(b.from) || 1), t = Math.max(1, Number(b.to) || 10), st = Math.max(1, Math.abs(Number(b.step) || 1));
        const rungs = [];
        if (f <= t) for (let r = f; r <= t; r += st) rungs.push(r); else for (let r = f; r >= t; r -= st) rungs.push(r);
        if (b.updown) rungs.push(...rungs.slice(0, -1).reverse());
        rungs.forEach((r, i) => {
          blockSteps.push({ ...base, kind: 'manual', ladder: true, firstRung: i === 0, lastRung: i === rungs.length - 1, items: items.map((it) => ({ ...it, reps: String(r) })), label: `GRADINO ${i + 1} · ${r} RIP`, counter: `${i + 1}/${rungs.length}`, counterLabel: 'GRADINI' });
          if ((Number(b.rest) || 0) > 0 && i < rungs.length - 1) blockSteps.push({ ...base, kind: 'timed', dur: Number(b.rest), rest: true, items: [items[0]], label: 'RECUPERO', counter: `${i + 1}/${rungs.length}`, counterLabel: 'GRADINI' });
        });
      } else if (b.type === 'amrap') {
        blockSteps.push({ ...base, kind: 'timed', dur: (Number(b.cap) || 10) * 60, items, label: 'AMRAP', amrap: true, counterLabel: 'ROUND FATTI' });
      } else if (b.type === 'fortime') {
        const r = Number(b.rounds) || 1;
        blockSteps.push({ ...base, kind: 'stopwatch', cap: (Number(b.cap) || 0) * 60, items, label: 'AFAP', counter: `${r}`, counterLabel: r === 1 ? 'ROUND' : 'ROUND TOTALI' });
      } else if (b.type === 'intervals') {
        const r = Number(b.rounds) || 1;
        for (let k = 0; k < r; k++) {
          items.forEach((it, i) => {
            blockSteps.push({ ...base, kind: 'timed', dur: Number(it.time) || Number(b.work) || 30, items: [it], label: 'LAVORO', counter: `${k + 1}/${r}`, counterLabel: 'ROUND' });
            const last = i === items.length - 1;
            const rest = last ? Number(b.restRounds) || Number(b.rest) || 0 : Number(b.rest) || 0;
            if (rest > 0 && !(last && k === r - 1)) blockSteps.push({ ...base, kind: 'timed', dur: rest, items: [items[(i + 1) % items.length]], label: 'RECUPERO', rest: true, counter: `${k + 1}/${r}`, counterLabel: 'ROUND' });
          });
        }
      } else if (b.type === 'sets') {
        const r = Number(b.rounds) || 1;
        for (let k = 0; k < r; k++) {
          items.forEach((it, i) => {
            blockSteps.push({ ...base, kind: 'manual', items: [it], label: `SERIE ${k + 1}`, counter: `${k + 1}/${r}`, counterLabel: 'SERIE' });
            const last = k === r - 1 && i === items.length - 1;
            if ((Number(b.rest) || 0) > 0 && !last) blockSteps.push({ ...base, kind: 'timed', dur: Number(b.rest), items: [items[(i + 1) % items.length]], label: 'RECUPERO', rest: true, counter: `${k + 1}/${r}`, counterLabel: 'SERIE' });
          });
        }
      }
      if (!blockSteps.length) return;
      // dopo una pausa non serve anche il "preparati": la pausa annuncia già il blocco che arriva
      const prev = steps.at(-1);
      if (prev?.pause) Object.assign(prev, { summary: blockSummary(b), nextBlock: base.block });
      else steps.push({ ...base, kind: 'timed', dur: GET_READY, items: blockSteps[0].items, label: 'PREPARATI', rest: true, ready: true, summary: blockSummary(b) });
      steps.push(...blockSteps);
      if (Number(b.restAfter) > 0) pause(base, Number(b.restAfter));
    });
  });
  while (steps.at(-1)?.pause) steps.pop(); // niente pausa a fine allenamento
  steps.forEach((s, i) => {
    s.index = i;
    if (s.pause) { const nx = steps.slice(i + 1).find((x) => !x.pause && x.items.length); s.items = nx ? nx.items : []; if (!s.nextBlock && nx) { s.nextBlock = nx.block; s.summary = nx.summary || ''; } }
  });
  return steps.filter((s) => !s.pause || s.items.length);
}

// ---- ritmo guidato (AMRAP / AFAP) ----------------------------------------------
// "10" -> 10, "8-12" -> 8, "5 + 5" -> 10, "30s" / "1 min" -> a tempo
export function parseReps(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return { reps: 0, secs: 0 };
  const time = t.match(/^(\d+(?:[.,]\d+)?)\s*(s|sec|secondi|"|min|m(?!e))\b/);
  if (time) return { reps: 0, secs: Number(time[1].replace(',', '.')) * (/^m/.test(time[2]) ? 60 : 1) };
  if (t.includes('+')) return { reps: t.split('+').reduce((a, x) => a + (parseInt(x, 10) || 0), 0), secs: 0 };
  return { reps: parseInt(t, 10) || 0, secs: 0 };
}

export function secPerRep(ex) {
  return Number(ex?.secPerRep) || 2;
}

// Durata di un esercizio nel giro guidato: ripetizioni x secondi per ripetizione, oppure il tempo scritto.
export function itemPace(item, ex) {
  const { reps, secs } = parseReps(item.reps);
  if (secs) return { reps: 0, spr: 0, dur: secs };
  if (Number(item.time)) return { reps: 0, spr: 0, dur: Number(item.time) };
  if (!reps) return { reps: 0, spr: 0, dur: 30 };
  const spr = secPerRep(ex);
  return { reps, spr, dur: reps * spr };
}

// ---- video esterni (YouTube, Google Drive, Vimeo) -----------------------------
// Restituisce l'indirizzo da mettere in un <iframe>, oppure '' se il link non è riconosciuto.
export function embedUrl(url, { loop = false } = {}) {
  const u = String(url || '').trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    const id = m[1];
    return loop
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&modestbranding=1`
      : `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
  }
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}${loop ? '?autoplay=1&muted=1&loop=1&background=1' : ''}`;
  return '';
}
