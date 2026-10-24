const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const model=JSON.parse(fs.readFileSync(path.join(root,'assets/fitness-body.json')));
const Muscles=require('../muscle-map.js');

function extent(positions,indices,axis){
  let lo=Infinity,hi=-Infinity;
  for(const i of new Set(indices)){const v=positions[i*3+axis];if(v<lo)lo=v;if(v>hi)hi=v;}
  return [lo,hi];
}

test('fitness surface has real bounded geometry and complete muscle territories',()=>{
  assert.ok(model.positions.length/3>10000);
  assert.ok(model.positions.every(Number.isFinite));
  assert.equal(model.positions.length%3,0);
  for(const id of Object.keys(Muscles.GROUPS))assert.ok(model.regions[id]?.length>0,id);
  const used=new Set();
  for(const [id,indices]of Object.entries(model.regions)){
    assert.ok(id==='neutral'||Muscles.GROUPS[id]);
    assert.equal(indices.length%3,0);
    for(const i of indices){assert.ok(Number.isInteger(i)&&i>=0&&i<model.positions.length/3);used.add(i);}
  }
  assert.equal(used.size,model.positions.length/3);
  assert.ok(fs.statSync(path.join(root,'assets/fitness-body.json')).size<800000);
});
test('athletic presentation adds mass without flipping or leaving the body',async()=>{
  const {athleticBulk,fiberDirection,PALETTE}=await import(pathToFileURL(path.join(root,'fitness-renderer.mjs')));
  const out=athleticBulk(model.positions);
  assert.equal(out.length,model.positions.length);
  let max=0,head=0,feet=0;
  for(let i=0;i<out.length;i+=3){
    assert.ok(Number.isFinite(out[i])&&Number.isFinite(out[i+1])&&Number.isFinite(out[i+2]));
    max=Math.max(max,Math.hypot(out[i]-model.positions[i],out[i+1]-model.positions[i+1],out[i+2]-model.positions[i+2]));
    if(model.positions[i+1]>7.85)head=Math.max(head,Math.abs(out[i+1]-model.positions[i+1])+Math.abs(out[i]-model.positions[i]));
    if(model.positions[i+1]<-7.75)feet=Math.max(feet,Math.hypot(out[i]-model.positions[i],out[i+1]-model.positions[i+1],out[i+2]-model.positions[i+2]));
  }
  assert.ok(max>0.25&&max<0.9,`max offset ${max}`);
  assert.ok(head<0.04&&feet<0.04);
  const shoulder0=extent(model.positions,model.regions.shoulders,0),shoulder1=extent(out,model.regions.shoulders,0);
  const chest0=extent(model.positions,model.regions.chest,2),chest1=extent(out,model.regions.chest,2);
  assert.ok(shoulder1[1]>shoulder0[1]+0.12);
  assert.ok(chest1[1]>chest0[1]+0.1);
  let faces=0,flipped=0;
  for(const indices of Object.values(model.regions)){
    for(let t=0;t<indices.length;t+=3){
      const a=indices[t],b=indices[t+1],c=indices[t+2];
      const sign=(pos)=>{
        const ax=pos[b*3]-pos[a*3],ay=pos[b*3+1]-pos[a*3+1],az=pos[b*3+2]-pos[a*3+2];
        const bx=pos[c*3]-pos[a*3],by=pos[c*3+1]-pos[a*3+1],bz=pos[c*3+2]-pos[a*3+2];
        return [ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
      };
      const n0=sign(model.positions),n1=sign(out);
      if(n0[0]*n1[0]+n0[1]*n1[1]+n0[2]*n1[2]<0)flipped++;
      faces++;
    }
  }
  assert.ok(flipped/faces<0.005,`${flipped}/${faces} flipped`);
  for(const sample of [[0,2,0],[1.2,5,0.4],[-3,4,0.2],[1.4,-2,0.5]]){
    const d=fiberDirection(...sample);
    assert.ok(Math.abs(Math.hypot(...d)-1)<1e-6);
  }
  for(const file of ['fitness-renderer.mjs','muscle-map.js','styles.css']){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    for(const hex of [PALETTE.idle,PALETTE.primary,PALETTE.support,PALETTE.energy])assert.ok(text.includes(hex),`${file} ${hex}`);
  }
});

test('real Three.js constructs finite smooth normals across region boundaries',async()=>{
  const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.min.mjs')));
  assert.equal(THREE.REVISION,'170');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(model.positions,3));
  geometry.setIndex(Object.values(model.regions).flat());geometry.computeVertexNormals();
  assert.ok([...geometry.attributes.normal.array].every(Number.isFinite));
  const normals=geometry.attributes.normal.array;
  for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);assert.ok(length>.99&&length<1.01);}
  // The custom fill runs after totalEmissiveRadiance has been declared.
  const shader=THREE.ShaderLib.standard.fragmentShader;
  assert.ok(shader.indexOf('vec3 totalEmissiveRadiance')<shader.indexOf('#include <color_fragment>'));
});

test('viewer initializes actual model, updates regions and accepts zoom controls',async(t)=>{
  // Replace only the GPU renderer and browser I/O. Execute the complete viewer
  // with real Three.js geometry/materials to catch initialization exceptions.
  const rendererPath=path.join(root,'fitness-renderer.mjs');
  const threeURL=pathToFileURL(path.join(root,'vendor/three.module.min.mjs')).href;
  let source=fs.readFileSync(rendererPath,'utf8')
    .replace("'./vendor/three.module.min.mjs'",JSON.stringify(threeURL))
    .replace('new THREE.WebGLRenderer(', 'globalThis.__fitnessTestRenderer(')
    .replaceAll('import.meta.url',JSON.stringify(pathToFileURL(rendererPath).href));
  let renders=0,lastScene;
  const canvas={setAttribute(){},addEventListener(){}};
  const globals={
    __fitnessTestRenderer:()=>({domElement:canvas,setPixelRatio(){},setSize(){},dispose(){},render(scene){renders++;lastScene=scene;}}),
    window:{devicePixelRatio:2,matchMedia:()=>({matches:true})},
    document:{hidden:false,addEventListener(){}},
    ResizeObserver:class{observe(){}},
    fetch:async()=>({ok:true,json:async()=>model}),
    cancelAnimationFrame(){}
  };
  for(const [key,value]of Object.entries(globals)){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});}
  const {createViewer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const host={clientWidth:350,clientHeight:420,getBoundingClientRect:()=>({width:350}),replaceChildren(child){assert.equal(child,canvas);}};
  const viewer=await createViewer(host,()=>{});
  const data=Muscles.summarize([{variant:'器械胸推',targetSets:2}],[]);
  viewer.update({data,side:'front',selected:'chest',animate:false});
  viewer.command('in');viewer.command('out');viewer.command('reset');
  viewer.update({data,side:'back',selected:'triceps',animate:false});
  assert.ok(renders>=6);
  const body=lastScene.children.find(child=>child.isGroup).children[0];
  assert.equal(body.geometry.groups.length,Object.keys(model.regions).length);
  assert.ok([...body.geometry.attributes.color.array].every(Number.isFinite));
  assert.ok(body.geometry.attributes.fiber);
  assert.ok(body.geometry.attributes.seam);
  const chest=body.material.find(m=>m.userData.uniforms.role.value===2);
  const support=body.material.find(m=>m.userData.uniforms.role.value===1);
  const idle=body.material.find(m=>m.userData.uniforms.role.value===0);
  assert.ok(chest&&support&&idle);
  assert.ok(chest.userData.uniforms.base.value.r>chest.userData.uniforms.base.value.b);
  assert.ok(support.userData.uniforms.base.value.r>support.userData.uniforms.base.value.b);
  assert.ok(chest.userData.uniforms.base.value.r>support.userData.uniforms.base.value.r);
});
