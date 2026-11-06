import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.clock.install();
await p.goto('http://localhost:4300/index.html');
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
let n = 0; const T = () => n / 30;
const SFX = []; const sfx = (name, dt = 0, extra = {}) => SFX.push({ name, t: +(T() + dt).toFixed(3), ...extra });
const ev = (fn, arg) => p.evaluate(fn, arg);
const show = (k, a, z = 999) => ev(([k, a, z]) => (S.show[k] = [a, z]), [k, a, z]);
const cap = (k, h) => { sfx('pop'); return ev(([t, k, h]) => setCap(t, k, h), [T(), k, h]); };
const flash = () => { sfx('whoosh', -0.12); return ev((t) => S.flash.push(t), T()); };
const punch = (s = 0.06) => ev(([t, s]) => S.punch.push([t, s]), [T(), s]);
const shot = async () => {
  await ev((t) => { render(t); const k = document.getElementById('tap'); if (+k.style.opacity > 0) { const a = (performance.now() - window.__tapAt) / 380; k.style.opacity = Math.max(0, 1 - a); k.style.transform = `translate(-50%,-50%) scale(${0.6 + a * 0.7})`; } }, T());
  await p.screenshot({ path: `frames/f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
};
const shoot = async (count, dt = 33.3) => { for (let i = 0; i < count; i++) { await shot(); await p.clock.runFor(dt); } };
const go = async (h) => { await fr().evaluate((h) => (location.hash = h), h); await p.clock.runFor(80); };
const click = async (sel) => { await F.locator(sel).first().click(); await p.clock.runFor(60); };
const tap = async (sel, after = 6, z = 0) => {
  const r = await F.locator(sel).first().boundingBox();
  await ev(([x, y]) => { const t = document.getElementById('tap'), s = document.getElementById('screen').getBoundingClientRect(); t.style.left = x - s.left + 'px'; t.style.top = y - s.top + 'px'; t.style.opacity = 1; window.__tapAt = performance.now(); }, [r.x + r.width / 2, r.y + r.height / 2]);
  sfx('tap'); if (z) await punch(z);
  await shoot(4); await click(sel); await shoot(after);
};
const type = async (sel, text) => { for (let i = 1; i <= text.length; i++) { await F.locator(sel).first().evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, text.slice(0, i)); if (i % 2 === 0 || i === text.length) { sfx('key'); await shoot(1); } } };
const voice = (f, dt = 0) => sfx('voice', dt, { f });

// 1. AGGANCIO (0-2,3 s): POV + la voce che sfotte
sfx('boom'); await show('hook', 0, 2.3); await ev((t) => setHook(t + 0.3, '9° minuto|dell’AMRAP…|quanti giri|hai fatto? 💀'), T());
for (const dt of [0, 0.3, 0.41, 0.52, 0.63, 0.74, 0.85, 0.96]) sfx('pop', dt);
voice('voce/lento-2.mp3', 1.15);
await shoot(69);
// 2. LOGO + GRATIS PER SEMPRE (2,3-3,8 s)
await flash(); sfx('impact'); await show('logo', T(), T() + 1.5); await shoot(9);
sfx('stamp'); await show('badge', T(), T() + 1.2); await shoot(36);
// 3. TELEFONO + HOME (3,8-5,5 s)
await flash(); sfx('whoosh', 0.05); await ev((t) => (S.phone.t0 = t), T()); await show('cap', T());
await cap('EMOM · AMRAP · AFAP · HIIT', 'Tutti i *timer*|che usi davvero'); await show('sticker', T() + 0.7, 24.6); sfx('stamp', 0.7, { v: 0.5 });
await shoot(42);
await tap('.pill[href="#set-emom"]', 6, 0.04);
// 4. EMOM: scrivi il workout e salva (5,5-8,7 s)
await cap('Scrivi il tuo WOD', 'Esercizi, recuperi,|*ogni* *45* *secondi*');
await tap('[data-every="45"]', 3);
await type('[data-slot="0"]', '10 Swing');
await tap('[data-addslot="0"]', 2); await type('[data-slot="1"]', '8 Burpees');
await tap('[data-addslot="1"]', 4);
await tap('#save', 3); await F.locator('#askin').evaluate((el) => (el.value = '')); await type('#askin', 'EMOM Killer'); await tap('.ask [data-a="1"]', 8, 0.05); sfx('ding', -0.2);
// 5. EMOM in corso (≈2,3 s)
await click('#go'); await click('.clock'); await p.clock.runFor(9000);
await flash(); await cap('EMOM', 'Il coach ti|*chiama* *i* *giri*'); voice('voce/via-1.mp3', 0.15);
await shoot(68, 140); sfx('beep', -0.95); sfx('beep', -0.6); sfx('beep', -0.25);
// 6. Death EMOM (≈2,2 s)
await go('#set-emom'); await click('[data-death="1"]'); await F.locator('[data-slot="0"]').evaluate((el) => { el.value = 'Burpees'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await F.locator('[data-rm="2"]').click().catch(() => {}); await F.locator('[data-rm="1"]').click().catch(() => {}); await p.clock.runFor(60);
await click('#go'); await click('.clock'); await p.clock.runFor(45 * 6 * 1000 + 30000);
await flash(); await cap('Death EMOM 💀', 'Round infiniti,|*finché* *non* *molli*'); voice('voce/afap-2.mp3', 0.5); await punch(0.05);
await shoot(64, 100);
// 7. AMRAP: +1 giro e fine
await go('#set-amrap'); await click('#go'); await click('.clock');
for (const t of [62, 58, 60, 55, 57]) { await p.clock.runFor(t * 1000); await click('#plus'); }
await p.clock.runFor(40000);
await flash(); await cap('AMRAP', 'Premi *+1* *giro,*|al resto ci penso io'); await shoot(16, 100);
voice('voce/veloce-1.mp3', 0.2); await tap('#plus', 26, 0.07); sfx('ding', -0.7);
await click('#skip'); await p.clock.runFor(300);
await flash(); sfx('impact', 0, { v: 0.6 }); await cap('Alla fine', 'Giri, tempi e|*giro* *a* *metà*'); voice('voce/fine-2.mp3', 0.25); await punch(0.06);
await shoot(14); await tap('[data-pa="0"]', 20);
// 8. AFAP
await go('#set-afap'); await click('#go'); await click('.clock'); await p.clock.runFor(180000);
await flash(); await cap('AFAP', 'Segna, spunta,|*chiudi*'); await shoot(8, 100);
await tap('[data-add="0"][data-v="10"]', 3); await tap('[data-add="0"][data-v="10"]', 3); await tap('[data-ok="1"]', 4); voice('voce/esultimo-1.mp3', 0.1); await tap('[data-ok="0"]', 16, 0.05);
// 9. HIIT
await go('#set-it'); await click('#go'); await click('.clock'); await p.clock.runFor(30 * 1000 * 12 + 90000 + 4000);
await flash(); await cap('HIIT · Tabata', '6 Tabata di fila?|*Fatto.*'); voice('voce/sec10-1.mp3', 0.4); await punch(0.05);
await shoot(44, 120); sfx('beep', -0.7); sfx('beep', -0.42); sfx('beep', -0.14);
// 10. Salvati + diario
await go('#salvati'); await flash(); await cap('Salva tutto', 'I tuoi timer,|*sempre* *pronti*'); await shoot(36);
await go('#diario'); await flash(); await cap('Diario automatico', 'Ogni workout,|*data* *e* *risultato*'); await shoot(38);
// 11. lingua
await go('#impostazioni'); await flash(); await cap('Romano 🇮🇹 o English 🇺🇸', 'Il coach parla|*come* *te*'); await shoot(10);
voice('voce/en/via-1.mp3', 0.15); await tap('[data-l="en"]', 18, 0.04); await click('[data-l="rm"]');
// 12. GRATIS PER SEMPRE
await ev((t) => { S.phone.out = t; S.show.sticker[1] = t + 0.2; }, T()); sfx('whoosh'); await show('cap', 0, T()); await shoot(8);
await flash(); sfx('impact'); await show('free', T(), T() + 3.3);
sfx('stamp', 0.45); sfx('pop', 1.0); sfx('pop', 1.28); sfx('pop', 1.56);
await shoot(99);
// 13. FINALE: beta tester
sfx('riser', -1.6); await flash(); sfx('impact', 0, { v: 1.2 }); await show('final', T()); voice('voce/fine-1.mp3', 0.6);
sfx('pop', 0.45); sfx('pop', 0.75); sfx('stamp', 1.05);
await shoot(105);
fs.writeFileSync('timeline.json', JSON.stringify({ dur: T(), sfx: SFX }, null, 1));
console.log('fotogrammi', n, 'secondi', T().toFixed(2), 'effetti', SFX.length, 'errori', errs);
await b.close();
