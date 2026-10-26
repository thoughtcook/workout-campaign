const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const Muscles=require('../muscle-map.js');
const glbPath=path.join(root,'assets/strong-body.glb');

function readGlb(file){
  const data=fs.readFileSync(file);
  const magic=data.readUInt32LE(0), version=data.readUInt32LE(4), length=data.readUInt32LE(8);
  assert.equal(magic,0x46546c67);
  assert.equal(version,2);
  assert.equal(length,data.length);
  let offset=12, json, bin;
  while(offset+8<=length){
    const chunkLength=data.readUInt32LE(offset), chunkType=data.readUInt32LE(offset+4);
    const start=offset+8;
    if(chunkType===0x4e4f534a) json=JSON.parse(data.subarray(start,start+chunkLength).toString('utf8'));
    else if(chunkType===0x004e4942) bin=data.subarray(start,start+chunkLength);
    offset=start+chunkLength;
  }
  return {json, bin};
}

function regionGeometry(file){
  const {json, bin}=readGlb(file);
  const primitive=json.meshes[0].primitives[0];
  const position=json.accessors[primitive.attributes.POSITION];
  const positionView=json.bufferViews[position.bufferView];
  const positions=new Float32Array(bin.buffer, bin.byteOffset+(positionView.byteOffset||0), position.count*3);
  const indexAccessor=json.accessors[primitive.indices];
  const indexView=json.bufferViews[indexAccessor.bufferView];
  const ArrayType=indexAccessor.componentType===5123?Uint16Array:Uint32Array;
  const indices=new ArrayType(bin.buffer, bin.byteOffset+(indexView.byteOffset||0), indexAccessor.count);
  return {json, primitive, positions, indices};
}

test('strong-body GLB is a decimated CC BY figure with every workout muscle',()=>{
  const stat=fs.statSync(glbPath);
  assert.ok(stat.size<2_500_000, 'shipped GLB should stay small enough for a phone');
  assert.ok(stat.size>200_000);
  const {json, primitive, positions, indices}=regionGeometry(glbPath);
  const extras=json.asset.extras;
  assert.match(extras.author,/Orthovasky/);
  assert.match(extras.license,/CC-BY-4\.0/);
  assert.match(extras.source,/sketchfab\.com\/3d-models\/male-human-strong-body/);
  assert.equal(positions.length/3>20000, true);
  assert.equal(indices.length%3,0);
  const regions=primitive.extras.regions;
  const byId=Object.fromEntries(regions.map(region=>[region.id, region]));
  let cursor=0;
  for(const region of regions){
    assert.equal(region.offset, cursor);
    assert.equal(region.count%3,0);
    assert.ok(region.count>=3);
    for(let i=region.offset;i<region.offset+region.count;i++){
      assert.ok(Number.isInteger(indices[i])&&indices[i]>=0&&indices[i]<positions.length/3);
    }
    cursor+=region.count;
  }
  assert.equal(cursor, indices.length);
  for(const id of Object.keys(Muscles.GROUPS)) assert.ok(byId[id]?.count>1200, id);
  const mean=id=>{
    const region=byId[id]; let y=0,z=0,ax=0,n=0;
    for(let i=region.offset;i<region.offset+region.count;i+=3){
      const a=indices[i], b=indices[i+1], c=indices[i+2];
      y+=(positions[a*3+1]+positions[b*3+1]+positions[c*3+1])/3;
      z+=(positions[a*3+2]+positions[b*3+2]+positions[c*3+2])/3;
      ax+=(Math.abs(positions[a*3])+Math.abs(positions[b*3])+Math.abs(positions[c*3]))/3;
      n++;
    }
    return {y:y/n,z:z/n,ax:ax/n};
  };
  const chest=mean('chest'), ham=mean('hamstrings'), shoulder=mean('shoulders'), calf=mean('calves'), abs=mean('abs');
  assert.ok(chest.z>ham.z, 'chest stays on the front of the hamstrings');
  assert.ok(chest.y>abs.y&&abs.y>ham.y&&ham.y>calf.y);
  assert.ok(shoulder.ax>abs.ax, 'delts sit wider than the abs');
  assert.equal(fs.existsSync(path.join(root,'assets/fitness-body.json')), false);
});

test('real Three.js constructs finite smooth normals for the strong body', async()=>{
  const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.min.mjs')));
  assert.equal(THREE.REVISION,'170');
  assert.equal(typeof THREE.NeutralToneMapping,'number');
  const {positions, indices}=regionGeometry(glbPath);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  const normals=geometry.attributes.normal.array;
  assert.equal(normals.length, positions.length);
  for(let i=0;i<normals.length;i+=3){
    const length=Math.hypot(normals[i], normals[i+1], normals[i+2]);
    assert.ok(length>.99&&length<1.01);
  }
  const shader=THREE.ShaderLib.standard.fragmentShader;
  assert.ok(shader.indexOf('vec3 totalEmissiveRadiance')<shader.indexOf('#include <color_fragment>'));
});

test('viewer loads the GLB, paints upper-A roles and accepts zoom controls', async(t)=>{
  const rendererPath=path.join(root,'fitness-renderer.mjs');
  const threeURL=pathToFileURL(path.join(root,'vendor/three.module.min.mjs')).href;
  const source=fs.readFileSync(rendererPath,'utf8')
    .replace("'./vendor/three.module.min.mjs'", JSON.stringify(threeURL))
    .replace('new THREE.WebGLRenderer(', 'globalThis.__fitnessTestRenderer(')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(rendererPath).href));
  let renders=0, lastScene, disposed=0;
  const canvas={setAttribute(){}, addEventListener(){}, hasPointerCapture(){return false;}, releasePointerCapture(){}, getBoundingClientRect(){return {left:0,top:0,width:350,height:420};}};
  const glb=fs.readFileSync(glbPath);
  const globals={
    __fitnessTestRenderer:()=>({domElement:canvas,setPixelRatio(){},setSize(){},dispose(){disposed++;},render(scene){renders++; lastScene=scene;}}),
    window:{devicePixelRatio:2, matchMedia:()=>({matches:true})},
    document:{hidden:false, addEventListener(){}, getElementById(){return {hidden:false, textContent:'', classList:{add(){},remove(){}}};}},
    ResizeObserver:class{observe(){}},
    fetch:async()=>({ok:true, arrayBuffer:async()=>glb.buffer.slice(glb.byteOffset, glb.byteOffset+glb.byteLength)}),
    cancelAnimationFrame(){},
    requestAnimationFrame(){return 1;},
    performance:{now:()=>0}
  };
  for(const [key,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {configurable:true, writable:true, value});
    t.after(()=>{if(descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];});
  }
  const {createViewer, PALETTE}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const host={clientWidth:350, clientHeight:420, classList:{add(){},remove(){}}, getBoundingClientRect:()=>({width:350}), replaceChildren(child){assert.equal(child, canvas);}};
  const viewer=await createViewer(host, ()=>{});
  const planned=[
    {variant:'器械胸推', targetSets:2},
    {variant:'坐姿划船', targetSets:2},
    {variant:'高位下拉', targetSets:2},
    {variant:'哑铃侧平举', targetSets:2},
    {variant:'Pallof 抗旋转推', targetSets:2}
  ];
  const data=Muscles.summarize(planned, []);
  viewer.update({data, side:'front', selected:'chest', animate:false});
  viewer.command('in'); viewer.command('out'); viewer.command('reset');
  viewer.update({data, side:'back', selected:'lats', animate:false});
  assert.ok(renders>=6);
  const mesh=lastScene.children.find(child=>child.isGroup).children[0];
  const byId=Object.fromEntries(mesh.material.map(material=>[material.userData.id, material.userData.uniforms]));
  const hex=color=>'#'+color.getHexString();
  assert.equal(hex(byId.chest.base.value), PALETTE.primary);
  assert.equal(hex(byId.abs.base.value), PALETTE.primary);
  assert.equal(hex(byId.shoulders.base.value), PALETTE.primary);
  assert.equal(hex(byId.biceps.base.value), PALETTE.support);
  assert.equal(hex(byId.triceps.base.value), PALETTE.support);
  assert.equal(hex(byId.forearms.base.value), PALETTE.support);
  assert.equal(hex(byId.quads.base.value), PALETTE.idle);
  assert.equal(hex(byId.hamstrings.base.value), PALETTE.idle);
  assert.equal(byId.chest.role.value, 2);
  assert.equal(byId.biceps.role.value, 1);
  assert.equal(byId.quads.role.value, 0);
  const done=Muscles.summarize(planned, [{variant:'器械胸推', metric:'reps', sets:[{done:true,load:20,value:10},{done:false,load:20,value:10}]}]);
  viewer.update({data:done, side:'front', selected:'chest', animate:true});
  assert.equal(byId.chest.energy.value, done.groups.chest.percent/100);
  assert.ok(byId.chest.energy.value>0&&byId.chest.energy.value<1);
  const shader={uniforms:{}, vertexShader:THREE_SHADER(mesh), fragmentShader:THREE_FRAGMENT(mesh)};
  mesh.material[0].onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /bodyEnergy/);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance/);
  assert.equal(disposed, 0);
});

function THREE_SHADER(mesh){
  return 'void main(){#include <begin_vertex>\n}';
}
function THREE_FRAGMENT(){
  return 'void main(){vec3 totalEmissiveRadiance; #include <color_fragment>\n}';
}
