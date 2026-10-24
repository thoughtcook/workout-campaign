import * as THREE from './vendor/three.module.min.mjs';

export async function createViewer(host,onSelect){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','可旋转的运动人体模型，左右拖动或使用下方肌群按钮');
  host.replaceChildren(canvas);
  let response;
  try{response=await fetch(new URL('./assets/fitness-body.json',import.meta.url),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Model HTTP '+response.status);}
  catch(e){renderer.dispose();throw e;}
  const data=await response.json();
  const scene=new THREE.Scene(),body=new THREE.Group();scene.add(body);
  const camera=new THREE.PerspectiveCamera(33,1,.1,150);
  scene.add(new THREE.HemisphereLight(0xeaf6ff,0x53625c,2.1));
  for(const [color,intensity,position]of [[0xffffff,3,[7,12,16]],[0xc5dbeb,1.8,[-9,5,5]],[0xffd4b0,2,[3,9,-12]]]){
    const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  const all=Object.values(data.regions).flat();geometry.setIndex(all);geometry.computeVertexNormals();
  geometry.clearGroups();
  const materials=[],regions=[],members=Array.from({length:data.positions.length/3},()=>new Set());let offset=0;
  const colors=new THREE.Float32BufferAttribute(new Float32Array(data.positions.length),3);geometry.setAttribute('color',colors);
  for(const [id,indices]of Object.entries(data.regions)){
    if(!indices.length)continue;
    const ys=indices.map(i=>data.positions[i*3+1]),min=Math.min(...ys),max=Math.max(...ys);
    const uniforms={energy:{value:0},base:{value:new THREE.Color('#aeb8bc')},glow:{value:0},low:{value:min},high:{value:max}};
    for(const i of indices)members[i].add(id);
    const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.55,metalness:.12});
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{bodyEnergy:uniforms.energy,bodyBase:uniforms.base,bodyGlow:uniforms.glow,bodyLow:uniforms.low,bodyHigh:uniforms.high});
      shader.vertexShader='varying float vBodyY;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBodyY = position.y;');
      shader.fragmentShader='varying float vBodyY; uniform float bodyEnergy; uniform vec3 bodyBase; uniform float bodyGlow; uniform float bodyLow; uniform float bodyHigh;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float level = (vBodyY-bodyLow)/max(.01,bodyHigh-bodyLow);
        float filled = bodyEnergy <= 0.0 ? 0.0 : 1.0-smoothstep(bodyEnergy-.025,bodyEnergy+.025,level);
        if(vBodyY < 1.65 && vBodyY > -.4) diffuseColor.rgb *= .48;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.28,.86,.48),filled);
        totalEmissiveRadiance += vec3(.16,.7,.30)*filled*(.12+bodyGlow);`);
    };
    geometry.addGroup(offset,indices.length,materials.length);offset+=indices.length;
    materials.push(material);regions.push({id,material,uniforms});
  }
  const mesh=new THREE.Mesh(geometry,materials);body.add(mesh);
  // Source is a complete CC0 outer surface; no internal anatomical meshes.
  const floor=new THREE.Mesh(new THREE.CircleGeometry(3.2,48),new THREE.MeshBasicMaterial({color:0x597668,transparent:true,opacity:.18,depthWrite:false}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,-8.22,.6);scene.add(floor);
  let zoom=1,side=null,state=null,animation=0,energyStart=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render=()=>{if(host.getBoundingClientRect().width>0&&!document.hidden)renderer.render(scene,camera);};
  function resize(){
    const w=host.clientWidth||300,h=host.clientHeight||430;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    const distance=Math.max(19/(2*Math.tan(THREE.MathUtils.degToRad(16.5))),12.4/(2*Math.tan(THREE.MathUtils.degToRad(16.5))*camera.aspect));
    camera.position.set(0,.7,distance/zoom);camera.lookAt(0,.5,0);camera.updateProjectionMatrix();render();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  function paint(t){
    const progress=Math.min(1,(t-energyStart)/850);
    for(const r of regions){const g=state?.data?.groups[r.id];r.uniforms.energy.value=(g?.percent||0)/100*progress;r.uniforms.glow.value=(1-progress)*.5;}
    render();if(progress<1)animation=requestAnimationFrame(paint);else animation=0;
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let gesture=null;
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,angle:body.rotation.y,moved:false};});
  canvas.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(Math.abs(dx)>6&&Math.abs(dx)>Math.abs(dy)){
      gesture.moved=true;canvas.setPointerCapture(e.pointerId);body.rotation.y=gesture.angle+dx*.012;render();
    }
  });
  canvas.addEventListener('pointerup',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const tap=!gesture.moved&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<8;gesture=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(!tap)return;
    const box=canvas.getBoundingClientRect();pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(mesh)[0];
    const id=hit&&regions[hit.face.materialIndex]?.id;if(id&&id!=='neutral')onSelect(id);
  });
  canvas.addEventListener('pointercancel',()=>{gesture=null;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animation);host.classList.remove('ready');document.getElementById('body-model').hidden=false;document.getElementById('fitness-status').textContent='立体显示已暂停，当前使用肌群平面图。';});
  canvas.addEventListener('webglcontextrestored',()=>{host.classList.add('ready');document.getElementById('body-model').hidden=true;document.getElementById('fitness-status').textContent='左右拖动旋转 · 点按肌群 · ＋／－缩放';render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  resize();
  return {
    update(next){
      if(!next)return;state=next;cancelAnimationFrame(animation);
      if(side!==next.side){side=next.side;body.rotation.y=side==='back'?Math.PI:side==='both'?-.45:0;}
      for(const r of regions){
        const g=next.data.groups[r.id];
        r.uniforms.base.value.set(g&&g.state!=='idle'?(g.secondary?'#cca772':'#ed754c'):'#aeb8bc');
        r.material.roughness=next.selected===r.id ? .38 : .55;
        r.material.emissive.set(next.selected===r.id?'#29251e':'#000000');
        r.uniforms.energy.value=(g?.percent||0)/100;r.uniforms.glow.value=0;
      }
      const palette=Object.fromEntries(regions.map(r=>[r.id,r.uniforms.base.value]));
      const blended=new THREE.Color();
      for(let i=0;i<members.length;i++){blended.setRGB(0,0,0);for(const id of members[i])blended.add(palette[id]);blended.multiplyScalar(1/(members[i].size||1));colors.setXYZ(i,blended.r,blended.g,blended.b);}
      colors.needsUpdate=true;
      if(next.animate&&!reduced){energyStart=performance.now();animation=requestAnimationFrame(paint);}else render();
    },
    command(cmd){if(cmd==='in')zoom=Math.min(1.6,zoom+.15);if(cmd==='out')zoom=Math.max(.8,zoom-.15);if(cmd==='reset'){zoom=1;body.rotation.y=side==='back'?Math.PI:side==='both'?-.45:0;}resize();}
  };
}
