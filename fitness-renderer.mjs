import * as THREE from './vendor/three.module.min.mjs';

// Presentation for assets/strong-body.glb. Region colours stay per triangle
// so neighbouring muscles do not blend across the boundary. The CC BY mesh is
// already muscular; there is no MakeHuman morph.
export const PALETTE = {
  idle: '#8d9aa3',
  primary: '#ff3a16',
  support: '#e09634',
  energy: '#2fce6a'
};

function compileMuscle(uniforms) {
  return shader => {
    Object.assign(shader.uniforms, {
      bodyEnergy: uniforms.energy,
      bodyBase: uniforms.base,
      bodyGlow: uniforms.glow,
      bodyLow: uniforms.low,
      bodyHigh: uniforms.high,
      bodyRole: uniforms.role,
      bodyInk: uniforms.ink
    });
    shader.vertexShader = 'varying float vBodyY; varying vec3 vObj; varying vec3 vObjN;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBodyY = position.y;
      vObj = position;
      vObjN = normal;`);
    shader.fragmentShader = `varying float vBodyY; varying vec3 vObj; varying vec3 vObjN;
uniform float bodyEnergy; uniform vec3 bodyBase; uniform float bodyGlow;
uniform float bodyLow; uniform float bodyHigh; uniform float bodyRole; uniform vec3 bodyInk;
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = bodyBase;
      vec3 fiber = normalize(mix(vec3(0.0, 1.0, 0.06), vec3(sign(vObj.x), -0.38, 0.04), smoothstep(0.14, 0.22, abs(vObj.x))));
      vec3 across = cross(fiber, normalize(vObjN));
      float acrossLen = length(across);
      float ridges = acrossLen < 1e-4 ? 0.5 : smoothstep(-0.2, 0.85, sin(dot(vObj, across / acrossLen) * 96.0));
      float fiberAmt = bodyRole > 1.5 ? 0.18 : bodyRole > 0.5 ? 0.09 : 0.0;
      diffuseColor.rgb *= mix(1.0 - fiberAmt, 1.0 + fiberAmt * 0.4, ridges);
      float shorts = smoothstep(0.40, 0.45, vBodyY) * smoothstep(0.58, 0.52, vBodyY) * smoothstep(0.17, 0.12, abs(vObj.x));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.16, 0.18, 0.22), shorts * (bodyRole > 0.5 ? 0.12 : 0.78));
      float level = (vBodyY - bodyLow) / max(0.01, bodyHigh - bodyLow);
      float filled = bodyEnergy <= 0.0 ? 0.0 : 1.0 - smoothstep(bodyEnergy - 0.035, bodyEnergy + 0.012, level);
      diffuseColor.rgb = mix(diffuseColor.rgb, bodyInk, filled);
      totalEmissiveRadiance += bodyInk * filled * (0.34 + bodyGlow);`);
  };
}

function readGlb(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Model is not a GLB');
  const length = view.getUint32(8, true);
  let offset = 12, json, binOffset = 0, binLength = 0;
  while (offset + 8 <= length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, chunkLength)));
    else if (chunkType === 0x004e4942) { binOffset = start; binLength = chunkLength; }
    offset = start + chunkLength;
  }
  if (!json || !binLength) throw new Error('Model GLB is incomplete');
  const primitive = json.meshes?.[0]?.primitives?.[0];
  const regions = primitive?.extras?.regions;
  if (primitive?.attributes?.POSITION == null || primitive.indices == null || !Array.isArray(regions) || !regions.length) throw new Error('Model is missing muscle regions');
  const bin = new Uint8Array(buffer, binOffset, binLength);
  const positions = copyAccessor(json, bin, primitive.attributes.POSITION);
  const indices = copyAccessor(json, bin, primitive.indices);
  return {positions, indices, regions};
}

function copyAccessor(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const components = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[accessor.type];
  const count = accessor.count * components;
  let array;
  if (accessor.componentType === 5126) array = new Float32Array(count);
  else if (accessor.componentType === 5123) array = new Uint16Array(count);
  else if (accessor.componentType === 5125) array = new Uint32Array(count);
  else throw new Error('Unsupported model accessor');
  const bytes = new Uint8Array(array.buffer);
  bytes.set(bin.subarray(start, start + bytes.length));
  return array;
}

export async function createViewer(host, onSelect) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '可旋转的运动人体模型，左右拖动或使用下方肌群按钮');
  host.replaceChildren(canvas);
  let model;
  try {
    const response = await fetch(new URL('./assets/strong-body.glb?v=2', import.meta.url), {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('Model HTTP ' + response.status);
    model = readGlb(await response.arrayBuffer());
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const scene = new THREE.Scene(), body = new THREE.Group();
  scene.add(body);
  const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xd7e4ee, 0x12191c, 0.42));
  for (const [color, intensity, position] of [[0xfff6ee, 2.7, [0.55, 1.35, 1.7]], [0x93a9bd, 0.42, [-1.4, 0.7, 0.8]], [0xe8f3ff, 1.45, [-0.2, 1.05, -1.6]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(model.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));
  geometry.computeVertexNormals();
  geometry.clearGroups();
  const materials = [], regions = [];
  const ink = new THREE.Color(PALETTE.energy);
  for (const region of model.regions) {
    const index = geometry.index.array;
    let min = Infinity, max = -Infinity;
    for (let i = region.offset; i < region.offset + region.count; i++) {
      const y = model.positions[index[i] * 3 + 1];
      if (y < min) min = y;
      if (y > max) max = y;
    }
    const uniforms = {
      energy: {value: 0},
      base: {value: new THREE.Color(PALETTE.idle)},
      glow: {value: 0},
      low: {value: min},
      high: {value: max},
      role: {value: 0},
      ink: {value: ink}
    };
    const material = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.48, metalness: 0.08});
    material.userData = {id: region.id, uniforms};
    material.onBeforeCompile = compileMuscle(uniforms);
    material.customProgramCacheKey = () => 'strong-body-' + region.id;
    geometry.addGroup(region.offset, region.count, materials.length);
    materials.push(material);
    regions.push({id: region.id, material, uniforms});
  }
  const mesh = new THREE.Mesh(geometry, materials);
  body.add(mesh);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const floor = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.72, 48), new THREE.MeshBasicMaterial({color: 0x10211c, transparent: true, opacity: 0.34, depthWrite: false}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, bounds.min.y, center.z);
  scene.add(floor);
  let zoom = 1, side = null, state = null, animation = 0, energyStart = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = () => { if (host.getBoundingClientRect().width > 0 && !document.hidden) renderer.render(scene, camera); };
  function resize() {
    const w = host.clientWidth || 300, h = host.clientHeight || 430;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = Math.max(size.y * 0.58 / Math.tan(fov / 2), size.x * 0.58 / (Math.tan(fov / 2) * camera.aspect)) / zoom;
    camera.position.set(center.x, center.y + size.y * 0.02, center.z + distance);
    camera.near = Math.max(0.01, distance / 80);
    camera.far = distance + size.y * 4;
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  function paint(t) {
    const progress = Math.min(1, (t - energyStart) / 850);
    for (const region of regions) {
      const group = state?.data?.groups[region.id];
      region.uniforms.energy.value = (group?.percent || 0) / 100 * progress;
      region.uniforms.glow.value = (1 - progress) * 0.55;
    }
    render();
    if (progress < 1) animation = requestAnimationFrame(paint);
    else animation = 0;
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let gesture = null;
  canvas.addEventListener('pointerdown', event => { if (!event.isPrimary) return; gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, angle: body.rotation.y, moved: false}; });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      gesture.moved = true;
      canvas.setPointerCapture(event.pointerId);
      body.rotation.y = gesture.angle + dx * 0.012;
      render();
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const tap = !gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8;
    gesture = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!tap) return;
    const box = canvas.getBoundingClientRect();
    pointer.set((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(mesh)[0];
    const id = hit && regions[hit.face.materialIndex]?.id;
    if (id && id !== 'neutral') onSelect(id);
  });
  canvas.addEventListener('pointercancel', () => { gesture = null; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(animation);
    host.classList.remove('ready');
    document.getElementById('body-model').hidden = false;
    document.getElementById('fitness-status').textContent = '立体显示已暂停，当前使用肌群平面图。';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    host.classList.add('ready');
    document.getElementById('body-model').hidden = true;
    document.getElementById('fitness-status').textContent = '左右拖动旋转 · 点按肌群 · ＋／－缩放';
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  resize();
  return {
    update(next) {
      if (!next) return;
      state = next;
      cancelAnimationFrame(animation);
      if (side !== next.side) { side = next.side; body.rotation.y = side === 'back' ? Math.PI : side === 'both' ? -0.45 : 0; }
      for (const region of regions) {
        const group = next.data.groups[region.id];
        const active = !!(group && group.state !== 'idle');
        const role = active ? (group.secondary ? 1 : 2) : 0;
        region.uniforms.role.value = role;
        region.uniforms.base.value.set(role === 2 ? PALETTE.primary : role === 1 ? PALETTE.support : PALETTE.idle);
        const selected = next.selected === region.id;
        region.material.roughness = selected ? 0.28 : role === 2 ? 0.36 : role === 1 ? 0.46 : 0.5;
        region.material.metalness = role === 0 ? 0.2 : 0.02;
        region.material.emissive.set(selected ? (role === 2 ? '#ff6a45' : '#f4f7f8') : '#000000');
        region.material.emissiveIntensity = selected ? 0.28 : 0;
        region.uniforms.energy.value = (group?.percent || 0) / 100;
        region.uniforms.glow.value = 0;
      }
      if (next.animate && !reduced) { energyStart = performance.now(); animation = requestAnimationFrame(paint); }
      else render();
    },
    command(cmd) {
      if (cmd === 'in') zoom = Math.min(1.6, zoom + 0.15);
      if (cmd === 'out') zoom = Math.max(0.8, zoom - 0.15);
      if (cmd === 'reset') { zoom = 1; body.rotation.y = side === 'back' ? Math.PI : side === 'both' ? -0.45 : 0; }
      resize();
    }
  };
}
