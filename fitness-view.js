(function(){
  'use strict';
  let viewer=null,loading=null,latest=null;
  const host=()=>document.getElementById('fitness-stage');
  function status(message){document.getElementById('fitness-status').textContent=message;}
  async function start(){
    try{
      const {createViewer}=await import('./fitness-renderer.mjs?v=6');
      viewer=await createViewer(host(),id=>document.dispatchEvent(new CustomEvent('fitness-select',{detail:id})));
      document.getElementById('body-model').hidden=true;
      host().classList.add('ready');
      status('左右拖动旋转 · 点按肌群 · ＋／－缩放');
      viewer.update(latest);
    }catch(error){
      console.error('Fitness model initialization failed:',error);
      viewer=null;
      status('立体模型暂不可用，已显示可操作的肌群平面图。');
      host().classList.remove('ready');host().replaceChildren();
      document.getElementById('body-model').hidden=false;
      const retry=document.createElement('button');retry.type='button';retry.textContent='重新加载立体模型';
      retry.onclick=()=>{retry.remove();loading=null;window.FitnessBody.update(latest);};
      document.getElementById('fitness-status').append(' ',retry);
    }
  }
  window.FitnessBody={
    update(state){latest=state;if(viewer)viewer.update(state);else if(!loading){status('正在加载运动模型…');loading=start();}},
    command(command){viewer?.command(command);}
  };
  document.addEventListener('click',e=>{const b=e.target.closest('[data-fitness-command]');if(b)window.FitnessBody.command(b.dataset.fitnessCommand);});
})();
