// WebGL renderer, camera and lighting setup.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(CONFIG.fov, window.innerWidth / window.innerHeight, 0.1, 40000);
  camera.position.set(0, 3.2, 10);

  const sun = new THREE.DirectionalLight(0xfff2e2, 3.2);
  sun.position.set(-620, 100, -780);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8fa7cc, 0.22);
  fill.position.set(500, -200, 600);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.035));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
