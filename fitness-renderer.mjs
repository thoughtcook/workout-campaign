import * as THREE from './vendor/three.module.min.mjs';

// Presentation only. The CC0 MakeHuman surface in fitness-body.json is unchanged;
// these colours and the load-time bulk morph are applied in the viewer.
export const PALETTE={
  idle:'#c5ced4',
  primary:'#ff3a16',
  support:'#e09634',
  energy:'#2fce6a'
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0||1e-6),0,1);return t*t*(3-2*t);};

function radial(x,y,z,ax,ay,az,bx,by,bz,amount,outward){
  const abx=bx-ax,aby=by-ay,abz=bz-az,ab2=abx*abx+aby*aby+abz*abz||1;
  let t=((x-ax)*abx+(y-ay)*aby+(z-az)*abz)/ab2;t=clamp(t,0,1);
  const qx=ax+abx*t,qy=ay+aby*t,qz=az+abz*t;
  let dx=x-qx,dy=y-qy,dz=z-qz,d=Math.hypot(dx,dy,dz);
  if(d<1e-4||d>1.2)return [0,0,0];
  const w=amount*Math.sin(Math.PI*t)*smooth(0.04,0.2,d)*(1-smooth(0.92,1.2,d));
  dx=dx/d*w;dy=dy/d*w;dz=dz/d*w;
  if(outward&&dx*outward<0)dx*=0.28;
  return [dx,dy,dz];
}

// Broaden the existing max-muscle male into a more powerful silhouette.
// Offsets stay under 0.85 units (~8.5 cm) and fade out at the head, hands and feet.
export function athleticBulk(src){
  const out=new Float32Array(src.length),n=src.length/3;
  for(let i=0;i<n;i++){
    const x=src[i*3],y=src[i*3+1],z=src[i*3+2],ax=Math.abs(x),sx=x<0?-1:1;
    let dx=0,dy=0,dz=0;
    const protect=Math.max(smooth(7.15,7.7,y),smooth(-7.05,-7.65,y),smooth(4.35,5.05,ax)*smooth(2.7,2.15,y));
    const delt=smooth(1.15,1.7,ax)*(1-smooth(3.2,3.7,ax))*smooth(4.75,5.2,y)*(1-smooth(6.35,6.85,y));
    dx+=sx*0.55*delt;dy+=0.16*delt;dz+=0.06*delt;
    const yoke=(1-smooth(1.65,2.25,ax))*smooth(5.75,6.2,y)*(1-smooth(7.0,7.4,y));
    dx+=sx*0.16*yoke;dy+=0.08*yoke;
    const chest=(1-smooth(1.4,1.95,ax))*smooth(4.05,4.55,y)*(1-smooth(6.15,6.6,y))*smooth(0.05,0.65,z);
    const sternum=1-smooth(0.18,0.55,ax);
    dz+=0.48*chest*(1-0.62*sternum);dx+=sx*0.1*chest;dy+=0.05*chest;
    const lat=smooth(0.5,1.05,ax)*(1-smooth(1.85,2.35,ax))*smooth(2.95,3.5,y)*(1-smooth(4.4,4.95,y))*(1-smooth(0.2,0.85,z));
    dx+=sx*0.42*lat;dz-=0.06*lat;
    const waist=(1-smooth(1.25,1.75,ax))*smooth(2.05,2.5,y)*(1-smooth(3.35,3.9,y));
    dx-=sx*0.1*waist;
    const arm=radial(x,y,z,sx*2.15,5.35,0.12,sx*3.78,3.55,0.4,0.28,0);
    const fore=radial(x,y,z,sx*3.75,3.6,0.48,sx*4.9,2.55,2.35,0.18,0);
    const hand=1-smooth(2.3,2.9,z)*smooth(2.15,2.55,y);
    dx+=arm[0]+fore[0]*hand;dy+=arm[1]+fore[1]*hand;dz+=arm[2]+fore[2]*hand;
    const thigh=radial(x,y,z,sx*1.02,0.15,0.22,sx*1.22,-3.45,0.38,0.22,sx);
    dx+=thigh[0];dy+=thigh[1];dz+=thigh[2];
    const quad=smooth(0.5,0.9,ax)*(1-smooth(2.15,2.6,ax))*smooth(-3.2,-2.4,y)*(1-smooth(-0.15,0.45,y))*smooth(-0.1,0.35,z);
    dz+=0.22*quad;dx+=sx*0.1*quad;
    const glute=smooth(0.28,0.7,ax)*(1-smooth(1.95,2.4,ax))*smooth(-0.1,0.3,y)*(1-smooth(1.5,1.95,y))*(1-smooth(-0.05,0.5,z));
    dz-=0.3*glute;dx+=sx*0.1*glute;
    const ham=smooth(0.35,0.8,ax)*(1-smooth(2.1,2.55,ax))*smooth(-3.15,-2.4,y)*(1-smooth(-0.1,0.4,y))*(1-smooth(-0.05,0.4,z));
    dz-=0.1*ham;
    const calf=radial(x,y,z,sx*1.15,-3.25,-0.05,sx*1.55,-6.7,0.12,0.16,sx);
    dx+=calf[0];dy+=calf[1];dz+=calf[2];
    let ox=dx*(1-protect),oy=dy*(1-protect),oz=dz*(1-protect);
    const mag=Math.hypot(ox,oy,oz);
    if(mag>0.85){const s=0.85/mag;ox*=s;oy*=s;oz*=s;}
    out[i*3]=x+ox;out[i*3+1]=y+oy;out[i*3+2]=z+oz;
  }
  return out;
}

export function fiberDirection(x,y,z){
  const ax=Math.abs(x),sx=x<0?-1:1;
  let dx=0,dy=1,dz=0;
  if(ax>1.75&&y>2.05&&y<5.7){
    if(y>3.45){dx=0.78*sx;dy=-0.6;dz=0.12;}
    else{dx=0.32*sx;dy=-0.48;dz=0.78;}
  }else if(y>4.05&&y<6.45&&ax<1.95&&z>0.15){dx=0.92*sx;dy=0.28;dz=0.22;}
  else if(y>4.85&&y<6.5&&ax>1.15&&ax<3.4){dx=0.2*sx;dy=0.92;dz=0.15;}
  else if(y>1.5&&y<4.3&&ax<1.15&&z>0.45){dx=0.05*sx;dy=1;dz=0.08;}
  else if(z<0.15&&y>1.4&&y<5.2&&ax<2.2){dx=0.45*sx;dy=0.85;dz=-0.15;}
  else if(y<0.4&&y>-3.6){dx=0.05*sx;dy=1;dz=z>0?0.12:-0.08;}
  const m=Math.hypot(dx,dy,dz)||1;
  return [dx/m,dy/m,dz/m];
}

function compileMuscle(uniforms){
  return function(shader){
    Object.assign(shader.uniforms,{
      bodyEnergy:uniforms.energy,bodyBase:uniforms.base,bodyGlow:uniforms.glow,
      bodyLow:uniforms.low,bodyHigh:uniforms.high,bodyRole:uniforms.role,bodyInk:uniforms.ink
    });
    shader.vertexShader='attribute vec3 fiber; attribute float seam; varying float vBodyY; varying vec3 vObj; varying vec3 vObjN; varying vec3 vFiber; varying float vSeam;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vBodyY=position.y; vObj=position; vObjN=normal; vFiber=fiber; vSeam=seam;`);
    shader.fragmentShader='varying float vBodyY; varying vec3 vObj; varying vec3 vObjN; varying vec3 vFiber; varying float vSeam; uniform float bodyEnergy; uniform vec3 bodyBase; uniform float bodyGlow; uniform float bodyLow; uniform float bodyHigh; uniform float bodyRole; uniform vec3 bodyInk;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb=bodyBase;
      vec3 across=cross(normalize(vFiber),normalize(vObjN));
      float acrossLen=length(across);
      float ridges=acrossLen<1e-4?0.5:smoothstep(-0.2,0.85,sin(dot(vObj,across/acrossLen)*18.0));
      float fiberAmt=bodyRole>1.5?0.2:bodyRole>0.5?0.11:0.0;
      diffuseColor.rgb*=mix(1.0-fiberAmt,1.0+fiberAmt*0.35,ridges);
      diffuseColor.rgb*=mix(1.0,bodyRole>1.5?0.8:0.7,vSeam);
      float mid=smoothstep(0.38,0.0,abs(vObj.x));
      float pecs=smoothstep(4.1,4.65,vObj.y)*smoothstep(6.3,5.55,vObj.y)*smoothstep(0.2,0.75,vObj.z);
      float alba=smoothstep(1.65,2.15,vObj.y)*smoothstep(4.2,3.55,vObj.y)*smoothstep(0.75,1.1,vObj.z);
      diffuseColor.rgb*=mix(1.0,0.84,mid*max(pecs,alba));
      float shorts=smoothstep(1.5,1.18,vBodyY)*smoothstep(-0.05,0.28,vBodyY)*smoothstep(1.75,1.15,abs(vObj.x));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.18,0.2,0.24),shorts*(bodyRole>0.5?0.25:1.0));
      float level=(vBodyY-bodyLow)/max(0.01,bodyHigh-bodyLow);
      float filled=bodyEnergy<=0.0?0.0:1.0-smoothstep(bodyEnergy-0.04,bodyEnergy+0.012,level);
      diffuseColor.rgb=mix(diffuseColor.rgb,bodyInk,filled);
      totalEmissiveRadiance+=bodyInk*filled*(0.35+bodyGlow);`);
  };
}

export async function createViewer(host,onSelect){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.08;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','可旋转的运动人体模型，左右拖动或使用下方肌群按钮');
  host.replaceChildren(canvas);
  let response;
  try{response=await fetch(new URL('./assets/fitness-body.json',import.meta.url),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Model HTTP '+response.status);}
  catch(e){renderer.dispose();throw e;}
  const data=await response.json();
  const scene=new THREE.Scene(),body=new THREE.Group();scene.add(body);
  const camera=new THREE.PerspectiveCamera(33,1,.1,150);
  scene.add(new THREE.HemisphereLight(0xd7e4ee,0x141c20,0.32));
  for(const [color,intensity,position]of [[0xfff6ee,3.05,[4.2,14,9.5]],[0x8ea6bc,0.32,[-10,4.2,4.5]],[0xe7f3ff,1.7,[-1.6,9,-12]],[0xffc7a4,0.18,[0.2,-3,7]]]){
    const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
  }
  const bulked=athleticBulk(data.positions);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(bulked,3));
  const all=Object.values(data.regions).flat();geometry.setIndex(all);geometry.computeVertexNormals();
  geometry.clearGroups();
  const materials=[],regions=[],members=Array.from({length:bulked.length/3},()=>new Set());let offset=0;
  const colors=new THREE.Float32BufferAttribute(new Float32Array(bulked.length),3);geometry.setAttribute('color',colors);
  const fibers=new Float32Array(bulked.length),seam=new Float32Array(bulked.length/3);
  for(let i=0;i<seam.length;i++){const d=fiberDirection(bulked[i*3],bulked[i*3+1],bulked[i*3+2]);fibers[i*3]=d[0];fibers[i*3+1]=d[1];fibers[i*3+2]=d[2];}
  const ink=new THREE.Color(PALETTE.energy);
  for(const [id,indices]of Object.entries(data.regions)){
    if(!indices.length)continue;
    const ys=indices.map(i=>bulked[i*3+1]),min=Math.min(...ys),max=Math.max(...ys);
    const uniforms={energy:{value:0},base:{value:new THREE.Color(PALETTE.idle)},glow:{value:0},low:{value:min},high:{value:max},role:{value:0},ink:{value:ink}};
    for(const i of indices)members[i].add(id);
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.46,metalness:.16});
    material.userData.uniforms=uniforms;
    material.onBeforeCompile=compileMuscle(uniforms);
    material.customProgramCacheKey=()=>'fitness-muscle-v6';
    geometry.addGroup(offset,indices.length,materials.length);offset+=indices.length;
    materials.push(material);regions.push({id,material,uniforms});
  }
  for(let i=0;i<seam.length;i++)if(members[i].size>1)seam[i]=1;
  const spread=new Float32Array(seam);
  for(const indices of Object.values(data.regions)){
    for(let t=0;t<indices.length;t+=3){
      const a=indices[t],b=indices[t+1],c=indices[t+2],edge=Math.max(seam[a],seam[b],seam[c]);
      if(edge<=0)continue;
      if(seam[a]<1)spread[a]=Math.max(spread[a],.58);
      if(seam[b]<1)spread[b]=Math.max(spread[b],.58);
      if(seam[c]<1)spread[c]=Math.max(spread[c],.58);
    }
  }
  geometry.setAttribute('fiber',new THREE.BufferAttribute(fibers,3));
  geometry.setAttribute('seam',new THREE.BufferAttribute(spread,1));
  const mesh=new THREE.Mesh(geometry,materials);body.add(mesh);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(3.2,48),new THREE.MeshBasicMaterial({color:0x10211c,transparent:true,opacity:.34,depthWrite:false}));
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
    for(const r of regions){const g=state?.data?.groups[r.id];r.uniforms.energy.value=(g?.percent||0)/100*progress;r.uniforms.glow.value=(1-progress)*.55;}
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
        const g=next.data.groups[r.id],active=!!(g&&g.state!=='idle'),role=active?(g.secondary?1:2):0;
        r.uniforms.role.value=role;
        r.uniforms.base.value.set(role===2?PALETTE.primary:role===1?PALETTE.support:PALETTE.idle);
        const selected=next.selected===r.id;
        r.material.roughness=selected?.28:role===2?.36:role===1?.46:.4;
        r.material.metalness=role===0?.26:.02;
        r.material.emissive.set(selected?(role===2?'#ff6a45':'#f4f7f8'):'#000000');
        r.material.emissiveIntensity=selected?.26:0;
        r.uniforms.energy.value=(g?.percent||0)/100;r.uniforms.glow.value=0;
      }
      const rank=Object.fromEntries(regions.map(r=>[r.id,r.uniforms.role.value]));
      const chosen=new THREE.Color();
      for(let i=0;i<members.length;i++){
        let best=-1,id=null;
        for(const member of members[i])if((rank[member]??0)>=best){best=rank[member]??0;id=member;}
        chosen.copy(id?regions.find(r=>r.id===id).uniforms.base.value:new THREE.Color(PALETTE.idle));
        colors.setXYZ(i,chosen.r,chosen.g,chosen.b);
      }
      colors.needsUpdate=true;
      if(next.animate&&!reduced){energyStart=performance.now();animation=requestAnimationFrame(paint);}else render();
    },
    command(cmd){if(cmd==='in')zoom=Math.min(1.6,zoom+.15);if(cmd==='out')zoom=Math.max(.8,zoom-.15);if(cmd==='reset'){zoom=1;body.rotation.y=side==='back'?Math.PI:side==='both'?-.45:0;}resize();}
  };
}
