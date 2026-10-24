(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Training = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ZONE = 'Asia/Singapore';
  const exercise = (id, name, sets, low, high, unit, cue, alternatives = []) => ({id, name, sets, low, high, unit, cue, alternatives});
  const plans = [
    {id:'upper-a', name:'上肢 A', region:'upper', focus:'水平推拉 · 核心稳定', exercises:[
      exercise('chest-press','器械胸推',3,8,12,'machine','背部贴稳，控制下放。',['哑铃卧推']),
      exercise('seated-row','坐姿划船',3,8,12,'machine','不借腰后仰。',['胸托哑铃划船']),
      exercise('pulldown','高位下拉',2,10,12,'machine','向胸前下拉，不做颈后下拉。',['辅助引体向上']),
      exercise('lateral-raise','哑铃侧平举',2,12,15,'per-hand','轻重量，避免耸肩。',['绳索侧平举']),
      exercise('pallof','Pallof 抗旋转推',2,8,10,'machine','每侧完成目标次数算一组，躯干不旋转。',['屈膝侧平板'])
    ]},
    {id:'lower-a', name:'下肢 A', region:'lower', focus:'蹲的基础 · 臀腿发力', exercises:[
      exercise('leg-press','腿举',3,10,12,'machine','脚跟踩稳，在骨盆不卷起的范围内下降。',['高脚杯深蹲']),
      exercise('bridge','地面臀桥',3,10,12,'body','伸髋收臀，不靠腰后仰。',['器械臀推']),
      exercise('leg-curl','腿弯举',2,10,15,'machine','控制下放，骨盆保持稳定。',['滑垫腿弯举']),
      exercise('calf','提踵',2,12,15,'body','扶稳支撑，脚踝缓慢升降。',['器械提踵']),
      exercise('bird-dog','鸟狗式',2,6,6,'body','每侧 6 次，每次停 3 秒，不塌腰。',['仅伸手的鸟狗式'])
    ]},
    {id:'upper-b', name:'上肢 B', region:'upper', focus:'上斜推胸 · 背部与手臂', exercises:[
      exercise('incline-press','上斜哑铃推胸',3,8,12,'per-hand','肩部舒适，不过度挺腰。',['上斜器械推胸']),
      exercise('pulldown','高位下拉',3,8,12,'machine','不甩动躯干。',['辅助引体向上']),
      exercise('supported-row','胸托划船',2,10,12,'per-hand','胸部贴稳支撑。',['坐姿划船']),
      exercise('pressdown','绳索下压',2,10,15,'machine','上臂保持稳定。'),
      exercise('curl','哑铃弯举',2,10,15,'per-hand','避免摆腰借力。',['绳索弯举'])
    ]},
    {id:'lower-b', name:'下肢 B', region:'lower', focus:'髋铰链 · 单腿控制', exercises:[
      exercise('goblet','高脚杯深蹲',3,8,12,'total','只到舒适深度。',['腿举']),
      exercise('hinge','地面臀桥',2,10,12,'body','先用臀桥；髋铰链经指导确认后再选硬拉。',['哑铃罗马尼亚硬拉']),
      exercise('split-squat','扶稳分腿蹲',2,8,8,'body','先徒手，每侧完成算一组；髋不适则替换。',['腿举']),
      exercise('leg-curl','腿弯举',2,10,15,'machine','控制下放。',['滑垫腿弯举']),
      exercise('side-plank','屈膝侧平板',2,15,25,'body','单位选秒；每侧完成目标时间算一组。',['侧平板'])
    ]}
  ];
  const units = {machine:'器械标重 kg', 'per-hand':'单只哑铃 kg', total:'总外部重量 kg', body:'徒手（额外负重 0）', band:'弹力带（不换算 kg）', assistance:'辅助重量 kg（越少越难）'};
  const names = Object.fromEntries(plans.map(p=>[p.id,p.name]));
  Object.assign(names,{cardio:'有氧',mobility:'活动度',recovery:'恢复 / 休息'});
  const clone = x => JSON.parse(JSON.stringify(x));
  const dateKey = value => new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const dayMs = 86400000;
  function ordinal(key) { return Date.parse(key + 'T00:00:00+08:00'); }
  function daysBetween(a,b) { return (ordinal(b)-ordinal(a))/dayMs; }
  function weekKey(value) {
    const day = dateKey(value), d = new Date(ordinal(day));
    const dow = new Date(day+'T12:00:00Z').getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow+6)%7);
    return dateKey(d);
  }
  function isFatigued(r) { return (r.sleep !== null && r.sleep < 6) || (r.energy !== null && r.energy <= 2) || (r.soreness !== null && r.soreness >= 2); }
  function readyKnown(r) { return r.sleep !== null && r.energy !== null && r.soreness !== null && r.pain === 'none'; }
  function completedStrength(s) { return names[s.planId] && plans.some(p=>p.id===s.planId) && s.status==='completed'; }
  // Equal timestamps still count. Many saves share the default 06:18 start, and a
  // strict earlier-than check hid that record from the next draft's last-set hints.
  function eligibleBefore(s, at) { return new Date(s.date).getTime() <= new Date(at).getTime(); }
  function nextPlan(sessions, at = new Date().toISOString(), readiness = {sleep:null,energy:null,soreness:null,pain:'unknown'}) {
    const past = sessions.filter(s=>eligibleBefore(s,at)).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const completed = past.filter(completedStrength);
    const last = completed[0];
    const index = last ? (plans.findIndex(p=>p.id===last.planId)+1)%4 : 0;
    const plan = plans[index];
    let reason = last ? `上次完成${names[last.planId]}，下一站是${plan.name}；休息和未完成记录不推进顺序。` : '从上肢 A 建立器械基线，前 8 次力量训练使用适应组数。';
    let mode = 'normal';
    const worked = s => s.exercises.some(e=>e.sets.some(x=>x.done));
    const lastStrength = past.find(s=>plans.some(p=>p.id===s.planId)&&worked(s));
    const recentSame = past.find(s=>plans.find(p=>p.id===s.planId)?.region===plan.region&&worked(s));
    if (readiness.pain==='yes') { mode='stop'; reason='今天有疼痛：暂停诱发疼痛的动作，先记录症状；不能依据算法判断可否继续训练。'; }
    else if (isFatigued(readiness)) { mode='light'; reason='恢复反馈偏低：优先休息或轻活动；若训练，每个动作减少一组，不加重量。'; }
    else if (lastStrength && new Date(at)-new Date(lastStrength.date)<20*3600000) { mode='rest'; reason='距离最近一次力量训练不足 20 小时，今天优先恢复，不赶进度。'; }
    else if (recentSame && new Date(at)-new Date(recentSame.date)<48*3600000) { mode='rest'; reason='同一部位距离上次训练不足 48 小时，先恢复；这是保守排程提示，不是医学判断。'; }
    return {plan, mode, reason, adaptation:completed.length<8};
  }
  function identity(e) { return [e.id,e.variant.trim(),e.equipment.trim(),e.loadUnit,e.metric].join('|'); }
  function matchingHistory(e,sessions,at) {
    return sessions.filter(s=>eligibleBefore(s,at)).flatMap(s=>(s.exercises||[]).filter(x=>identity(x)===identity(e)).map(x=>({session:s,exercise:x}))).sort((a,b)=>new Date(b.session.date)-new Date(a.session.date));
  }
  function qualified(item) {
    const {session:s,exercise:e}=item;
    const done=e.sets.filter(x=>x.done);
    return s.status==='completed' && e.form==='good' && e.pain==='none' && readyKnown(s.readiness) && !isFatigued(s.readiness) && done.length>=e.targetSets && done.every(x=>x.value>=e.targetHigh && x.rir!==null && x.rir>=2) && done.every(x=>x.load===done[0].load);
  }
  function recommend(e,sessions,at,readiness) {
    const history=matchingHistory(e,sessions,at), recent=history[0];
    const result=(action,reason,weight=null)=>({action,reason,weight});
    if(readiness.pain==='yes') return result('暂停','今天有疼痛，不自动安排加重。');
    if(isFatigued(readiness)) return result('减量','恢复不足：减少一组，保持轻松，不加重。');
    if(!recent) return result('建立基线','没有同动作、器械和单位的可比记录；现场试选重量，保留约 3 次余力。');
    const last=recent.exercise, done=last.sets.filter(x=>x.done);
    const weight=done.length && done.every(x=>x.load===done[0].load) ? done[0].load : null;
    if(last.pain==='yes') return result('先评估','上次该动作有疼痛；不要沿用加重建议，先确认症状和替代动作。');
    if(daysBetween(dateKey(recent.session.date),dateKey(at))>21) return result('重新适应','可比记录已超过 21 天，先重新确认动作和负荷。');
    if(!readyKnown(readiness)) return result('维持','今天的恢复信息未填全，不触发加重。',weight);
    if(last.form==='poor' || done.some(x=>x.value<last.targetLow || x.rir===0)) return result('减轻难度','上次动作不稳定、有组数未达到目标下限或已力竭；先降低难度，保证动作。');
    if(last.form!=='good' || last.pain!=='none' || done.some(x=>x.rir===null)) return result('维持','上次动作质量、疼痛或余力信息不足，先完善记录。',weight);
    const previous=history[1];
    const sameLoad = previous && previous.exercise.sets.filter(x=>x.done).every(x=>x.load===weight);
    const sameTarget = previous && previous.exercise.targetHigh===last.targetHigh && previous.exercise.targetLow===last.targetLow && previous.exercise.targetSets===last.targetSets && e.targetHigh===last.targetHigh && e.targetLow===last.targetLow && e.targetSets===last.targetSets;
    if(previous && dateKey(previous.session.date)!==dateKey(recent.session.date) && qualified(recent) && qualified(previous) && sameLoad && sameTarget && ['machine','per-hand','total'].includes(e.loadUnit) && e.metric==='reps') {
      return result('可加一档','同一负荷、目标与器械连续两次全部达标，余力 ≥2；使用现场最小增量，加重后回到次数下限。',weight);
    }
    return result('维持','先把目标范围内的次数做稳；需要连续两次充分记录的达标训练才建议加重。',weight);
  }
  const defaultMetric = def => def.id==='side-plank'?'seconds':'reps';
  const variantPresets = {
    '哑铃卧推':{loadUnit:'per-hand',metric:'reps'},
    '胸托哑铃划船':{loadUnit:'per-hand',metric:'reps'},
    '辅助引体向上':{loadUnit:'assistance',metric:'reps'},
    '绳索侧平举':{loadUnit:'machine',metric:'reps'},
    '屈膝侧平板':{loadUnit:'body',metric:'seconds',targetLow:15,targetHigh:25},
    '高脚杯深蹲':{loadUnit:'total',metric:'reps'},
    '器械臀推':{loadUnit:'machine',metric:'reps'},
    '滑垫腿弯举':{loadUnit:'body',metric:'reps'},
    '器械提踵':{loadUnit:'machine',metric:'reps'},
    '仅伸手的鸟狗式':{loadUnit:'body',metric:'reps'},
    '上斜器械推胸':{loadUnit:'machine',metric:'reps'},
    '坐姿划船':{loadUnit:'machine',metric:'reps'},
    '绳索弯举':{loadUnit:'machine',metric:'reps'},
    '哑铃罗马尼亚硬拉':{loadUnit:'per-hand',metric:'reps'},
    '腿举':{loadUnit:'machine',metric:'reps'},
    '侧平板':{loadUnit:'body',metric:'seconds',targetLow:15,targetHigh:25}
  };
  function variantPreset(def, variantName) {
    if(def && variantName===def.name){
      const preset={loadUnit:def.unit,metric:defaultMetric(def)};
      if(def.id==='side-plank'){preset.targetLow=def.low;preset.targetHigh=def.high;}
      return preset;
    }
    return variantPresets[variantName]||null;
  }
  function applyVariantChoice(exercise, def) {
    const preset=variantPreset(def, exercise.variant);
    if(preset){
      exercise.metric=preset.metric;
      exercise.loadUnit=preset.loadUnit;
      if(preset.targetLow!=null)exercise.targetLow=preset.targetLow;
      if(preset.targetHigh!=null)exercise.targetHigh=preset.targetHigh;
    }
    exercise.equipment=['body','band'].includes(exercise.loadUnit)?'垫上 / 徒手':'';
    for(const s of exercise.sets){s.load=['body','band'].includes(exercise.loadUnit)?0:null;s.value=null;s.rir=null;s.done=false;}
    return exercise;
  }
  function makeExercise(def, sessions, at, readiness, adaptation) {
    const old=sessions.filter(s=>eligibleBefore(s,at)).sort((a,b)=>new Date(b.date)-new Date(a.date)).flatMap(s=>s.exercises||[]).find(e=>e.id===def.id);
    const targetSets=Math.max(1,(adaptation?Math.min(2,def.sets):def.sets)-(isFatigued(readiness)?1:0));
    const metric=old?.metric||defaultMetric(def);
    const changed=old && (old.variant!==def.name || old.metric!==defaultMetric(def) || old.loadUnit!==def.unit);
    const loadUnit=old?.loadUnit||def.unit;
    return {id:def.id,name:def.name,variant:old?.variant||def.name,equipment:old?.equipment||(['body','band'].includes(loadUnit)?'垫上 / 徒手':''),loadUnit,metric,targetSets,targetLow:changed?old.targetLow:def.low,targetHigh:changed?old.targetHigh:def.high,form:'unknown',pain:'unknown',sets:Array.from({length:targetSets},()=>({load:['body','band'].includes(loadUnit)?0:null,value:null,rir:null,done:false})),note:''};
  }
  function fresh() { return {version:2,sessions:[],measurements:[],trash:[],draft:null}; }
  const fail = message => { throw new Error(message); };
  const obj = v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function text(v,max=300) { if(typeof v!=='string'||v.length>max) fail('文字字段格式或长度不正确'); return v; }
  function number(v,min,max,nullable=false) { if(nullable&&v===null)return v; if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('数值超出允许范围');return v; }
  function choice(v,values) {if(!values.includes(v))fail('记录含有未知选项');return v;}
  function timestamp(v) {text(v,50);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))fail('日期格式不正确');const day=v.slice(0,10);if(new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)fail('日期不存在');return v;}
  function readiness(v) {if(!obj(v))fail('恢复信息缺失');return {sleep:number(v.sleep,0,24,true),energy:number(v.energy,1,5,true),soreness:number(v.soreness,0,3,true),pain:choice(v.pain,['unknown','none','yes'])};}
  function validateExercise(v,draft=false) {
    if(!obj(v))fail('动作格式错误');
    const e={id:text(v.id,60),name:text(v.name,100),variant:text(v.variant,100),equipment:text(v.equipment,100),loadUnit:choice(v.loadUnit,Object.keys(units)),metric:choice(v.metric,['reps','seconds']),targetSets:number(v.targetSets,1,8),targetLow:number(v.targetLow,1,600),targetHigh:number(v.targetHigh,1,600),form:choice(v.form,['unknown','good','poor']),pain:choice(v.pain,['unknown','none','yes']),note:text(v.note||'',500)};
    if(!plans.some(p=>p.exercises.some(x=>x.id===e.id)) || !Number.isInteger(e.targetSets) || e.targetLow>e.targetHigh)fail('动作或目标无效');
    if(!Array.isArray(v.sets)||v.sets.length<1||v.sets.length>8)fail('动作组数错误');
    e.sets=v.sets.map(s=>{if(!obj(s)||typeof s.done!=='boolean')fail('训练组格式错误');const set={load:number(s.load,0,1000,true),value:number(s.value,1,3600,true),rir:number(s.rir,0,10,true),done:s.done};if(!draft&&set.done&&(set.value===null||set.load===null))fail('完成组缺少重量或次数');if(!draft&&set.done&&e.metric==='reps'&&!Number.isInteger(set.value))fail('次数必须为整数');if(set.done&&['body','band'].includes(e.loadUnit)&&set.load!==0&&!draft)fail('徒手和弹力带的额外负重应记为 0');return set;});
    if(!draft&&e.sets.some(s=>s.done)&&(!e.variant.trim()||!e.equipment.trim()))fail('完成动作需要实际动作名和器械标识');
    return e;
  }
  function validateSession(v,draft=false) {
    if(!obj(v))fail('训练记录格式错误');
    const s={id:text(v.id,100),date:timestamp(v.date),updatedAt:timestamp(v.updatedAt),planId:choice(v.planId,Object.keys(names)),status:choice(v.status,['completed','partial']),readiness:readiness(v.readiness),duration:number(v.duration,0,300,true),cardioMinutes:number(v.cardioMinutes,0,300,true),mobilityMinutes:number(v.mobilityMinutes,0,180,true),note:text(v.note||'',2000)};
    if(!s.id || !Array.isArray(v.exercises)||v.exercises.length>20)fail('记录标识或动作数量无效');
    s.exercises=v.exercises.map(e=>validateExercise(e,draft));
    if(new Set(s.exercises.map(e=>e.id)).size!==s.exercises.length)fail('同一课表内动作标识重复');
    const plan=plans.find(p=>p.id===s.planId);
    if(plan&&s.exercises.some(e=>!plan.exercises.some(x=>x.id===e.id)))fail('动作不属于本次课表');
    if(!plan&&s.exercises.length)fail('非力量课表不应包含力量动作');
    if(!draft&&plan&&s.status==='completed'&&(plan.exercises.some(x=>!s.exercises.some(e=>e.id===x.id))||s.exercises.some(e=>e.sets.filter(x=>x.done).length<e.targetSets)))fail('尚未完成目标组数，请保存为部分完成');
    if(!draft&&s.planId==='cardio'&&s.status==='completed'&&!(s.cardioMinutes>0))fail('请填写实际有氧分钟数');
    if(!draft&&s.planId==='mobility'&&s.status==='completed'&&!(s.mobilityMinutes>0))fail('请填写实际活动度分钟数');
    return s;
  }
  function validateMeasurement(v) {
    if(!obj(v))fail('身体数据格式错误');
    const m={id:text(v.id,100),date:timestamp(v.date),weight:number(v.weight,20,350,true),waist:number(v.waist,30,250,true)};
    if(!m.id || (m.weight===null&&m.waist===null))fail('体重和腰围至少填写一项');return m;
  }
  function validateState(value) {
    if(!obj(value)||value.version!==2)fail('请选择本应用导出的 v2 JSON 备份');
    const state=fresh();
    for(const key of ['sessions','measurements','trash']) {
      if(!Array.isArray(value[key])||value[key].length>5000)fail('备份记录数量或格式不正确');
      state[key]=value[key].map(v=>key==='measurements'?validateMeasurement(v):validateSession(v));
    }
    for(const values of [state.sessions.concat(state.trash),state.measurements])if(new Set(values.map(v=>v.id)).size!==values.length)fail('备份有重复标识，未导入');
    if(value.draft!==null&&value.draft!==undefined)state.draft=validateSession(value.draft,true);
    return state;
  }
  function mergeBackup(current,incoming) {
    const a=validateState(current),b=validateState(incoming), ids=new Set(a.sessions.concat(a.trash).map(x=>x.id)), mids=new Set(a.measurements.map(x=>x.id));
    let added=0,skipped=0;
    for(const key of ['sessions','trash'])for(const s of b[key]){if(ids.has(s.id)){skipped++;continue;}a[key].push(s);ids.add(s.id);added++;}
    for(const m of b.measurements){if(mids.has(m.id)){skipped++;continue;}a.measurements.push(m);mids.add(m.id);added++;}
    if(!a.draft&&b.draft)a.draft=b.draft;
    return {state:validateState(a),added,skipped};
  }
  function weekly(sessions,at,count=8) {
    const start=weekKey(at), results=[];
    for(let i=count-1;i>=0;i--){const key=dateKey(new Date(ordinal(start)-i*7*dayMs));results.push({key,label:key.slice(5),strength:0,sets:0,cardio:0,mobility:0,recovery:0});}
    for(const s of sessions){if(new Date(s.date)>new Date(at))continue;const row=results.find(w=>w.key===weekKey(s.date));if(!row)continue;row.strength+=completedStrength(s)?1:0;row.sets+=s.exercises.reduce((a,e)=>a+e.sets.filter(x=>x.done).length,0);row.cardio+=s.cardioMinutes||0;row.mobility+=s.mobilityMinutes||0;row.recovery+=(s.planId==='recovery'&&s.status==='completed')?1:0;}
    return results;
  }
  return {ZONE,plans,units,names,clone,dateKey,weekKey,daysBetween,isFatigued,readyKnown,nextPlan,recommend,makeExercise,applyVariantChoice,identity,matchingHistory,fresh,validateState,validateSession,validateMeasurement,mergeBackup,weekly,completedStrength};
});
