// reupload.mjs cartella plan.json [plan2.json...]: ricarica le clip rifatte (prese da cartella, stesso nome file) sugli stessi esercizi, cambia solo il video
import fs from 'node:fs';
const B = 'https://un-member.onrender.com', H = { 'x-admin-key': process.env.K };
const REN = { 'In Curl TRX': 'Hammer Curl TRX', 'Leg Press TRX': 'Sissy Squat TRX', 'Crunch TRX': 'Standing Rollout TRX', 'Atomic Sit Up TRX': 'Knee Tuck TRX', 'Y TRX': 'Y Fly TRX', 'T TRX': 'T Fly TRX', 'Back T. Lunge': 'Back Lunge', 'Front T. Lunge': 'Front Lunge', 'Quad Press': 'Quod Press' };
const api = async (m, p, body) => { for (let t = 0; t < 6; t++) { try { const r = await fetch(B + p, { method: m, headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return JSON.parse(await r.text()); } catch { await new Promise((s) => setTimeout(s, 6000)); } } throw new Error('api ' + p); };
const exs = await api('GET', '/api/admin/exercises');
const [DIR, ...PLANS] = process.argv.slice(2);
for (const f of PLANS) for (const it of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const file = `${DIR}/${it.file.split('/').pop()}`;
  if (!fs.existsSync(file)) { console.log('MANCA CLIP', file); continue; }
  const name = it.name && (REN[it.name] || it.name);
  const ex = it.id ? exs.find((e) => e.id === it.id) : exs.find((e) => e.name === name);
  if (!ex) { console.log('MANCA ESERCIZIO', it.id || name); continue; }
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), 'clip.mp4');
  let up; for (let t = 0; t < 6 && !up?.url; t++) { try { up = JSON.parse(await (await fetch(B + '/api/admin/upload?raw=1', { method: 'POST', headers: H, body: fd })).text()); } catch { await new Promise((s) => setTimeout(s, 8000)); } }
  const cur = (await api('GET', '/api/admin/exercises')).find((e) => e.id === ex.id);
  await api('PUT', `/api/admin/exercises/${ex.id}`, { ...cur, video: up.url, videoBox: up.url });
  console.log('OK', ex.name);
}
