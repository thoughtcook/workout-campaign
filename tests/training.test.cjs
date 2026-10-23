const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../training-core');
const {Store,KEY}=require('../journal-store');
const ready={sleep:7,energy:4,soreness:0,pain:'none'};
const at='2026-10-23T06:18:00+08:00';
function session(date='2026-10-20T06:18:00+08:00',planId='upper-a'){
 const p=T.plans.find(p=>p.id===planId);
 return {id:date+'-'+planId,date,updatedAt:date,planId,status:'completed',readiness:{...ready},duration:50,cardioMinutes:16,mobilityMinutes:8,note:'',exercises:p.exercises.map(d=>{const e=T.makeExercise(d,[],date,ready,true);e.equipment='test station';e.form='good';e.pain='none';e.sets=e.sets.map(()=>({load:e.loadUnit==='body'?0:20,value:e.targetHigh,rir:3,done:true}));return e;})};
}
function history(){return [session('2026-10-16T06:18:00+08:00'),session()];}
function suggestion(list=history(),r=ready,e=list.at(-1).exercises[0]){return T.recommend(e,list,at,r).action;}
function memory(initial=null){let value=initial;return {getItem:()=>value,setItem:(_k,v)=>{value=v;},get raw(){return value;}};}

test('first workout starts upper A with adaptation; no synthetic history',()=>{const n=T.nextPlan([],at,ready);assert.equal(n.plan.id,'upper-a');assert.equal(n.adaptation,true);assert.equal(T.makeExercise(T.plans[0].exercises[0],[],at,ready,true).sets.length,2);});
test('completed workout advances sequence; partial and recovery do not',()=>{const s=session();assert.equal(T.nextPlan([s],at,ready).plan.id,'lower-a');s.status='partial';assert.equal(T.nextPlan([s],at,ready).plan.id,'upper-a');});
test('pain takes priority over sleep and progression',()=>{assert.equal(T.nextPlan([],at,{...ready,pain:'yes',sleep:5}).mode,'stop');assert.equal(suggestion(history(),{...ready,pain:'yes'}),'暂停');});
test('fatigue reduces targets without raising loads',()=>{const r={...ready,sleep:5};assert.equal(T.makeExercise(T.plans[0].exercises[0],[],at,r,true).targetSets,1);assert.equal(suggestion(history(),r),'减量');});
test('recent actual work asks for recovery; empty partial does not',()=>{const s=session('2026-10-23T05:00:00+08:00');s.status='partial';assert.equal(T.nextPlan([s],at,ready).mode,'rest');s.exercises.forEach(e=>e.sets.forEach(x=>{x.done=false;}));assert.equal(T.nextPlan([s],at,ready).mode,'normal');});
test('same body region within 48h produces rest recommendation',()=>{const s=session('2026-10-22T06:18:00+08:00');s.status='partial';assert.equal(T.nextPlan([s],at,ready).mode,'rest');});
test('two qualifying comparable sessions allow smallest increment',()=>assert.equal(suggestion(),'可加一档'));
test('one success is insufficient',()=>assert.equal(suggestion([session()]),'维持'));
test('same-day repeats do not count as two successes',()=>assert.equal(suggestion([session('2026-10-20T06:00:00+08:00'),session()]),'维持'));
test('equipment, variation and load units remain isolated',()=>{const h=history();for(const field of ['equipment','variant','loadUnit']){const e=T.clone(h[1].exercises[0]);e[field]=field==='loadUnit'?'per-hand':'different';assert.equal(suggestion(h,ready,e),'建立基线');}});
test('missing RIR and incomplete readiness prevent progression',()=>{const h=history();h[1].exercises[0].sets[0].rir=null;assert.equal(suggestion(h),'维持');assert.equal(suggestion(history(),{...ready,sleep:null}),'维持');});
test('poor form and failure suggest easing difficulty',()=>{const h=history();h[1].exercises[0].form='poor';assert.equal(suggestion(h),'减轻难度');h[1].exercises[0].form='good';h[1].exercises[0].sets[0].rir=0;assert.equal(suggestion(h),'减轻难度');});
test('pain in latest partial session blocks stale successful history',()=>{const h=history(),s=session('2026-10-21T06:18:00+08:00');s.status='partial';s.exercises[0].pain='yes';h.push(s);assert.equal(suggestion(h),'先评估');});
test('different weights, goals or missing target sets cannot qualify',()=>{for(const change of [e=>{e.sets[0].load=15;},e=>{e.targetLow=7;},e=>{e.targetSets=3;}]){const h=history();change(h[0].exercises[0]);assert.notEqual(suggestion(h),'可加一档');}});
test('seconds, assistance and band resistance never suggest weight increase',()=>{for(const u of ['body','assistance','band']){const h=history();h.forEach(s=>s.exercises[0].loadUnit=u);assert.notEqual(suggestion(h),'可加一档');}const h=history();h.forEach(s=>s.exercises[0].metric='seconds');assert.notEqual(suggestion(h),'可加一档');});
test('stale records require reacclimatisation; future records ignored',()=>{assert.equal(suggestion([session('2026-09-01T06:18:00+08:00')]),'重新适应');const h=history();h.push(session('2026-10-25T06:18:00+08:00'));assert.equal(T.nextPlan(h,at,ready).plan.id,'lower-a');});
test('no completed status with missing exercises, missing values or unchecked sets',()=>{let s=session();s.exercises.pop();assert.throws(()=>T.validateSession(s));s=session();s.exercises[0].sets[0].value=null;assert.throws(()=>T.validateSession(s));s=session();s.exercises[0].sets[0].done=false;assert.throws(()=>T.validateSession(s));s.status='partial';assert.doesNotThrow(()=>T.validateSession(s));});
test('reps cannot be fractional; seconds and kg remain distinct',()=>{const s=session();s.exercises[0].sets[0].value=10.5;assert.throws(()=>T.validateSession(s));s.exercises[0].metric='seconds';assert.doesNotThrow(()=>T.validateSession(s));});
test('invalid calendar date, missing zone and unsupported plan rejected',()=>{for(const date of ['2026-02-30T06:18:00+08:00','2026-10-20T06:18:00','not-a-date']){const s=session();s.date=date;assert.throws(()=>T.validateSession(s));}});
test('backup round-trip preserves sets, readiness, notes and draft',()=>{const s=T.fresh();s.sessions=[session()];s.sessions[0].note='<script>untrusted text</script>';s.draft=T.clone(session('2026-10-22T06:18:00+08:00'));assert.deepEqual(T.validateState(JSON.parse(JSON.stringify(s))),s);});
test('duplicate imports are idempotent; existing edits not overwritten',()=>{const a=T.fresh();a.sessions=[session()];const b=T.clone(a);b.sessions[0].note='incoming edit';const merged=T.mergeBackup(a,b);assert.equal(merged.added,0);assert.equal(merged.skipped,1);assert.equal(merged.state.sessions[0].note,'');});
test('invalid batch never partially changes current state',()=>{const a=T.fresh(),b=T.fresh();b.sessions=[session()];b.sessions[0].duration=900;assert.throws(()=>T.mergeBackup(a,b));assert.equal(a.sessions.length,0);});
test('trash and saved records cannot duplicate IDs',()=>{const a=T.fresh();a.sessions=[session()];a.trash=[session()];assert.throws(()=>T.validateState(a));});
test('weeks start Monday in Singapore, including UTC boundary',()=>{assert.equal(T.weekKey('2026-10-25T23:30:00Z'),'2026-10-26');assert.equal(T.dateKey('2026-10-23T18:00:00Z'),'2026-10-24');});
test('stats count only completed sessions, actual checked sets and recorded minutes',()=>{const s=session();s.status='partial';s.exercises[0].sets[0].done=false;const w=T.weekly([s],at).at(-1);assert.equal(w.strength,0);assert.equal(w.sets,9);assert.equal(w.cardio,16);assert.equal(w.mobility,8);assert.equal(T.weekly([session('2026-10-23T20:00:00+08:00')],at).at(-1).sets,0);});
test('durable store restores saved data and draft on reload',()=>{const m=memory(),a=new Store(m);a.change(s=>{s.draft=session();});const b=new Store(m);assert.equal(b.state.draft.id,a.state.draft.id);b.change(s=>{s.sessions.push(s.draft);s.draft=null;});assert.equal(new Store(m).state.sessions.length,1);});
test('quota failure does not falsely advance in-memory state',()=>{const m=memory(),s=new Store(m);m.setItem=()=>{throw new Error('quota');};assert.throws(()=>s.change(x=>x.sessions.push(session())));assert.equal(s.state.sessions.length,0);assert.equal(s.raw,null);});
test('corrupt existing data is preserved and never overwritten',()=>{const m=memory('{broken'),s=new Store(m);assert.ok(s.error);assert.throws(()=>s.save(T.fresh()));assert.equal(m.raw,'{broken');assert.equal(s.raw,'{broken');});
test('two tabs cannot silently overwrite each other',()=>{const m=memory(),a=new Store(m),b=new Store(m);a.change(s=>{s.sessions.push(session());});assert.throws(()=>b.change(s=>{s.sessions.push(session('2026-10-22T06:18:00+08:00'));}),/另一页面/);assert.equal(JSON.parse(m.raw).sessions.length,1);});
test('archive / restore recomputes progression without deleting the session',()=>{const m=memory(),s=new Store(m);s.change(x=>{x.sessions.push(session());});s.change(x=>{x.trash.push(x.sessions.pop());});assert.equal(T.nextPlan(s.state.sessions,at,ready).plan.id,'upper-a');s.change(x=>{x.sessions.push(x.trash.pop());});assert.equal(T.nextPlan(s.state.sessions,at,ready).plan.id,'lower-a');});
