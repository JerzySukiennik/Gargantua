// Remote astronaut avatars: tinted GLB clones + DOM nameplates projected each frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_COLORS } from '../config.js';

const AVATAR_SCALE = 1.35;

export async function createAvatars(scene, camera) {
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.load('assets/models/space-kit/astronautA.glb', res, undefined, rej));
  const template = gltf.scene;
  const box = new THREE.Box3().setFromObject(template);
  const c = box.getCenter(new THREE.Vector3());
  template.position.set(-c.x, -c.y, -c.z);

  const container = document.getElementById('nameplates');
  const remotes = new Map();
  const tmp = new THREE.Vector3();

  function makeAvatar(colorIdx, name) {
    const root = new THREE.Group();
    const inner = template.clone(true);
    const tint = new THREE.Color(PLAYER_COLORS[colorIdx % PLAYER_COLORS.length]);
    inner.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        if (o.material.color) o.material.color.lerp(tint, 0.45);
      }
    });
    root.add(inner);
    root.scale.setScalar(AVATAR_SCALE);
    scene.add(root);

    const plate = document.createElement('div');
    plate.className = 'nameplate';
    plate.textContent = name || 'ASTRONAUT';
    container.appendChild(plate);

    return { root, plate, name };
  }

  function update(samples) {
    const seen = new Set();
    for (const s of samples) {
      seen.add(s.id);
      let av = remotes.get(s.id);
      if (!av) {
        av = makeAvatar(s.color, s.name);
        remotes.set(s.id, av);
      }
      if (s.name && s.name !== av.name) { av.name = s.name; av.plate.textContent = s.name; }
      av.root.position.set(s.x, s.y, s.z);
      av.root.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    }
    for (const [id, av] of remotes) {
      if (!seen.has(id)) {
        scene.remove(av.root);
        av.plate.remove();
        remotes.delete(id);
      }
    }
  }

  function updatePlates() {
    for (const av of remotes.values()) {
      tmp.copy(av.root.position);
      tmp.y += 1.5;
      tmp.project(camera);
      const behind = tmp.z > 1;
      if (behind || tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1) {
        av.plate.style.display = 'none';
        continue;
      }
      const dist = camera.position.distanceTo(av.root.position);
      av.plate.style.display = 'block';
      av.plate.style.left = ((tmp.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      av.plate.style.top = ((-tmp.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      av.plate.style.opacity = String(Math.max(0.15, Math.min(1, 1.4 - dist / 90)));
    }
  }

  return { update, updatePlates, remotes };
}
