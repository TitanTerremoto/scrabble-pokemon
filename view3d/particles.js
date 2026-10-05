/*
 * Partículas de la escena 3D. Cada efecto devuelve tick(dt) → true mientras
 * siga vivo; board3d.js los avanza en cada frame y los olvida al terminar.
 */
import * as THREE from 'three';

const confettiGeo = new THREE.PlaneGeometry(0.16, 0.24);
const puffGeo = new THREE.IcosahedronGeometry(0.16, 0);
const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);

function burst(scene, point, { count, geo, colors, speed, up, gravity, life, fadeAt, spin, additive }) {
  const bits = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(point);
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const s = speed[0] + Math.random() * (speed[1] - speed[0]);
    m.userData.v = dir.multiplyScalar(s).add(new THREE.Vector3(0, up[0] + Math.random() * (up[1] - up[0]), 0));
    m.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(spin);
    scene.add(m);
    bits.push(m);
  }
  let age = 0;
  return function tick(dt) {
    age += dt;
    for (const m of bits) {
      m.userData.v.y -= gravity * dt;
      m.position.addScaledVector(m.userData.v, dt);
      m.rotation.x += m.userData.spin.x * dt;
      m.rotation.y += m.userData.spin.y * dt;
      m.material.opacity = Math.max(0, 1 - Math.max(0, age - fadeAt) / (life - fadeAt));
    }
    if (age < life) return true;
    for (const m of bits) {
      scene.remove(m);
      m.material.dispose();
    }
    return false;
  };
}

/** Lluvia de confeti del color del jugador. */
export function confetti(scene, point, color) {
  return burst(scene, point, { count: 90, geo: confettiGeo, colors: [color, '#ffcb05', '#ffffff', '#4dabf7', '#ff6b6b', '#69db7c'], speed: [2, 6], up: [6, 11], gravity: 14, life: 2.6, fadeAt: 1.6, spin: 9 });
}

/** Polvo al caer una ficha. */
export function dust(scene, point) {
  return burst(scene, point, { count: 8, geo: puffGeo, colors: ['#fff8e1', '#f1e3c4'], speed: [0.8, 1.6], up: [0.4, 1], gravity: 1.5, life: 0.7, fadeAt: 0.15, spin: 2 });
}

/** Chispas doradas (ficha sobre casilla especial, destello de la Poké Ball). */
export function sparks(scene, point, color = '#ffd43b', count = 26) {
  return burst(scene, point, { count, geo: sparkGeo, colors: [color, '#ffffff'], speed: [1.5, 4.5], up: [2, 6], gravity: 6, life: 1.1, fadeAt: 0.4, spin: 6, additive: true });
}

/** Fuego artificial: sube, explota en el aire. */
export function firework(scene, point, color) {
  const shell = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  shell.position.copy(point);
  scene.add(shell);
  const top = point.clone().add(new THREE.Vector3(0, 7 + Math.random() * 3, 0));
  let age = 0;
  let boom = null;
  return function tick(dt) {
    age += dt;
    if (!boom) {
      const k = Math.min(1, age / 0.7);
      shell.position.lerpVectors(point, top, 1 - (1 - k) ** 2);
      if (k >= 1) {
        scene.remove(shell);
        boom = burst(scene, top, { count: 60, geo: sparkGeo, colors: [color, '#ffffff', '#ffcb05'], speed: [3, 7], up: [-2, 4], gravity: 4, life: 1.6, fadeAt: 0.5, spin: 4, additive: true });
      }
      return true;
    }
    return boom(dt);
  };
}

/** Onda expansiva plana (casillas x2/x3). */
export function shockwave(scene, point, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.55, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(point);
  scene.add(ring);
  let age = 0;
  return function tick(dt) {
    age += dt;
    const k = age / 0.8;
    ring.scale.setScalar(1 + k * 5);
    ring.material.opacity = Math.max(0, 1 - k);
    if (k < 1) return true;
    scene.remove(ring);
    ring.geometry.dispose();
    ring.material.dispose();
    return false;
  };
}

/** Polen y destellos flotando sobre la mesa todo el tiempo. */
export function ambientMotes(scene) {
  const count = 160;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return function tick(dt, t) {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += dt * 0.25;
      pos[i * 3] += Math.sin(t * 0.5 + seed[i]) * dt * 0.3;
      if (pos[i * 3 + 1] > 9) pos[i * 3 + 1] = 0;
    }
    geo.attributes.position.needsUpdate = true;
    return true;
  };
}
