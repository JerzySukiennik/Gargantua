// First-person astronaut gloves: rest at screen bottom, reach toward aim, close into a grip on grab.
import * as THREE from 'three';

const SUIT = new THREE.MeshLambertMaterial({ color: 0xe8e9ec });
const CUFF = new THREE.MeshLambertMaterial({ color: 0xd07a2e });
const PAD = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });

function buildGlove(side) {
  const g = new THREE.Group();

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, 0.10), SUIT);
  g.add(palm);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.085), PAD);
  pad.position.y = -0.02;
  g.add(pad);

  const fingers = new THREE.Group();
  fingers.position.set(0, 0, -0.05);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.028, 0.075), SUIT);
    f.position.set(-0.03 + i * 0.02, 0.002, -0.035);
    fingers.add(f);
  }
  g.add(fingers);

  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.055), SUIT);
  thumb.position.set(side * 0.055, 0, -0.01);
  thumb.rotation.y = side * 0.6;
  g.add(thumb);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.07, 10), CUFF);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0.005, 0.085);
  g.add(cuff);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.35, 10), SUIT);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 0.005, 0.29);
  g.add(arm);

  return { group: g, fingers, thumb };
}

export function createHands(camera) {
  const REST = [
    new THREE.Vector3(0.3, -0.3, -0.5),
    new THREE.Vector3(-0.3, -0.3, -0.5),
  ];
  const REST_ROT = [
    new THREE.Euler(-0.35, -0.12, 0.1),
    new THREE.Euler(-0.35, 0.12, -0.1),
  ];

  const hands = [buildGlove(1), buildGlove(-1)];
  hands.forEach((h, i) => {
    h.group.position.copy(REST[i]);
    h.group.rotation.copy(REST_ROT[i]);
    h.group.scale.setScalar(0.78);
    h.rest = REST[i];
    h.restRot = REST_ROT[i];
    h.curl = 0;
    camera.add(h.group);
  });

  let active = 0;
  const tmp = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();
  const restQuat = [
    new THREE.Quaternion().setFromEuler(REST_ROT[0]),
    new THREE.Quaternion().setFromEuler(REST_ROT[1]),
  ];
  const lookM = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  function onGrab() { active = 1 - active; }

  function update(dt, playerState) {
    const k = 1 - Math.exp(-14 * dt);
    inv.copy(camera.matrixWorld).invert();

    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      const isActive = i === active;
      let reach = null;

      if (isActive && playerState.mode === 'grab' && playerState.grab) reach = playerState.grab.anchor;
      else if (isActive && playerState.aim) reach = playerState.aim.point;

      let curlTarget = 0.15;
      if (reach) {
        const grabbing = playerState.mode === 'grab';
        tmp.copy(reach).applyMatrix4(inv);
        const d = tmp.length();
        const maxReach = grabbing ? 0.6 : 0.42;
        if (d > maxReach) tmp.multiplyScalar(maxReach / d);
        if (!grabbing) tmp.lerpVectors(h.rest, tmp, 0.55);
        targetPos.copy(tmp);
        lookM.lookAt(new THREE.Vector3(), tmp, UP);
        targetQuat.setFromRotationMatrix(lookM);
        curlTarget = grabbing ? 1 : 0.35;
      } else {
        targetPos.copy(h.rest);
        targetQuat.copy(restQuat[i]);
      }

      h.group.position.lerp(targetPos, k);
      h.group.quaternion.slerp(targetQuat, k);
      h.curl += (curlTarget - h.curl) * k;
      h.fingers.rotation.x = -1.5 * h.curl;
      h.fingers.position.z = -0.05 + 0.02 * h.curl;
    }
  }

  return { update, onGrab };
}
