(function () {
  'use strict';
  const T=window.Training, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||'s-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const now=()=>new Date().toISOString();
  const num=id=>$(id).value===''?null:Number($(id).value);
  const options=(entries,current)=>entries.map(([v,label])=>`<option value="${esc(v)}"${String(v)===String(current)?' selected':''}>${esc(label)}</option>`).join('');
  const field=(label,html,wide=false)=>`<label${wide?' class="wide"':''}>${label}${html}</label>`;
  const empty=message=>`<div class="empty">${esc(message)}</div>`;
  const unit=e=>e.metric==='seconds'?'秒':'次';
  const loadText=(e,load)=>['body','band'].includes(e.loadUnit)?(e.loadUnit==='body'?'徒手':'弹力带'):load+' kg'+(e.loadUnit==='per-hand'?' / 单只':e.loadUnit==='assistance'?' / 辅助':'');
  const setText=(e,s)=>`${loadText(e,s.load)} × ${s.value} ${unit(e)}${s.rir!==null?' · RIR '+s.rir:''}`;
  let draft=null, legacy=[], legacyMessage='正在读取旧记录…', manualPlan=false, deadline=null, tab='today', groups=[];
  let lastExport=null;
  const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
  const store=new JournalStore.Store(storage);
  let bodyMode=store.state.sessions.some(s=>T.dateKey(s.date)===T.dateKey(now())&&s.exercises.some(e=>Muscles.doneSets(e)>0))?'logged':'goal';
  let bodySide=window.matchMedia?.('(min-width: 761px)').matches?'both':'front', selectedMuscle=null, bodyData=null, lastBodyContext=null;
  $('body-date').value=T.dateKey(now());$('body-date').max=T.dateKey(now());
  function tell(message,error=false){$('notice').textContent=message;$('notice').hidden=false;$('notice').style.borderColor=error?'var(--red)':'';}
  function storageError(error){$('storage-error').hidden=false;$('storage-error').textContent=error.message||String(error);$('draft-state').textContent='保存异常 · 请勿关闭';}
  function mutate(fn){try{store.change(fn);$('storage-error').hidden=true;return true;}catch(e){storageError(e);return false;}}
  function sessions(){return store.state.sessions.filter(s=>!draft||s.id!==draft.id);}
  function readiness(){return {sleep:num('sleep'),energy:num('energy'),soreness:num('soreness'),pain:$('readiness-pain').value};}
  function selectedTime(){const date=$('session-date').value,time=$('session-time').value;if(!date||!time)throw new Error('请填写日期和开始时间');const value=`${date}T${time}:00+08:00`;if(!Number.isFinite(Date.parse(value)))throw new Error('日期无效');return value;}
  function showTab(value){tab=value;for(const name of ['today','tree','stats'])$('view-'+name).hidden=name!==value;for(const b of document.querySelectorAll('[data-tab]')){if(b.dataset.tab===value)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}if(value==='tree')renderTree();if(value==='stats')renderStats();}
  function renderSetup(){
    $('workout-form').innerHTML=`<fieldset><legend>训练与恢复状态</legend><div class="fields">
      ${field('日期','<input id="session-date" type="date" required>')}${field('开始时间','<input id="session-time" type="time" value="06:18" required>')}
      ${field('本次安排',`<select id="plan-choice">${options(Object.entries(T.names),'upper-a')}</select>`,true)}
      ${field('昨晚睡眠（小时）','<input id="sleep" type="number" min="0" max="24" step="0.5" placeholder="例如 7">')}
      ${field('今天精神',`<select id="energy">${options([['','未记录'],[1,'1 · 很疲倦'],[2,'2 · 偏疲倦'],[3,'3 · 一般'],[4,'4 · 良好'],[5,'5 · 很好']],'')}</select>`)}
      ${field('肌肉酸痛',`<select id="soreness">${options([['','未记录'],[0,'无明显酸痛'],[1,'轻微'],[2,'较明显'],[3,'很明显']],'')}</select>`)}
      ${field('是否有疼痛',`<select id="readiness-pain">${options([['unknown','未记录'],['none','无痛'],['yes','有疼痛']],'unknown')}</select>`)}
      </div></fieldset><div id="readiness-note" class="callout" aria-live="polite"></div>
      <div class="buttons"><button type="button" class="primary" id="begin">生成本次记录 ↗</button><button type="button" id="resume" hidden>继续草稿</button><button type="button" id="discard" hidden>放弃草稿</button></div>
      <div id="editor" hidden><p class="callout">只勾选实际完成的组。重量与次数 / 秒数分开；RIR 表示这一组结束时还能标准完成几次。热身不计正式组数。空白不等于完成。</p><div id="exercise-editor"></div>
      <fieldset><legend>本次实际完成</legend><div class="fields">
      ${field('馆内训练（分钟）','<input id="duration" type="number" min="0" max="300" step="1" placeholder="不含通勤">')}
      ${field('有氧（分钟）','<input id="cardio-minutes" type="number" min="0" max="300" step="1" placeholder="可含实际往返慢跑">')}
      ${field('活动度（分钟）','<input id="mobility-minutes" type="number" min="0" max="180" step="1" placeholder="实际完成">')}
      ${field('完成情况',`<select id="completion">${options([['completed','按本次目标完成'],['partial','部分完成 / 提前结束']],'completed')}</select>`)}
      </div>${field('训练笔记','<textarea id="session-note" rows="3" maxlength="2000" placeholder="动作感受、弹响变化、提前结束原因……"></textarea>')}</fieldset>
      <div id="save-error" class="callout error" role="alert" hidden></div><div class="buttons"><button class="primary" id="save" type="submit">保存训练记录</button><span class="small muted">草稿自动保存，正式保存后计入统计。</span></div></div>`;
    $('session-date').value=T.dateKey(now());$('session-date').max=T.dateKey(now());
    $('begin').addEventListener('click',begin);
    $('resume').addEventListener('click',()=>{draft=T.clone(store.state.draft);loadDraft();});
    $('discard').addEventListener('click',()=>{$('discard-dialog').showModal();});
    $('plan-choice').addEventListener('change',()=>{manualPlan=true;updatePlan();});
    for(const id of ['session-date','session-time','sleep','energy','soreness','readiness-pain'])$(id).addEventListener('input',()=>{updatePlan();if(draft){draft.readiness=readiness();persistDraft();updateHints();}});
    for(const id of ['duration','cardio-minutes','mobility-minutes','completion','session-note'])$(id).addEventListener('input',()=>{captureExtras();persistDraft();});
    draftButtons();updatePlan();
  }
  function draftButtons(){const exists=!!(draft||store.state.draft);$('resume').hidden=!exists||!!draft;$('discard').hidden=!exists;$('begin').disabled=exists||!!store.error;$('plan-choice').disabled=!!draft;$('session-date').disabled=!!draft;$('session-time').disabled=!!draft;$('draft-state').textContent=draft?'草稿已恢复':exists?'有未完成草稿':'尚未开始';}
  function updatePlan(){
    let at;try{at=selectedTime();}catch{return;}
    // The next-step card must include today's already-saved workout, even when
    // the default start time is identical to that workout's timestamp.
    const planningAt=!draft&&T.dateKey(at)===T.dateKey(now())?new Date(Math.max(Date.parse(at),Date.now())).toISOString():at;
    const result=T.nextPlan(sessions(),planningAt,readiness());
    if(!draft&&!manualPlan)$('plan-choice').value=result.mode==='normal'?result.plan.id:'recovery';
    const chosen=T.plans.find(p=>p.id===$('plan-choice').value);
    const preview=chosen?`<details open><summary>本次课表预览 · ${esc(chosen.name)}</summary><ul class="small muted">${chosen.exercises.map(def=>{const e=T.makeExercise(def,sessions(),at,readiness(),result.adaptation);return `<li>${esc(e.variant)} · ${e.targetSets} × ${e.targetLow}–${e.targetHigh} ${unit(e)}</li>`;}).join('')}</ul></details>`:'<p class="small">本次选择：'+esc(T.names[$('plan-choice').value])+'。记录实际完成分钟与恢复感受即可。</p>';
    $('next-plan').innerHTML=`<h2>${esc(result.mode==='normal'?result.plan.name:result.mode==='stop'?'先关注疼痛':result.mode==='rest'?'今天先恢复':'轻量一点，也可以')}</h2><p>${esc(result.reason)}</p><p class="small">${result.adaptation?'适应阶段 · 前 8 次力量训练':'常规阶段'} · ${esc(result.plan.focus)}</p>${preview}`;
    $('readiness-note').textContent=result.reason+(T.readyKnown(readiness())?'':' 恢复信息未填全时，不触发加重建议。')+(draft?' 本次组数已在开始时确定；若中途疲劳，可减组或保存为部分完成。':'');
    renderBody();
  }
  function renderBody(animate=false){
    if(!$('plan-choice'))return;
    const editingDate=$('session-date').value||T.dateKey(now());
    if(bodyMode==='goal')$('body-date').value=editingDate;
    const date=$('body-date').value||T.dateKey(now());
    const saved=store.state.sessions.filter(s=>T.dateKey(s.date)===date&&Date.parse(s.date)<=Date.now());
    let planned=[],actual=[],context='';
    if(bodyMode==='logged'){
      planned=saved.flatMap(s=>s.exercises);actual=planned;
      const strength=saved.filter(s=>s.exercises.length);
      context=`${date} · ${strength.length} 条力量记录 · 仅统计实际完成组`;
      $('body-title').textContent=date===T.dateKey(now())?'今天，练过这些肌群':'这一天，练过这些肌群';
      $('body-phase').textContent=strength.some(s=>s.exercises.some(e=>Muscles.doneSets(e)>0))?'能量已从记录入账':'等待第一条完成组';
    }else{
      const at=$('session-date').value&&$('session-time').value?selectedTime():now(),r=readiness(),plan=T.plans.find(p=>p.id===$('plan-choice').value);
      const adaptation=T.nextPlan(sessions(),at,r).adaptation;
      planned=draft?draft.exercises:plan?plan.exercises.map(e=>T.makeExercise(e,sessions(),at,r,adaptation)):[];
      context=`${editingDate} · ${T.names[draft?.planId||$('plan-choice').value]} · ${draft?'草稿尚未注入能量':'训练前查看目标区域'}`;
      $('body-title').textContent='本次，要练这些肌群';
      $('body-phase').textContent=draft?'正在记录 · 待保存':'目标已标记';
    }
    bodyData=Muscles.summarize(planned,actual);
    const contextKey=[bodyMode,date,draft?.id||'',bodyMode==='goal'?$('plan-choice').value:''].join('|');
    const contextChanged=lastBodyContext!==contextKey;
    if(contextChanged||!selectedMuscle||!bodyData.groups[selectedMuscle])selectedMuscle=bodyData.active.find(g=>!g.secondary&&(bodySide==='both'||g.views.includes(bodySide)))?.id||bodyData.active.find(g=>!g.secondary)?.id||bodyData.active[0]?.id||null;
    lastBodyContext=contextKey;$('muscle-section').dataset.mode=bodyMode;
    if(contextChanged&&bodyData.active.length&&!bodyData.active.some(g=>g.views.includes(bodySide))&&bodySide!=='both')bodySide=bodyData.active[0].views[0];
    $('body-context').textContent=context;$('body-date').disabled=bodyMode==='goal';
    for(const b of document.querySelectorAll('[data-body-mode]'))b.setAttribute('aria-pressed',String(b.dataset.bodyMode===bodyMode));
    for(const b of document.querySelectorAll('[data-body-side]'))b.setAttribute('aria-pressed',String(b.dataset.bodySide===bodySide));
    $('body-model').dataset.side=bodySide;
    $('body-model').innerHTML='<div class="body-front">'+Muscles.svg('front',bodyData,selectedMuscle,animate)+'</div><div class="body-back">'+Muscles.svg('back',bodyData,selectedMuscle,animate)+'</div>';
    window.FitnessBody?.update({data:bodyData,side:bodySide,selected:selectedMuscle,animate});
    const uniqueDone=actual.reduce((sum,e)=>sum+Muscles.doneSets(e),0),uniqueTarget=planned.reduce((sum,e)=>sum+e.targetSets,0);
    $('body-totals').innerHTML=`<span><b>${bodyData.active.filter(g=>!g.secondary).length}</b> 主要肌群</span><span><b>${bodyMode==='logged'?uniqueDone:uniqueTarget}</b> ${bodyMode==='logged'?'已完成组':'目标组'}</span>`;
    $('muscle-chips').innerHTML=bodyData.active.map(g=>`<button type="button" data-muscle="${g.id}" class="muscle-chip${g.secondary?' support':''}${g.percent>0?' has-energy':''}" aria-pressed="${g.id===selectedMuscle}"><span>${esc(g.name)}</span><small>${bodyMode==='logged'?(g.donePrimary+g.doneSecondary)+' / '+(g.targetPrimary+g.targetSecondary)+' 组':g.secondary?'协同':'主要'}</small></button>`).join('');
    $('body-empty').textContent=bodyData.unknown.length?'未自动匹配：'+bodyData.unknown.join('、')+'。为避免错误，不给未知动作分配肌群能量。':!bodyData.active.length?(bodyMode==='logged'?'这一天没有力量肌群记录。有氧、活动度和休息会保留在时间轴中。':'本次是有氧、活动度或恢复安排，不模拟力量肌群充能。'):'';
    $('body-cta').textContent=bodyMode==='logged'?'查看训练时间轴 ↗':draft||store.state.draft?'继续训练记录 ↗':'开始记录本次训练 ↗';
    renderMuscleDetail();
  }
  function renderMuscleDetail(){
    if(!selectedMuscle||!bodyData){$('muscle-detail').innerHTML='<p class="small muted">先选择力量课表，或查看已有记录。</p>';return;}
    const g=bodyData.groups[selectedMuscle],target=g.targetPrimary+g.targetSecondary,done=g.donePrimary+g.doneSecondary;
    $('muscle-detail').innerHTML=`<div class="muscle-detail-heading"><div><h3>${esc(g.name)}</h3><p class="small muted">${esc(g.detail)} · ${g.state==='idle'?'本次未涉及':g.secondary?'协同参与':'主要训练'}</p></div><b>${bodyMode==='logged'?g.percent+'%':g.state==='idle'?'未安排':'待训练'}</b></div><div class="energy-track" role="progressbar" aria-label="${esc(g.name)}已保存组数完成比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${g.percent}"><span style="width:${g.percent}%"></span></div><p class="small muted">${bodyMode==='logged'?`实际 ${done} / 目标 ${target} 组；左右合计为一组。`:`计划 ${target} 组；保存后按实际完成填入能量。`}</p><ul>${g.moves.map(m=>`<li><span>${esc(m.name)}<small>${m.role==='primary'?'主要':'协同'}</small></span><b>${bodyMode==='logged'?m.done+' / ':''}${m.target} 组</b></li>`).join('')}</ul><p class="small muted">同一组可涉及多个肌群，不能把肌群组数相加当作总训练组数。</p>`;
  }
  document.addEventListener('fitness-select',event=>selectMuscle(event.detail));
  function selectMuscle(id){if(!Muscles.GROUPS[id]||!bodyData)return;selectedMuscle=id;const views=Muscles.GROUPS[id].views;if(bodySide!=='both'&&!views.includes(bodySide))bodySide=views[0];renderBody();}
  document.addEventListener('click',event=>{const region=event.target.closest('[data-muscle]');if(region)selectMuscle(region.dataset.muscle);const day=event.target.closest('[data-muscle-date]');if(day){bodyMode='logged';$('body-date').value=day.dataset.muscleDate;showTab('today');renderBody();$('muscle-section').scrollIntoView({block:'start'});}const mode=event.target.closest('[data-body-mode]');if(mode){bodyMode=mode.dataset.bodyMode;renderBody();}const side=event.target.closest('[data-body-side]');if(side){bodySide=side.dataset.bodySide;renderBody();}});
  $('body-model').addEventListener('keydown',event=>{const region=event.target.closest('[data-muscle]');if(region&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectMuscle(region.dataset.muscle);}});
  $('body-date').addEventListener('change',()=>{if(!$('body-date').value||$('body-date').value>T.dateKey(now())){$('body-date').value=T.dateKey(now());}renderBody();});
  $('body-cta').addEventListener('click',()=>{if(bodyMode==='logged'){showTab('tree');$('timeline').scrollIntoView({block:'start'});}else{if(!draft&&store.state.draft){draft=T.clone(store.state.draft);loadDraft();}showTab('today');$('record-section').scrollIntoView({block:'start'});if(!draft)$('plan-choice').focus({preventScroll:true});}});
  function begin(){
    if(store.state.draft||draft)return tell('请先继续或放弃已有草稿。',true);
    if(!$('workout-form').reportValidity())return;
    try{
      const at=selectedTime();if(Date.parse(at)>Date.now()+300000)throw new Error('不能提前记录未来的训练，请选择已开始的时间。');
      const r=readiness(),result=T.nextPlan(sessions(),at,r),plan=T.plans.find(p=>p.id===$('plan-choice').value);
      const next={id:uid(),date:at,updatedAt:now(),planId:$('plan-choice').value,status:'completed',readiness:r,duration:null,cardioMinutes:null,mobilityMinutes:null,note:'',exercises:plan?plan.exercises.map(e=>T.makeExercise(e,sessions(),at,r,result.adaptation)):[]};
      store.change(s=>{s.draft=next;});draft=T.clone(next);bodyMode='goal';loadDraft();
    }catch(e){tell(e.message,true);}
  }
  function loadDraft(){
    const d=draft;if(!d)return;
    $('session-date').value=T.dateKey(d.date);$('session-time').value=new Intl.DateTimeFormat('en-GB',{timeZone:T.ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d.date));$('plan-choice').value=d.planId;
    for(const key of ['sleep','energy','soreness'])$(key).value=d.readiness[key]??'';$('readiness-pain').value=d.readiness.pain;
    for(const [id,key] of [['duration','duration'],['cardio-minutes','cardioMinutes'],['mobility-minutes','mobilityMinutes'],['completion','status'],['session-note','note']])$(id).value=d[key]??'';
    $('editor').hidden=false;$('save-error').hidden=true;renderExercises();draftButtons();updatePlan();
  }
  function captureExtras(){if(!draft)return;Object.assign(draft,{duration:num('duration'),cardioMinutes:num('cardio-minutes'),mobilityMinutes:num('mobility-minutes'),status:$('completion').value,note:$('session-note').value,readiness:readiness()});}
  function persistDraft(){if(!draft)return false;draft.updatedAt=now();if(mutate(s=>{s.draft=T.clone(draft);})){ $('draft-state').textContent='草稿已保存 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});return true;}return false;}
  function renderExercises(){
    if(!draft)return;
    $('exercise-editor').innerHTML=draft.exercises.length?draft.exercises.map((e,i)=>{
      const def=T.plans.find(p=>p.id===draft.planId).exercises.find(x=>x.id===e.id);
      const variants=[...new Set([e.variant,def.name,...def.alternatives])];
      return `<section class="exercise" data-ex="${i}"><div class="exercise-title"><h3>${i+1}. ${esc(e.name)}</h3><span class="target">本次 ${e.targetSets} × ${e.targetLow}–${e.targetHigh} ${unit(e)}</span></div><p class="cue">${esc(def.cue)}</p>
      <details${e.equipment?'':' open'}><summary>实际动作、器械和计重方式</summary><div class="fields config">
      ${field('实际动作',`<select data-field="variant">${options(variants.map(v=>[v,v]),e.variant)}</select>`)}
      ${field('器械标识',`<input data-field="equipment" maxlength="100" value="${esc(e.equipment)}" placeholder="例如 胸推机1号 / 哑铃区">`)}
      ${field('重量单位',`<select data-field="loadUnit">${options(Object.entries(T.units),e.loadUnit)}</select>`)}
      ${field('次数 / 时间',`<select data-field="metric">${options([['reps','次数'],['seconds','秒数']],e.metric)}</select>`)}
      ${field('每组目标下限',`<input data-field="targetLow" type="number" min="1" max="600" value="${e.targetLow}">`)}
      ${field('每组目标上限',`<input data-field="targetHigh" type="number" min="1" max="600" value="${e.targetHigh}">`)}
      </div><p class="small muted">换动作或单位后请核实目标。单侧动作完成两侧算一组。器械重量只与同一台机器比较。</p></details>
      <div class="suggestion" id="hint-${i}" aria-live="polite"></div><p class="small muted" id="previous-${i}"></p>
      <table class="set-table"><thead><tr><th scope="col">组</th><th scope="col">额外负重 kg</th><th scope="col">${unit(e)}</th><th scope="col">RIR</th><th scope="col">完成</th></tr></thead><tbody>${e.sets.map((s,j)=>`<tr data-set="${j}"><td>${j+1}</td><td><input data-set-field="load" type="number" min="0" max="1000" step="any" value="${s.load??''}" ${['body','band'].includes(e.loadUnit)?'readonly':''} aria-label="${esc(e.name)}第${j+1}组重量"></td><td><input data-set-field="value" type="number" min="1" max="3600" step="1" value="${s.value??''}" placeholder="${e.targetLow}–${e.targetHigh}" aria-label="${esc(e.name)}第${j+1}组${unit(e)}"></td><td><select data-set-field="rir" aria-label="${esc(e.name)}第${j+1}组余力">${options([['','未知'],...Array.from({length:11},(_,v)=>[v,v===10?'10+':String(v)])],s.rir??'')}</select></td><td><input data-set-field="done" type="checkbox" ${s.done?'checked':''} aria-label="${esc(e.name)}第${j+1}组已完成"></td></tr>`).join('')}</tbody></table>
      <div class="buttons"><button type="button" data-copy-load>沿用上次重量</button><button type="button" data-adjust="-1">减一组</button><button type="button" data-adjust="1">加一组</button></div>
      <div class="fields config">${field('动作质量',`<select data-field="form">${options([['unknown','未评价'],['good','动作稳定'],['poor','不稳定 / 借力']],e.form)}</select>`)}${field('该动作是否疼痛',`<select data-field="pain">${options([['unknown','未评价'],['none','无痛'],['yes','有疼痛']],e.pain)}</select>`)}</div>
      ${field('动作备注',`<input data-field="note" maxlength="500" value="${esc(e.note)}" placeholder="可选：弹响、器械调节位置、左右差异">`)}</section>`;
    }).join(''):`<p class="callout">${draft.planId==='cardio'?'建议 5 分钟热身＋30 分钟舒适有氧＋10 分钟活动度＋5 分钟放松；请记录实际分钟。':draft.planId==='mobility'?'在舒适范围完成活动度练习，记录实际分钟，不强压拉伸。':'今天可以休息、轻松走动，或只记录恢复状态。休息不推进力量课表，也不扣分。'}</p>`;
    updateHints();renderBody();
  }
  function updateHints(){if(!draft)return;draft.exercises.forEach((e,i)=>{const rec=T.recommend(e,sessions(),draft.date,readiness());const hint=$('hint-'+i);if(!hint)return;hint.classList.toggle('caution',['暂停','先评估','减量','减轻难度'].includes(rec.action));hint.innerHTML=`<strong>${esc(e.pain==='yes'?'停止诱发动作':rec.action)}</strong>${esc(e.pain==='yes'?'本次记录了疼痛；不继续加重，必要时寻求评估。':rec.reason)}${rec.weight!==null?' 上次可比负重：'+esc(loadText(e,rec.weight))+'。':''}`;const previous=T.matchingHistory(e,sessions(),draft.date)[0];$('previous-'+i).textContent=previous?'上次 '+T.dateKey(previous.session.date)+'：'+previous.exercise.sets.filter(s=>s.done).map(s=>setText(e,s)).join('；'):'尚无可比记录。先确认器械标识和单位，建立基线。';});}
  $('workout-form').addEventListener('input',event=>{
    const section=event.target.closest('[data-ex]');if(!section||!draft)return;const e=draft.exercises[Number(section.dataset.ex)],el=event.target;
    if(el.dataset.setField){const set=e.sets[Number(el.closest('[data-set]').dataset.set)];set[el.dataset.setField]=el.type==='checkbox'?el.checked:el.value===''?null:Number(el.value);}
    else if(el.dataset.field){const key=el.dataset.field;e[key]=['targetLow','targetHigh'].includes(key)?Number(el.value):el.value;section.querySelector('.target').textContent=`本次 ${e.targetSets} × ${e.targetLow}–${e.targetHigh} ${unit(e)}`;}
    persistDraft();updateHints();if(el.dataset.field==='variant')renderBody();
  });
  $('workout-form').addEventListener('change',event=>{
    const el=event.target,section=el.closest('[data-ex]');if(!section||!draft)return;
    const e=draft.exercises[Number(section.dataset.ex)],key=el.dataset.field;
    if(['variant','loadUnit','metric'].includes(key)){
      if(e.sets.some(s=>s.done))tell('已完成组请核实实际动作和单位，修改后不会与旧器械混算。');
      if(key==='variant'){
        const name=e.variant;
        if(/侧平板/.test(name)){e.metric='seconds';e.targetLow=15;e.targetHigh=25;e.loadUnit='body';}
        else if(/臀桥|鸟狗|扶稳分腿蹲|滑垫|徒手/.test(name)){e.metric='reps';e.loadUnit='body';}
        else if(/辅助引体/.test(name)){e.metric='reps';e.loadUnit='assistance';}
        else if(/哑铃/.test(name)){e.metric='reps';e.loadUnit='per-hand';}
        else {e.metric='reps';e.loadUnit='machine';}
        e.equipment=['body','band'].includes(e.loadUnit)?'垫上 / 徒手':'';
      }
      e.sets.forEach(s=>{s.load=['body','band'].includes(e.loadUnit)?0:null;s.value=null;s.rir=null;s.done=false;});
      tell('动作或单位已变更，已清空该动作的实际组记录，避免把旧数值当成新单位。请重新填写。');
      persistDraft();renderExercises();
    }
  });
  $('workout-form').addEventListener('click',event=>{
    const copy=event.target.closest('[data-copy-load]');
    if(copy&&draft){const e=draft.exercises[Number(copy.closest('[data-ex]').dataset.ex)],previous=T.matchingHistory(e,sessions(),draft.date)[0];if(!previous)return tell('没有同器械、同单位的可比记录，请先建立基线。');if(previous.exercise.pain==='yes'||previous.exercise.form==='poor')return tell('上次记录有疼痛或动作不稳定，不沿用重量；先确认安全负荷。',true);const sets=previous.exercise.sets.filter(s=>s.done);if(!sets.length)return tell('上次没有完成组，不能复制重量。');e.sets.forEach((s,i)=>{if(!s.done)s.load=sets[Math.min(i,sets.length-1)].load;});persistDraft();renderExercises();tell('只填入上次重量，次数和完成状态仍需如实记录。');return;}
    const b=event.target.closest('[data-adjust]');if(!b||!draft)return;const e=draft.exercises[Number(b.closest('[data-ex]').dataset.ex)],delta=Number(b.dataset.adjust);if(e.sets.length+delta<1||e.sets.length+delta>8)return;if(delta<0){if(e.sets.at(-1).done)return tell('最后一组已完成，请先取消勾选再调整。',true);e.sets.pop();}else e.sets.push({load:['body','band'].includes(e.loadUnit)?0:null,value:null,rir:null,done:false});e.targetSets=e.sets.length;persistDraft();renderExercises();
  });
  $('workout-form').addEventListener('submit',event=>{
    event.preventDefault();if(!draft)return;captureExtras();
    try{
      draft.updatedAt=now();const validated=T.validateSession(draft);
      if(!T.plans.some(p=>p.id===validated.planId)&&validated.planId!=='recovery'&&validated.status==='partial'&&!validated.note&&!validated.cardioMinutes&&!validated.mobilityMinutes)throw new Error('请记录实际分钟或提前结束的原因。');
      if(store.state.sessions.some(s=>s.id!==validated.id&&Date.parse(s.date)===Date.parse(validated.date)&&s.planId===validated.planId))throw new Error('同一开始时间已有该课表记录。请编辑已有记录，避免重复累计。');
      const editing=store.state.sessions.some(s=>s.id===validated.id);
      store.change(s=>{const i=s.sessions.findIndex(x=>x.id===validated.id);if(i>=0)s.sessions[i]=validated;else s.sessions.push(validated);s.draft=null;});
      draft=null;manualPlan=false;bodyMode='logged';$('body-date').value=T.dateKey(validated.date);renderSetup();renderAll();tell(editing?'训练记录已更新，肌群能量、统计与建议已重新计算。':'训练已保存，对应肌群能量已入账。');showTab('today');renderBody(true);$('muscle-section').scrollIntoView({block:'start'});
    }catch(e){$('save-error').hidden=false;$('save-error').textContent=e.message;}
  });
  $('cancel-discard').addEventListener('click',()=>$('discard-dialog').close());
  $('confirm-discard').addEventListener('click',()=>{if(!mutate(s=>{s.draft=null;}))return;draft=null;manualPlan=false;$('discard-dialog').close();renderSetup();tell('草稿已放弃，正式记录保持不变。');});
  function editSession(id){if(draft||store.state.draft)return tell('请先保存或放弃当前草稿，再编辑历史记录。',true);const s=store.state.sessions.find(x=>x.id===id);if(!s)return;if(!mutate(state=>{state.draft=T.clone(s);} ))return;draft=T.clone(s);loadDraft();showTab('today');$('record-section').scrollIntoView({block:'start'});}
  function archive(id){if(draft?.id===id||store.state.draft?.id===id)return tell('此记录正在编辑，请先处理草稿。',true);if(mutate(s=>{const i=s.sessions.findIndex(x=>x.id===id);if(i>=0)s.trash.push(s.sessions.splice(i,1)[0]);})){renderAll();tell('记录已移至可恢复区，随时可以恢复。');}}
  function restore(id){if(mutate(s=>{const i=s.trash.findIndex(x=>x.id===id);if(i>=0)s.sessions.push(s.trash.splice(i,1)[0]);})){renderAll();tell('记录已恢复。');}}
  function renderSummary(){const w=T.weekly(store.state.sessions,now()).at(-1);$('summary').innerHTML=[[w.strength,'/ 4 次','本周完成力量训练'],[w.sets,'组','本周实际正式组数'],[w.cardio,'分钟','本周有氧'],[w.mobility,'分钟','本周活动度']].map(([v,u,label])=>`<article class="summary-card"><b>${v}<small>${u}</small></b><p>${label}</p></article>`).join('');$('backup-status').textContent=`本机 ${store.state.sessions.length} 条训练 · ${store.state.measurements.length} 条测量。${lastExport?'本次已导出备份。':'建议每周导出一次备份。'}`;}
  function node(content,future=false){return `<li class="tree-node${future?' future':''}"><span class="node-dot" aria-hidden="true"></span><article class="node-card">${content}</article></li>`;}
  function renderTree(){
    const ss=store.state.sessions.filter(s=>Date.parse(s.date)<=Date.now()),completed=ss.filter(s=>s.status==='completed');
    $('branches').innerHTML=[[completed.filter(T.completedStrength).length,'力量 · 完成场次'],[ss.reduce((a,s)=>a+(s.cardioMinutes||0),0),'有氧 · 分钟'],[ss.reduce((a,s)=>a+(s.mobilityMinutes||0),0),'活动度 · 分钟'],[completed.filter(s=>s.planId==='recovery').length,'恢复 · 记录日']].map(([v,label])=>`<div class="branch"><b>${v}</b><span>${label}</span></div>`).join('');
    const filter=$('tree-filter').value,at=now(),next=T.nextPlan(ss,at),all=[...ss.map(s=>({...s,legacy:false})),...legacy.map((s,i)=>({...s,id:'legacy-'+i,legacy:true}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
    let html=node(`<p class="node-date">下一步 · 尚未完成</p><h3>${esc(next.mode==='normal'?next.plan.name:'先恢复，再继续')}</h3><p class="small muted">${esc(next.reason)}</p><button type="button" data-go-today>查看训练安排 ↗</button>`,true);
    const filtered=all.filter(s=>filter==='all'||(filter==='legacy'?s.legacy:!s.legacy&&(filter==='strength'?T.plans.some(p=>p.id===s.planId):s.planId===filter||filter==='cardio'&&s.cardioMinutes>0||filter==='mobility'&&s.mobilityMinutes>0)));
    if(!filtered.length)html+=node('<p class="muted small">这个分支还没有记录。完成并保存一次训练后，这里会长出第一个节点。</p>');
    for(const s of filtered){
      const title=s.legacy?({legs:'旧记录 · 下肢',hiit:'旧记录 · HIIT'}[s.dayType]||'旧训练记录'):T.names[s.planId];
      let body;
      if(s.legacy)body=`<span class="badge">旧版只读</span><p class="small muted">原始次数与秒数语义不一致，保留明细，不用于新统计或加重建议。</p><details><summary>查看原始记录</summary><ul>${(s.exercises||[]).map(e=>`<li>${esc(e.name)} · ${esc(e.sets)} 组 · 原始数值 ${esc(e.reps)}${e.note?' · '+esc(e.note):''}</li>`).join('')}</ul></details>`;
      else body=`<span class="badge">${s.status==='completed'?'已完成':'部分完成'}</span>${s.duration!==null?`<span class="badge">馆内 ${s.duration}′</span>`:''}${s.cardioMinutes?`<span class="badge">有氧 ${s.cardioMinutes}′</span>`:''}${s.mobilityMinutes?`<span class="badge">活动度 ${s.mobilityMinutes}′</span>`:''}<p class="small muted">睡眠 ${s.readiness.sleep??'—'} 小时 · 精神 ${s.readiness.energy??'—'}/5 · ${s.readiness.pain==='yes'?'记录了疼痛':s.readiness.pain==='none'?'无痛':'疼痛未评价'}</p>${s.note?`<p class="small">${esc(s.note)}</p>`:''}<details><summary>逐组记录与实际反馈</summary>${s.exercises.map(e=>`<p><b>${esc(e.variant)}</b> · ${esc(e.equipment)}<br>${e.sets.filter(x=>x.done).map(x=>esc(setText(e,x))).join('<br>')||'未完成正式组'}<br>动作：${{good:'稳定',poor:'不稳定',unknown:'未评价'}[e.form]}；疼痛：${{none:'无',yes:'有',unknown:'未评价'}[e.pain]}${e.note?'<br>'+esc(e.note):''}</p>`).join('')||'<p>本次没有力量组记录。</p>'}</details><div class="buttons"><button type="button" data-muscle-date="${esc(T.dateKey(s.date))}">查看当天肌群</button><button type="button" data-edit="${esc(s.id)}">编辑</button><button type="button" data-archive="${esc(s.id)}">移至可恢复区</button></div>`;
      html+=node(`<p class="node-date">${esc(T.dateKey(s.date))} · ${new Intl.DateTimeFormat('en-GB',{timeZone:T.ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s.date))}</p><h3>${esc(title)}</h3>${body}`);
    }
    $('timeline').innerHTML=`<ol class="tree">${html}</ol><div class="root"><b>↟</b>起点 · 从真实记录开始<p>${esc(legacyMessage)}</p></div>`;
    $('trash-list').innerHTML='<h3>可恢复记录</h3>'+(store.state.trash.length?store.state.trash.map(s=>`<div class="measure-row"><span>${esc(T.dateKey(s.date))} · ${esc(T.names[s.planId])}</span><button type="button" data-restore="${esc(s.id)}">恢复记录</button></div>`).join(''):'<p class="small muted">没有已移出的记录。</p>');
  }
  function table(headers,rows){return `<table class="data"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
  function barChart(labels,series,caption){
    const width=620,height=230,left=36,bottom=188,plot=150,step=(width-left-15)/labels.length,max=Math.max(1,...series.flatMap(s=>s.values));
    let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(caption)}"><line x1="${left}" x2="610" y1="${bottom}" y2="${bottom}" stroke="#52694f"/>`;
    for(let i=0;i<3;i++){const value=max*i/2,y=bottom-plot*i/2;svg+=`<text x="27" y="${y+4}" text-anchor="end">${Number(value.toFixed(1))}</text>`;}
    labels.forEach((label,i)=>{const base=left+i*step+step*.12;series.forEach((s,j)=>{const bw=step*.7/series.length,v=s.values[i],h=v/max*plot;svg+=`<rect x="${base+j*bw}" y="${bottom-h}" width="${bw-3}" height="${h}" fill="${s.color}" rx="3"><title>${esc(label+' '+s.name+': '+v)}</title></rect>`;});svg+=`<text x="${left+(i+.5)*step}" y="211" text-anchor="middle">${esc(label)}</text>`;});
    return svg+'</svg><p class="legend">'+series.map(s=>`<span style="color:${s.color}">● ${esc(s.name)}</span>`).join('　')+'</p><details><summary>查看图表数据</summary><div class="table-scroll">'+table(['日期',...series.map(s=>s.name)],labels.map((l,i)=>[l,...series.map(s=>s.values[i])]))+'</div></details>';
  }
  function lineChart(points,caption,color='#c7e6ad'){
    if(!points.length)return empty('还没有可绘制的记录。');
    const w=620,h=235,l=45,r=590,b=185,top=25,max=Math.max(...points.map(p=>p.value)),min=Math.min(...points.map(p=>p.value));
    const padding=Math.max((max-min)*.15,max*.01,1),lo=Math.max(0,min-padding),hi=max+padding;
    const xy=points.map((p,i)=>({x:points.length===1?(l+r)/2:l+i*(r-l)/(points.length-1),y:b-(p.value-lo)/(hi-lo)*(b-top),p}));
    let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(caption)}"><text x="2" y="${top+4}">${hi.toFixed(1)}</text><text x="2" y="${b}">${lo.toFixed(1)}</text><line x1="${l}" x2="${r}" y1="${b}" y2="${b}" stroke="#52694f"/><polyline fill="none" stroke="${color}" stroke-width="2" points="${xy.map(p=>p.x+','+p.y).join(' ')}"/>`;
    xy.forEach(({x,y,p},i)=>{svg+=`<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${esc(p.date+': '+p.value.toFixed(1))}</title></circle>`;if(i===0||i===xy.length-1||xy.length<=6)svg+=`<text x="${x}" y="211" text-anchor="middle">${esc(p.date.slice(5))}</text><text class="value" x="${x}" y="${y-11}" text-anchor="middle">${Number(p.value.toFixed(1))}</text>`;});return svg+'</svg>';
  }
  function renderStats(){
    const weeks=T.weekly(store.state.sessions,now());$('frequency-chart').innerHTML=barChart(weeks.map(w=>w.label),[{name:'完成场次',values:weeks.map(w=>w.strength),color:'#c7e6ad'}],'每周力量训练完成场次')+`<p class="small muted">本周实际正式组数：${weeks.at(-1).sets}。旧版数据不混入新统计。</p>`;
    $('minutes-chart').innerHTML=barChart(weeks.map(w=>w.label),[{name:'有氧分钟',values:weeks.map(w=>w.cardio),color:'#a0cadd'},{name:'活动度分钟',values:weeks.map(w=>w.mobility),color:'#e2c58f'}],'每周有氧与活动度分钟');
    const previousKey=groups[Number($('exercise-choice').value)]?.key,map=new Map();
    for(const s of store.state.sessions.filter(s=>Date.parse(s.date)<=Date.now()).sort((a,b)=>new Date(a.date)-new Date(b.date)))for(const e of s.exercises){if(!e.sets.some(x=>x.done))continue;const key=T.identity(e);if(!map.has(key))map.set(key,{key,e,items:[]});map.get(key).items.push({s,e});}
    groups=[...map.values()];const selected=Math.max(0,groups.findIndex(g=>g.key===previousKey));$('exercise-choice').innerHTML=groups.length?options(groups.map((g,i)=>[String(i),g.e.variant+' · '+g.e.equipment+' · '+T.units[g.e.loadUnit]+' · '+unit(g.e)]),String(selected)):'<option value="">尚无动作记录</option>';
    if(groups.length&&!$('exercise-choice').value)$('exercise-choice').value='0';renderExerciseChart();renderMeasurements();
  }
  function renderExerciseChart(){const group=groups[Number($('exercise-choice').value)];if(!group){$('exercise-chart').innerHTML=empty('完成并保存逐组训练后，这里会显示同器械的进步。');$('exercise-table').innerHTML='';return;}const items=group.items.slice(-20),body=['body','band'].includes(group.e.loadUnit);const points=items.map(({s,e})=>({date:T.dateKey(s.date),value:Math.max(...e.sets.filter(x=>x.done).map(x=>body?x.value:x.load))}));$('exercise-chart').innerHTML=lineChart(points,body?'每次最大次数或秒数':'每次最大实际负重')+`<p class="small muted">最近 ${items.length} 次 · ${body?unit(group.e):esc(T.units[group.e.loadUnit])}${group.e.loadUnit==='assistance'?'；辅助重量越少通常越难，不按重量上升判断进步。':''}</p>`;$('exercise-table').innerHTML=table(['日期','完成组','逐组实际','状态'],items.map(({s,e})=>[T.dateKey(s.date),e.sets.filter(x=>x.done).length,e.sets.filter(x=>x.done).map(x=>setText(e,x)).join('；'),s.status==='completed'?'完成':'部分完成']));}
  function renderMeasurements(){
    const all=store.state.measurements.filter(m=>T.dateKey(m.date)<=T.dateKey(now())).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const weighted=all.filter(m=>m.weight!==null),daily=new Map();for(const m of weighted)daily.set(T.dateKey(m.date),m);
    const days=[...daily.values()];const points=days.slice(-30).map(m=>{const date=T.dateKey(m.date),window=days.filter(x=>{const diff=T.daysBetween(T.dateKey(x.date),date);return diff>=0&&diff<7;});return {date,value:window.reduce((a,x)=>a+x.weight,0)/window.length};});
    const waist=all.filter(m=>m.waist!==null).slice(-30).map(m=>({date:T.dateKey(m.date),value:m.waist}));
    $('body-chart').innerHTML='<h3>体重 · 7 天记录均值 kg</h3>'+lineChart(points,'体重7天记录均值')+'<h3>腰围 cm</h3>'+lineChart(waist,'腰围厘米','#e2c58f');
    $('measurement-list').innerHTML=all.slice(-10).reverse().map(m=>`<div class="measure-row"><span>${esc(T.dateKey(m.date))}</span><span>${m.weight??'—'} kg</span><span>${m.waist??'—'} cm</span><button type="button" data-measure="${esc(m.id)}">编辑</button></div>`).join('');
  }
  function renderAll(){renderSummary();renderTree();renderStats();updatePlan();}
  $('measurement-form').addEventListener('submit',event=>{event.preventDefault();try{const date=$('measure-date').value;if(date>T.dateKey(now()))throw new Error('不能记录未来测量');const existing=store.state.measurements.find(m=>T.dateKey(m.date)===date);const m=T.validateMeasurement({id:existing?.id||uid(),date:date+'T06:00:00+08:00',weight:num('measure-weight'),waist:num('measure-waist')});if(!mutate(s=>{const i=s.measurements.findIndex(x=>x.id===m.id);if(i>=0)s.measurements[i]=m;else s.measurements.push(m);} ))return;renderMeasurements();renderSummary();tell('测量已保存，同一天的测量会更新而不重复累计。');}catch(e){tell(e.message,true);}});
  document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.tab)showTab(b.dataset.tab);if(b.hasAttribute('data-go-today')){showTab('today');$('record-section').scrollIntoView({block:'start'});}if(b.dataset.edit)editSession(b.dataset.edit);if(b.dataset.archive)archive(b.dataset.archive);if(b.dataset.restore)restore(b.dataset.restore);if(b.dataset.measure){const m=store.state.measurements.find(x=>x.id===b.dataset.measure);$('measure-date').value=T.dateKey(m.date);$('measure-weight').value=m.weight??'';$('measure-waist').value=m.waist??'';$('measure-weight').focus();}if(b.dataset.timer){deadline=Date.now()+Number(b.dataset.timer)*1000;renderTimer();}});
  function renderTimer(){const seconds=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):0;$('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(deadline&&seconds===0){deadline=null;tell('休息计时结束。确认呼吸与动作准备好后，再开始下一组。');}}
  $('stop-timer').addEventListener('click',()=>{deadline=null;renderTimer();});setInterval(renderTimer,500);
  $('tree-filter').addEventListener('change',renderTree);$('exercise-choice').addEventListener('change',renderExerciseChart);$('toggle-trash').addEventListener('click',()=>{$('trash-list').hidden=!$('trash-list').hidden;});
  $('import-trigger').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('import').click();}});
  function download(content,filename){const blob=new Blob([content],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export').addEventListener('click',()=>{try{if(store.error){if(store.raw===null)throw new Error('无法读取本机存储，没有可导出的原始内容。');download(store.raw,'workout-raw-recovery-'+T.dateKey(now())+'.json');tell('已导出原始恢复文件；请保留，不要覆盖它。');return;}if(draft)captureExtras();const backup=T.validateState({...store.state,draft:draft||store.state.draft});download(JSON.stringify({...backup,exportedAt:now()},null,2),'workout-backup-'+T.dateKey(now())+'.json');lastExport=now();renderSummary();tell('备份下载已发起，包含当前内存草稿；请确认文件已保存。');}catch(e){tell(e.message,true);}});
  $('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('备份超过 5 MB，未读取。');if(draft&&!persistDraft())throw new Error('请先处理草稿保存错误。');const incoming=JSON.parse(await file.text()),result=T.mergeBackup(store.state,incoming);store.save(result.state);renderAll();draftButtons();tell(`导入完成：新增 ${result.added} 条，跳过相同标识 ${result.skipped} 条。已有记录不覆盖；备份草稿仅在本机没有草稿时恢复。`);}catch(e){tell('导入失败，原记录保持不变：'+e.message,true);}finally{event.target.value='';}});
  window.addEventListener('storage',event=>{if(event.key===JournalStore.KEY)storageError(new Error('另一页面更新了本机记录。请先导出本页草稿，再刷新；不要同时在多个页面编辑。'));});
  window.addEventListener('beforeunload',event=>{if(draft){captureExtras();if(!persistDraft()){event.preventDefault();event.returnValue='';}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&draft){captureExtras();persistDraft();}if(!document.hidden){renderTimer();if(tab==='today')updatePlan();}});
  renderSetup();$('measure-date').value=T.dateKey(now());$('measure-date').max=T.dateKey(now());renderAll();if(store.error)storageError(new Error('本机记录读取异常，已停止写入以保护原数据。请先导出原始恢复文件。'));
  fetch('log.json').then(r=>{if(!r.ok)throw new Error('旧记录读取失败');return r.json();}).then(data=>{if(!Array.isArray(data))throw new Error('旧记录格式错误');legacy=data.filter(s=>s&&typeof s.date==='string'&&Number.isFinite(Date.parse(s.date))&&Array.isArray(s.exercises));legacyMessage=`保留 ${legacy.length} 条旧版记录，仅展示，不混算新训练。`;renderTree();}).catch(()=>{legacyMessage='旧记录暂时未能读取；本机新记录仍可正常使用。';renderTree();});
})();
