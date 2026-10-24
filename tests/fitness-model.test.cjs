const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const model=JSON.parse(fs.readFileSync(path.join(root,'assets/fitness-body.json')));
const Muscles=require('../muscle-map.js');

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
});
