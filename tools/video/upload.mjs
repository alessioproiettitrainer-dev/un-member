// carica le clip 4:3 sul server vero: sostituisce i video degli esercizi esistenti o crea quelli nuovi
import fs from 'node:fs';
const B = 'https://un-member.onrender.com', K = process.env.K, H = { 'x-admin-key': K };
const [, , planFile] = process.argv;
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const api = async (m, p, body) => { for (let t = 0; t < 5; t++) { const r = await fetch(B + p, { method: m, headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const tx = await r.text(); try { return JSON.parse(tx); } catch { await new Promise((s) => setTimeout(s, 5000)); } } throw new Error('api ' + p); };
const exs = await api('GET', '/api/admin/exercises');
for (const it of plan) {
  let ex = it.id ? exs.find((e) => e.id === it.id) : null;
  if (it.id && !ex) { console.log('MANCA', it); continue; }
  if (ex) for (const f of ['video', 'videoBox']) if (ex[f]?.startsWith('/uploads/')) {
    const dst = `/home/user/vids/backup/${ex.id}-${f}-${ex[f].split('/').pop()}`;
    if (!fs.existsSync(dst)) fs.writeFileSync(dst, Buffer.from(await (await fetch(B + ex[f])).arrayBuffer()));
  }
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(it.file)], { type: 'video/mp4' }), 'clip.mp4');
  let up; for (let t = 0; t < 5 && !up; t++) { const r = await fetch(B + '/api/admin/upload?raw=1', { method: 'POST', headers: H, body: fd }); try { up = JSON.parse(await r.text()); } catch { await new Promise((s) => setTimeout(s, 8000)); } }
  if (!ex) ex = await api('POST', '/api/admin/exercises', { name: it.name, category: it.category || '' });
  const upd = { ...ex, video: up.url, videoBox: up.url, ...(it.secPerRep !== undefined ? { secPerRep: it.secPerRep } : {}), ...(it.repsInVideo !== undefined ? { repsInVideo: it.repsInVideo } : {}) };
  const saved = await api('PUT', `/api/admin/exercises/${ex.id}`, upd);
  console.log(it.id ? 'SOSTITUITO' : 'NUOVO', saved.id, saved.name, saved.video, saved.secPerRep ?? '', up.after);
}
