(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Muscles=api;})(globalThis,function(){
  'use strict';
  const GROUPS={
    chest:{name:'胸肌',detail:'胸大肌',views:['front']},shoulders:{name:'肩部',detail:'三角肌',views:['front','back']},biceps:{name:'肱二头肌',detail:'上臂前侧',views:['front']},triceps:{name:'肱三头肌',detail:'上臂后侧',views:['back']},forearms:{name:'前臂',detail:'前臂肌群',views:['front','back']},abs:{name:'腹部核心',detail:'腹部核心肌群',views:['front']},obliques:{name:'腹斜肌',detail:'躯干两侧',views:['front']},lats:{name:'背阔肌',detail:'背部外侧',views:['back']},midback:{name:'上中背',detail:'斜方肌、菱形肌区域',views:['back']},lowerback:{name:'腰背稳定肌',detail:'脊柱两侧稳定肌群',views:['back']},glutes:{name:'臀部',detail:'臀肌群',views:['back']},quads:{name:'股四头肌',detail:'大腿前侧',views:['front']},adductors:{name:'内收肌',detail:'大腿内侧',views:['front']},hamstrings:{name:'腘绳肌',detail:'大腿后侧',views:['back']},calves:{name:'小腿',detail:'小腿后侧肌群',views:['back']}
  };
  const MOVEMENTS={};
  function add(names,primary,secondary=[]){for(const n of names)MOVEMENTS[n]={primary,secondary};}
  add(['器械胸推','哑铃卧推'],['chest'],['shoulders','triceps']);
  add(['上斜哑铃推胸','上斜器械推胸'],['chest','shoulders'],['triceps']);
  add(['坐姿划船','胸托划船','胸托哑铃划船'],['midback','lats'],['biceps','forearms','shoulders']);
  add(['高位下拉','辅助引体向上'],['lats'],['biceps','midback','forearms']);
  add(['哑铃侧平举','绳索侧平举'],['shoulders']);
  add(['Pallof 抗旋转推'],['obliques','abs']);
  add(['屈膝侧平板','侧平板'],['obliques'],['abs','glutes']);
  add(['腿举'],['quads','glutes'],['adductors']);
  add(['高脚杯深蹲'],['quads','glutes'],['adductors','abs']);
  add(['地面臀桥','器械臀推'],['glutes'],['hamstrings','abs']);
  add(['腿弯举','坐姿 / 俯卧腿弯举','滑垫腿弯举'],['hamstrings'],['calves']);
  add(['提踵','器械提踵','扶稳站姿提踵'],['calves']);
  add(['鸟狗式','仅伸手的鸟狗式'],['abs','lowerback'],['glutes','shoulders']);
  add(['哑铃罗马尼亚硬拉'],['hamstrings','glutes'],['lowerback','forearms','adductors']);
  add(['扶稳分腿蹲'],['quads','glutes'],['adductors','abs']);
  add(['绳索下压','轻哑铃臂屈伸'],['triceps']);
  add(['哑铃弯举','绳索弯举'],['biceps'],['forearms']);
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function resolve(e){return MOVEMENTS[String(e.variant||e.name||'').trim()]||null;}
  function doneSets(e){return (e.sets||[]).filter(s=>s.done===true&&typeof s.load==='number'&&Number.isFinite(s.load)&&s.load>=0&&s.load<=1000&&typeof s.value==='number'&&Number.isFinite(s.value)&&s.value>0&&(e.metric!=='reps'||Number.isInteger(s.value))).length;}
  function summarize(planned=[],actual=[]){
    const groups=Object.fromEntries(Object.entries(GROUPS).map(([id,g])=>[id,{id,...g,targetPrimary:0,targetSecondary:0,donePrimary:0,doneSecondary:0,moves:[],percent:0,state:'idle'}]));
    const unknown=new Set();
    function visit(e,isActual){
      const map=resolve(e);if(!map){unknown.add(e.variant||e.name||'未知动作');return;}
      const count=isActual?doneSets(e):Math.max(0,Number(e.targetSets)||0);
      for(const role of ['primary','secondary'])for(const id of new Set(map[role])){
        const g=groups[id];g[isActual?(role==='primary'?'donePrimary':'doneSecondary'):(role==='primary'?'targetPrimary':'targetSecondary')]+=count;
        let move=g.moves.find(m=>m.id===e.id&&m.name===e.variant&&m.role===role);
        if(!move){move={id:e.id,name:e.variant||e.name,role,target:0,done:0};g.moves.push(move);}
        move[isActual?'done':'target']+=count;
      }
    }
    planned.forEach(e=>visit(e,false));actual.forEach(e=>visit(e,true));
    for(const g of Object.values(groups)){
      const target=g.targetPrimary+g.targetSecondary,done=g.donePrimary+g.doneSecondary;
      g.percent=target>0?Math.min(100,Math.round(done/target*100)):0;
      g.state=done>0?(g.percent===100?'charged':'partial'):target>0?'planned':'idle';
      g.secondary=g.targetPrimary===0&&g.donePrimary===0;
    }
    return {groups,unknown:[...unknown],active:Object.values(groups).filter(g=>g.state!=='idle')};
  }
  // Vector schematic, not a diagnostic anatomical atlas. Calves are shown on the
  // posterior view only; anterior shins are deliberately not labelled as calves.
  const SHAPE={
    front:{
      shoulders:['M78 99Q59 99 52 122L51 142Q65 142 74 126Z'],
      chest:['M82 107Q98 106 117 113L117 150Q101 166 79 151L74 128Z'],
      biceps:['M51 146Q61 142 68 150L62 181Q57 197 46 192L45 178Z'],
      forearms:['M45 198L57 201Q54 230 45 254L34 259Q33 238 38 216Z'],
      abs:['M103 164L117 162L117 185L103 185Z M103 189L117 189L117 211L104 211Z M105 215L117 215L117 241L109 251Z'],
      obliques:['M79 159L98 170L100 211L106 249L90 239L83 208Z'],
      quads:['M85 270Q99 262 109 282L107 329L101 367Q87 376 77 359L73 315Z'],
      adductors:['M111 277L118 273L115 316L110 349L106 359L111 320Z']
    },
    back:{
      shoulders:['M78 99Q59 99 52 122L51 142Q65 142 77 125Z'],
      midback:['M107 84L117 91L117 164L101 181L81 137L79 110Z'],
      lats:['M79 142L98 164L116 181L109 226L91 237L81 203Z'],
      lowerback:['M111 190L118 182L118 251L107 257L104 237Z'],
      triceps:['M51 146Q64 141 68 152L61 181Q55 200 44 190L44 177Z'],
      forearms:['M45 198L57 201Q54 230 45 254L34 259Q33 238 38 216Z'],
      glutes:['M89 245Q105 245 118 262L117 293Q96 307 78 290L79 271Z'],
      hamstrings:['M78 299Q98 310 114 300L109 341L104 370L93 379L79 365L74 329Z'],
      calves:['M82 394Q96 388 105 402L103 436L93 467L85 466L77 433Z']
    }
  };
  const SILHOUETTE='M106 74L105 88L79 96Q58 96 49 114L40 155L33 194L25 239L23 267L18 281Q19 291 28 293L35 285L38 268L48 245L59 214L64 183L71 155L77 185L81 220L79 246L70 283L66 318L70 360L75 383L71 413L74 454L76 489L68 507Q65 516 75 518L91 517L99 505L99 482L105 451L111 411L109 382L114 351L118 309L120 297L122 309L126 351L131 382L129 411L135 451L141 482L141 505L149 517L165 518Q175 516 172 507L164 489L166 454L169 413L165 383L170 360L174 318L170 283L161 246L159 220L163 185L169 155L176 183L181 214L192 245L202 268L205 285L212 293Q221 291 222 281L217 267L215 239L207 194L200 155L191 114Q182 96 161 96L135 88L134 74Z';
  function svg(side,data,selected,animate=false){
    if(!SHAPE[side])throw new Error('Unknown body view');
    const defs=[],regions=[];
    for(const [id,paths] of Object.entries(SHAPE[side])){
      const g=data.groups[id],gradient=`body-${side}-${id}`,percent=g.percent;
      const base=g.state==='idle'?'#8d9aa3':g.secondary?'#e09634':'#ff3a16';
      defs.push(`<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="${100-percent}%" stop-color="${base}"/><stop offset="${100-percent}%" stop-color="#b8f5c8"/><stop offset="100%" stop-color="#2fce6a"/></linearGradient>`);
      const label=`${g.name}，${g.state==='idle'?'未列入本次训练':g.secondary?'协同参与':'主要训练'}，已记录 ${g.donePrimary+g.doneSecondary} 组，目标 ${g.targetPrimary+g.targetSecondary} 组`;
      const geometry=paths.map(p=>`<path d="${p}"/><path d="${p}" transform="translate(240 0) scale(-1 1)"/>`).join('');
      regions.push(`<g class="muscle-region state-${g.state}${g.secondary?' secondary':''}${selected===id?' selected':''}${animate&&percent>0?' energy-inject':''}" data-muscle="${id}" role="button" tabindex="0" aria-label="${escape(label)}" aria-pressed="${selected===id}" style="fill:url(#${gradient})"><title>${escape(label)}</title>${geometry}</g>`);
    }
    return `<svg viewBox="0 0 240 540" class="anatomy-svg" role="group" aria-label="${side==='front'?'正面':'背面'}肌群示意图，可点击肌群查看动作"><defs>${defs.join('')}</defs><ellipse class="body-halo" cx="120" cy="276" rx="103" ry="235"/><path class="body-outline" d="${SILHOUETTE}"/><path class="body-head" d="M101 32Q102 12 120 12Q138 12 139 32L137 57Q132 76 120 79Q108 76 103 57Z"/><path class="body-lines" d="M120 93V251M78 386L103 386M137 386L162 386M84 477L95 478M145 478L156 477"/>${regions.join('')}<text class="body-view-label" x="120" y="537" text-anchor="middle">${side==='front'?'ANTERIOR · 正面':'POSTERIOR · 背面'}</text></svg>`;
  }
  return {GROUPS,MOVEMENTS,resolve,doneSets,summarize,svg};
});
