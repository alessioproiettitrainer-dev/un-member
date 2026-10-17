// Crea dati di esempio se il database è vuoto: node seed.js
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'data', 'db.json');
if (fs.existsSync(file) && process.argv[2] !== '--force') { console.log('db.json esiste già (usa --force per ricrearlo)'); process.exit(0); }

const ex = (id, name, category, cues, extra = {}) => ({ id, name, category, cues, video: '', repsInVideo: '', secPerRep: 2, easierId: '', harderId: '', ...extra });
const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const monday = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 864e5 - 7 * 864e5); // il ciclo è partito lunedì scorso
const exercises = [
  ex('swing', 'Kettlebell Swing', 'Swing', 'Spingi l\'anca, glutei contratti in alto, braccia rilassate', { video: '/demo-swing.mp4', secPerRep: 1.4, easierId: 'kb-dl', harderId: 'swing-1' }),
  ex('kb-dl', 'Stacco con kettlebell', 'Hinge', 'Schiena neutra, porta indietro l\'anca'),
  ex('swing-1', 'Swing a una mano', 'Swing', 'Non ruotare il busto, spalla bloccata', { secPerRep: 1.2 }),
  ex('goblet', 'Goblet Squat', 'Squat', 'Gomiti dentro, petto alto, scendi tra le gambe', { secPerRep: 2.5, easierId: 'air-sq', harderId: 'front-sq' }),
  ex('air-sq', 'Squat a corpo libero', 'Squat', 'Peso sui talloni'),
  ex('front-sq', 'Front Squat doppio kettlebell', 'Squat', 'Rack stabile, core attivo'),
  ex('pushup', 'Push-up', 'Spinta', 'Corpo in linea, gomiti a 45°', { secPerRep: 1.5, easierId: 'pushup-k' }),
  ex('pushup-k', 'Push-up sulle ginocchia', 'Spinta', '', { secPerRep: 1.5 }),
  ex('clean', 'Clean', 'Swing', 'Porta il kettlebell vicino al corpo, niente botta sull\'avambraccio'),
  ex('press', 'Military Press', 'Spinta', 'Glutei contratti, non inarcare la schiena'),
  ex('halo', 'Halo', 'Mobilità', 'Movimento lento, busto fermo'),
  ex('hinge', 'Hip hinge a corpo libero', 'Mobilità', 'Mani sulle anche, spingi indietro'),
  ex('jj', 'Jumping Jack', 'Cardio', ''),
  ex('plank', 'Plank', 'Core', 'Glutei e addome contratti'),
  ex('hipflex', 'Stretching flessori dell\'anca', 'Mobilità', 'Respira profondo'),
  ex('catcow', 'Cat-Cow', 'Mobilità', 'Segui il respiro'),
];
const it = (exerciseId, reps = '', extra = {}) => ({ exerciseId, reps, notes: '', ...extra });
const programs = [{
  id: 'base', title: 'Kettlebell Base', subtitle: '8 settimane per costruire forza e bruciare grasso con un solo kettlebell',
  level: 'Principiante', weeks: 8, cover: '', published: true,
  description: '3 allenamenti a settimana da 30–40 minuti. Impari i movimenti base (swing, goblet squat, clean, press) e alzi l\'intensità settimana dopo settimana.',
  workouts: [
    { id: 'w1', title: 'Full Body EMOM', week: 1, description: 'EMOM + AMRAP finale', phases: [
      { id: 'p1', type: 'warmup', title: 'Riscaldamento', blocks: [{ id: 'b1', type: 'intervals', title: 'Attivazione', rounds: 1, work: 40, rest: 10, restRounds: 0, notes: '', items: [it('jj'), it('hinge'), it('halo'), it('air-sq')] }] },
      { id: 'p2', type: 'workout', title: 'Workout', blocks: [
        { id: 'b2', type: 'emom', title: 'Swing & Squat', minutes: 12, every: 60, notes: 'Il tempo che avanza nel minuto è il tuo recupero', items: [it('swing', '15'), it('goblet', '10'), it('pushup', '8', { samePrev: true })] },
        { id: 'b3', type: 'amrap', title: 'Finisher', cap: 6, notes: 'Più round possibili, tecnica sempre pulita', items: [it('clean', '5 + 5'), it('press', '5 + 5'), it('swing', '10')] },
      ] },
      { id: 'p3', type: 'cooldown', title: 'Defaticamento', blocks: [{ id: 'b4', type: 'intervals', title: 'Stretching', rounds: 1, work: 45, rest: 5, restRounds: 0, notes: '', items: [it('hipflex'), it('catcow'), it('plank')] }] },
    ] },
    { id: 'w2', title: 'Forza & AFAP', week: 1, description: 'Serie classiche + sfida a tempo', phases: [
      { id: 'p4', type: 'warmup', title: 'Riscaldamento', blocks: [{ id: 'b5', type: 'intervals', title: 'Attivazione', rounds: 2, work: 30, rest: 10, restRounds: 20, notes: '', items: [it('halo'), it('hinge'), it('jj')] }] },
      { id: 'p5', type: 'workout', title: 'Forza', blocks: [{ id: 'b6', type: 'sets', title: 'Goblet Squat pesante', rounds: 4, rest: 90, notes: 'Ultime 2 ripetizioni dure', items: [it('goblet', '8')] }] },
      { id: 'p6', type: 'workout', title: 'Condizionamento', blocks: [{ id: 'b7', type: 'fortime', title: 'AFAP', rounds: 3, cap: 12, notes: '3 round il più veloce possibile', items: [it('swing', '20'), it('goblet', '15'), it('pushup', '10')] }] },
      { id: 'p7', type: 'cooldown', title: 'Defaticamento', blocks: [{ id: 'b8', type: 'intervals', title: 'Stretching', rounds: 1, work: 45, rest: 5, restRounds: 0, notes: '', items: [it('hipflex'), it('catcow')] }] },
    ] },
  ],
}];
programs[0].kind = 'base';
// Ciclo di 4 settimane che cambia: stessa struttura, volume che sale ogni settimana
const cycleWeek = (n) => ({ id: `c${n}`, title: `Ciclo · Giorno A`, week: n, description: `Settimana ${n}`, phases: [
  { id: `c${n}p1`, type: 'warmup', title: 'Riscaldamento', blocks: [{ id: `c${n}b1`, type: 'intervals', title: 'Attivazione', rounds: 1, work: 30, rest: 10, restRounds: 0, notes: '', items: [it('halo'), it('hinge'), it('jj')] }] },
  { id: `c${n}p2`, type: 'workout', title: 'Workout', blocks: [{ id: `c${n}b2`, type: 'amrap', title: 'AMRAP', cap: 10 + n * 2, notes: '', items: [it('swing', String(10 + n * 5)), it('goblet', '10'), it('pushup', '10')] }] },
  { id: `c${n}p3`, type: 'cooldown', title: 'Defaticamento', blocks: [{ id: `c${n}b3`, type: 'intervals', title: 'Stretching', rounds: 1, work: 45, rest: 5, restRounds: 0, notes: '', items: [it('hipflex'), it('catcow')] }] },
] });
programs.push({ id: 'ciclo1', kind: 'cycle', startDate: iso(monday), title: 'Ciclo Swing Power', subtitle: '4 settimane, poi arriva il ciclo nuovo', level: 'Intermedio', weeks: 4, cover: '', published: true,
  description: 'Il programma che cambia ogni 4 settimane: AMRAP con volume crescente.', workouts: [1, 2, 3, 4].map(cycleWeek) });

const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
const challenges = [
  { id: 'ch1', title: '100 push-up al giorno', description: 'Anche spezzati durante la giornata. Segna ogni serie che fai.', unit: 'push-up', dailyTarget: 100, start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(end), published: true },
  { id: 'ch2', title: '8.000 passi', description: 'Muoviti ogni giorno: camminata dopo cena, scale al posto dell\'ascensore.', unit: 'passi', dailyTarget: 8000, start: '', end: '', published: true },
];
const tips = [
  { id: 't1', title: 'Proteine a ogni pasto', text: 'Punta a una fonte di proteine in ogni pasto: uova, yogurt greco, carne, pesce, legumi. Ti aiuta a recuperare e a tenere a bada la fame.', image: '', start: '', end: '', published: true },
  { id: 't2', title: 'Dormi 7–8 ore', text: 'Il recupero è allenamento. Stessa ora a letto, telefono lontano, camera fresca e buia.', image: '', start: '', end: '', published: true },
];
const settings = { appName: 'UN-MEMBER', logo: '', tagline: 'Allenati ovunque. Fai parte del team.' };
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ settings, exercises, programs, tips, challenges, users: [], sessions: {} }, null, 2));
console.log('Dati di esempio creati in data/db.json');
