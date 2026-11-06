import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.clock.install();
await p.goto('http://localhost:4200/index.html');
// dati di esempio (inventati) per timer salvati e diario
await p.evaluate(() => {
  const d = (dd, h, m) => new Date(2026, 10, dd, h, m).getTime();
  localStorage.setItem('ut_opts', JSON.stringify({ voice: true, beep: true, prep: 10, lang: 'rm' }));
  localStorage.setItem('ut_cfg_emom', JSON.stringify({ every: 60, rounds: 8, slots: [{ text: '', rest: false }], death: false, start: 1, step: 1 }));
  localStorage.setItem('ut_cfg_amrap', JSON.stringify({ minutes: 12, items: [{ name: 'Swing', reps: 10 }, { name: 'Push Up', reps: 10 }, { name: 'Goblet Squat', reps: 10 }] }));
  localStorage.setItem('ut_cfg_afap', JSON.stringify({ cap: 20, items: [{ name: 'Burpees', reps: 100 }, { name: 'Swing', reps: 50 }, { name: 'Pull Up', reps: 30 }] }));
  localStorage.setItem('ut_cfg_it', JSON.stringify({ work: 20, rest: 10, rounds: 8, sets: 6, setRest: 60 }));
  localStorage.setItem('ut_saved', JSON.stringify([{ name: '6 Tabata', m: 'it', c: { work: 20, rest: 10, rounds: 8, sets: 6, setRest: 60 } }, { name: 'Death by Burpees', m: 'emom', c: { every: 60, rounds: 10, slots: [{ text: 'Burpees', rest: false }], death: true, start: 1, step: 1 } }]));
  localStorage.setItem('ut_log', JSON.stringify([
    { id: d(5, 18, 40), m: 'it', c: { work: 20, rest: 10, rounds: 8, sets: 6, setRest: 60 }, title: '6 Tabata', res: 'Completato', dur: 1260, laps: [], items: [] },
    { id: d(4, 7, 15), m: 'emom', c: { every: 60, rounds: 10, slots: [{ text: 'Burpees', rest: false }], death: true, start: 1, step: 1 }, title: 'Death by Burpees', res: '14 round · ultimo a 14 rip', dur: 840, laps: [], items: [] },
    { id: d(3, 19, 5), m: 'afap', c: { cap: 20, items: [{ name: 'Burpees', reps: 100 }] }, title: '', res: '8:42', dur: 522, laps: [], items: [{ name: 'Burpees', reps: 100, n: 100, ok: true }] },
  ]));
});
await p.reload(); await p.clock.runFor(2500); await p.evaluate(() => document.fonts.ready);
const F = p.frameLocator('#f');
const fr = () => p.frames().find((x) => x.url().includes('/app/'));
const go = async (h) => { await fr().evaluate((h) => (location.hash = h), h); await p.clock.runFor(80); };
const click = async (sel) => { await F.locator(sel).first().click(); await p.clock.runFor(60); };
const top = (k, h) => p.evaluate(([k, h]) => { document.getElementById('k').textContent = k; document.getElementById('h').innerHTML = h; document.getElementById('top').style.opacity = h ? 1 : 0; }, [k, h]);
const set = (id, v) => p.evaluate(([id, v]) => (document.getElementById(id).style.opacity = v), [id, v]);
let n = 0;
const shot = async () => {
  await p.evaluate(() => { const t = document.getElementById('tap'); if (+t.style.opacity > 0) { const a = (performance.now() - window.__tapAt) / 380; t.style.opacity = Math.max(0, 1 - a); t.style.transform = `translate(-50%,-50%) scale(${0.6 + a * 0.7})`; } });
  await p.screenshot({ path: `frames/f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
};
const shoot = async (count, dt = 33.3) => { for (let i = 0; i < count; i++) { await shot(); await p.clock.runFor(dt); } };
const tap = async (sel, after = 6) => {
  const r = await F.locator(sel).first().boundingBox();
  await p.evaluate(([x, y]) => { const t = document.getElementById('tap'), s = document.getElementById('screen').getBoundingClientRect(); t.style.left = x - s.left + 'px'; t.style.top = y - s.top + 'px'; t.style.opacity = 1; window.__tapAt = performance.now(); }, [r.x + r.width / 2, r.y + r.height / 2]);
  await shoot(4); await click(sel); await shoot(after);
};
const type = async (sel, text) => { // scrive lettera per lettera
  for (let i = 1; i <= text.length; i++) {
    await F.locator(sel).first().evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, text.slice(0, i));
    if (i % 2 === 0 || i === text.length) await shoot(1);
  }
};
const marks = {}; const mark = (k) => (marks[k] = +(n / 30).toFixed(2));

// 1. telefono spento → si accende
await top('', '');
await shoot(12); mark('pronti');
for (let i = 0; i < 18; i++) { await set('off', 1 - i / 17); await shoot(1); }
await top('Nuova app gratis', 'UN-TIMER'); await shoot(30);
// 2. home → EMOM
await top('EMOM · AMRAP · AFAP · HIIT', 'Tutti i timer<br>che usi davvero'); await shoot(24);
await tap('.pill[href="#set-emom"]', 8);
// 3. EMOM: esercizi + recupero + salva
await top('Ogni 45 secondi, i tuoi esercizi', 'Scrivi il<br>tuo workout');
await tap('[data-every="45"]', 4);
await type('[data-slot="0"]', '10 Swing');
await tap('[data-addslot="0"]', 2); await type('[data-slot="1"]', '8 Burpees');
await tap('[data-addslot="1"]', 6);
await tap('#save', 4); await F.locator('#askin').evaluate((el) => (el.value = '')); await type('#askin', 'EMOM Killer'); await tap('.ask [data-a="1"]', 10);
// 4. EMOM in corso (accelerato)
await click('#go'); await click('.clock'); await p.clock.runFor(9000);
await top('EMOM', 'Il coach<br>ti chiama i giri'); mark('via'); await shoot(70, 140);
// 5. Death EMOM
await go('#set-emom'); await click('[data-death="1"]'); await F.locator('[data-slot="0"]').evaluate((el) => { el.value = 'Burpees'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await F.locator('[data-rm="2"]').click().catch(() => {}); await F.locator('[data-rm="1"]').click().catch(() => {}); await p.clock.runFor(60);
await top('Death EMOM', 'Round infiniti,<br>finché non molli'); await shoot(14);
await click('#go'); await click('.clock'); await p.clock.runFor(45 * 6 * 1000 + 30000);
mark('nonna'); await shoot(56, 100);
// 6. AMRAP + fine
await go('#set-amrap'); await click('#go'); await click('.clock');
for (const t of [62, 58, 60, 55, 57]) { await p.clock.runFor(t * 1000); await click('#plus'); }
await p.clock.runFor(40000);
await top('AMRAP', 'Premi +1 giro,<br>lui ti sprona'); await shoot(16, 100);
mark('vola'); await tap('#plus', 40);
await click('#skip'); await p.clock.runFor(300);
await top('Alla fine', 'Giri, tempi<br>e giro a metà'); mark('bestia'); await shoot(14);
await tap('[data-pa="0"]', 30);
// 7. AFAP
await go('#set-afap'); await click('#go'); await click('.clock'); await p.clock.runFor(180000);
await top('AFAP', 'Segna, spunta,<br>chiudi'); await shoot(10, 100);
await tap('[data-add="0"][data-v="10"]', 3); await tap('[data-add="0"][data-v="10"]', 3); await tap('[data-ok="1"]', 6); mark('ultimoes'); await tap('[data-ok="0"]', 16);
// 8. HIIT
await go('#set-it'); await top('HIIT · Tabata', '6 Tabata di fila?<br>Fatto.'); await shoot(16);
await click('#go'); await click('.clock'); await p.clock.runFor(30 * 1000 * 12 + 90000 + 4000);
mark('spigni'); await shoot(44, 120);
// 9. I miei timer + diario
await go('#salvati'); await top('Salva i tuoi timer', 'Sempre pronti<br>a partire'); await shoot(42);
await go('#diario'); await top('Diario automatico', 'Ogni workout,<br>data e risultato'); await shoot(48);
// 10. lingua
await go('#impostazioni'); await top('Romano o English', 'Il coach parla<br>come te'); await shoot(12);
mark('letsgo'); await tap('[data-l="en"]', 14); await click('[data-l="rm"]');
// 11. finale
mark('final');
for (let i = 0; i < 105; i++) { await set('final', Math.min(1, i / 8)); await shot(); }
console.log(JSON.stringify(marks)); console.log('fotogrammi', n, 'secondi', (n / 30).toFixed(1), 'errori', errs);
await b.close();
