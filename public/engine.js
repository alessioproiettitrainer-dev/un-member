// Trasforma un allenamento (fasi -> blocchi -> esercizi) in una lista lineare di step che il player esegue.
// Tipi di step: 'timed' (conto alla rovescia), 'stopwatch' (cronometro, AFAP), 'manual' (si va avanti con "Fatto").

export const BLOCK_TYPES = {
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'AFAP / For Time',
  intervals: 'Round a tempo (lavoro/recupero)',
  sets: 'Serie e ripetizioni',
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
    case 'emom': return `EMOM ${b.minutes || 0} min${(b.every || 60) !== 60 ? ` · ogni ${b.every}s` : ''}`;
    case 'amrap': return `AMRAP ${b.cap || 0} min`;
    case 'fortime': return `AFAP · ${b.rounds || 1} round${b.cap ? ` · cap ${b.cap} min` : ''}`;
    case 'intervals': return `${b.rounds || 1} round · ${b.work || 0}s lavoro / ${b.rest || 0}s recupero`;
    case 'sets': return `${b.rounds || 1} serie${b.rest ? ` · ${b.rest}s recupero` : ''}`;
    default: return '';
  }
}

// Durata stimata in secondi (gli step manuali contano 40s, l'AFAP il cap o 8 minuti).
export function estimateSeconds(workout) {
  return buildSteps(workout).reduce((t, s) => t + (s.kind === 'timed' ? s.dur : s.kind === 'stopwatch' ? (s.cap || 480) : 40), 0);
}

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
  const phases = (workout.phases || []).filter((p) => (p.blocks || []).some((b) => (b.items || []).length));
  phases.forEach((ph, pi) => {
    const blocks = ph.blocks.filter((b) => (b.items || []).length);
    blocks.forEach((b, bi) => {
      const base = { phase: ph.title || PHASE_TYPES[ph.type] || 'Workout', phaseType: ph.type, block: b.title || BLOCK_TYPES[b.type], blockType: b.type, blockKey: `${pi}.${bi}`, notes: b.notes || '' };
      const items = b.items;
      const blockSteps = [];
      if (b.type === 'emom') {
        const every = Number(b.every) || 60;
        const n = Math.max(1, Math.round(((Number(b.minutes) || 1) * 60) / every));
        const slots = emomSlots(items);
        for (let k = 0; k < n; k++) {
          blockSteps.push({ ...base, kind: 'timed', dur: every, items: slots[k % slots.length], label: every === 60 ? `MINUTO ${k + 1}` : `INTERVALLO ${k + 1}`, counter: `${k + 1}/${n}`, counterLabel: every === 60 ? 'MINUTI' : 'INTERVALLI' });
        }
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
      steps.push({ ...base, kind: 'timed', dur: GET_READY, items: blockSteps[0].items, label: 'PREPARATI', rest: true, ready: true, summary: blockSummary(b) });
      steps.push(...blockSteps);
    });
  });
  steps.forEach((s, i) => { s.index = i; });
  return steps;
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
