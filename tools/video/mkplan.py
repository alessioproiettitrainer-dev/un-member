# mkplan.py pick.json clipdir out.json [categoria per i nuovi]: abbina per nome agli esercizi (ex.json scaricato dal server)
import json,sys
ex={e['name'].lower():e for e in json.load(open('/home/user/vids/ex.json'))}
pick,clipdir,out=sys.argv[1:4]; cat=sys.argv[4] if len(sys.argv)>4 else ''
plan=[]
for p in json.load(open(pick)):
    if p.get('skip'): continue
    d={'file':f"{clipdir}/{p['name']}.mp4"}; e=ex.get(p['name'].lower())
    if e: d['id']=e['id']
    else: d['name']=p['name']; d['category']=p.get('category',cat)
    if not p.get('hold') and (not e or not e.get('secPerRep')):
        d['secPerRep']=p['period']; d['repsInVideo']=max(1,round((p['end']-p['start'])/p['period']))
    plan.append(d); print('ESISTE ' if e else 'NUOVO  ',p['name'],d.get('secPerRep',''))
json.dump(plan,open(out,'w'))
