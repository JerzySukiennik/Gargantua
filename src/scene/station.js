// Station assembly: GLB loading, material dedup, AABB colliders + spatial hash, solar wings.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { buildLayout } from './station-layout.js';

const MODEL_PATH = 'assets/models/space-kit/';
const EMISSIVE_MATS = new Set(['_defaultMat']);
const NO_COLLIDE = new Set(['alien']);

export async function buildStation(scene) {
  const grid = CONFIG.world.grid;
  const cell = CONFIG.world.cellSize;
  const layout = buildLayout();

  const names = [...new Set(layout.filter((e) => e.m).map((e) => e.m))];
  const loader = new GLTFLoader();
  const templates = {};
  const matCache = new Map();

  function sharedMaterial(src) {
    const key = src.name || '#' + src.color.getHexString();
    if (!matCache.has(key)) {
      const m = new THREE.MeshLambertMaterial({ color: src.color.clone(), name: key });
      if (EMISSIVE_MATS.has(key)) {
        m.emissive = new THREE.Color(0xfff1d0);
        m.emissiveIntensity = 0.55;
      }
      matCache.set(key, m);
    }
    return matCache.get(key);
  }

  const normBox = new THREE.Box3();
  await Promise.all(names.map((n) => new Promise((resolve, reject) => {
    loader.load(MODEL_PATH + n + '.glb', (gltf) => {
      const inner = gltf.scene;
      inner.traverse((o) => {
        if (o.isMesh) {
          o.material = Array.isArray(o.material)
            ? o.material.map(sharedMaterial)
            : sharedMaterial(o.material);
        }
      });
      const root = new THREE.Group();
      root.add(inner);
      inner.updateMatrixWorld(true);
      normBox.setFromObject(inner);
      inner.position.set(
        -(normBox.min.x + normBox.max.x) / 2,
        -normBox.min.y,
        -(normBox.min.z + normBox.max.z) / 2,
      );
      templates[n] = root;
      resolve();
    }, undefined, reject);
  })));

  const group = new THREE.Group();
  const colliders = [];
  const grabTargets = [];
  const poiAnchors = {};
  const hash = new Map();
  const box = new THREE.Box3();

  function hashKey(x, y, z) { return x + ',' + y + ',' + z; }

  function insertCollider(rec) {
    const idx = colliders.length;
    colliders.push(rec);
    const min = rec.min, max = rec.max;
    const x0 = Math.floor(min.x / cell), x1 = Math.floor(max.x / cell);
    const y0 = Math.floor(min.y / cell), y1 = Math.floor(max.y / cell);
    const z0 = Math.floor(min.z / cell), z1 = Math.floor(max.z / cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const k = hashKey(x, y, z);
          if (!hash.has(k)) hash.set(k, []);
          hash.get(k).push(idx);
        }
  }

  function place(obj, entry) {
    group.add(obj);
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    const rec = {
      min: box.min.clone(),
      max: box.max.clone(),
      meshes: [],
    };
    obj.traverse((o) => {
      if (o.isMesh) {
        o.userData.grabbable = true;
        rec.meshes.push(o);
        grabTargets.push(o);
      }
    });
    if (!entry || !NO_COLLIDE.has(entry.m)) insertCollider(rec);
    if (entry && entry.poi) {
      poiAnchors[entry.poi] = box.getCenter(new THREE.Vector3());
    }
    return rec;
  }

  for (const e of layout) {
    if (e.type) continue;
    const tpl = templates[e.m];
    const obj = tpl.clone(true);
    const s = (e.s || 1) * grid;
    obj.scale.setScalar(s);
    obj.position.set(e.c[0] * grid, e.c[1] * grid, e.c[2] * grid);
    obj.rotation.y = (e.r || 0) * Math.PI / 2;
    if (e.flip) obj.rotation.z = Math.PI;
    if (e.tilt) { obj.rotation.x = 0.6; obj.rotation.z = -0.4; }
    place(obj, e);
  }

  const panelMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a, map: makePanelTexture() });
  const panelEdgeMat = new THREE.MeshLambertMaterial({ color: 0xb8c0cc });
  const boomMat = new THREE.MeshLambertMaterial({ color: 0x9aa4b2 });

  for (const e of layout) {
    if (e.type === 'solar') {
      const p = new THREE.Mesh(new THREE.BoxGeometry(e.w, 0.35, e.h), [
        panelEdgeMat, panelEdgeMat, panelMat, panelMat, panelEdgeMat, panelEdgeMat,
      ]);
      p.position.set(e.pos[0] * grid, e.pos[1] * grid, e.pos[2] * grid);
      place(p, null);
    } else if (e.type === 'boom') {
      const a = new THREE.Vector3(...e.from).multiplyScalar(grid);
      const b = new THREE.Vector3(...e.to).multiplyScalar(grid);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 8), boomMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      if (!e.up) m.rotation.x = Math.PI / 2;
      place(m, null);
    }
  }

  scene.add(group);
  group.updateMatrixWorld(true);

  mergeStaticDraws(scene, group);

  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());

  const neighborOut = [];
  function query(pos, radius) {
    neighborOut.length = 0;
    const x0 = Math.floor((pos.x - radius) / cell), x1 = Math.floor((pos.x + radius) / cell);
    const y0 = Math.floor((pos.y - radius) / cell), y1 = Math.floor((pos.y + radius) / cell);
    const z0 = Math.floor((pos.z - radius) / cell), z1 = Math.floor((pos.z + radius) / cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const list = hash.get(hashKey(x, y, z));
          if (list) for (const i of list) if (!neighborOut.includes(i)) neighborOut.push(i);
        }
    return neighborOut;
  }

  const meshOut = [];
  function nearbyMeshes(pos, radius) {
    meshOut.length = 0;
    for (const i of query(pos, radius)) {
      for (const m of colliders[i].meshes) meshOut.push(m);
    }
    return meshOut;
  }

  return { group, colliders, grabTargets, poiAnchors, bounds, center, query, nearbyMeshes };
}

function mergeStaticDraws(scene, group) {
  const byMaterial = new Map();
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.map) return;
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    const geo = o.geometry.clone();
    for (const attr of Object.keys(geo.attributes)) {
      if (attr !== 'position' && attr !== 'normal') geo.deleteAttribute(attr);
    }
    geo.applyMatrix4(o.matrixWorld);
    byMaterial.get(o.material).push({ geo, mesh: o });
  });

  const merged = new THREE.Group();
  for (const [mat, list] of byMaterial) {
    const combined = mergeGeometries(list.map((l) => l.geo), false);
    if (!combined) continue;
    merged.add(new THREE.Mesh(combined, mat));
    for (const l of list) l.mesh.visible = false;
  }
  if (merged.children.length) scene.add(merged);
}

function makePanelTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#16233f';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2b3f66';
  g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(0, 0, 256, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
