/*
 * Escena base del modo 3D: renderer, cielo, luces, la mesa de madera con el
 * tablero y el diorama de Kanto alrededor (scenery.js, escalado).
 *
 * Coordenadas: cada casilla mide 1; la casilla (r, c) está en x = c − 7,
 * z = r − 7. La cara del tablero está en y = BOARD_TOP; la mesa, en y = 0.
 */
import * as THREE from 'three';
import { boardTexture } from './textures.js';
import { buildScenery } from './scenery.js';

const R = window.ScrabbleRules;

export const BOARD_TOP = 0.3;
// Mesa cuadrada: un jugador por lado (seats.js).
export const TABLE = { w: 27, d: 27, top: 0, thick: 0.8 };
const LEG_H = 2.2;
const GROUND_Y = TABLE.top - TABLE.thick - LEG_H; // donde apoyan las patas
const SCENERY_SCALE = 1.9;
const SCENERY_GROUND = -0.62; // GROUND_Y interno de scenery.js

export const cellPos = (r, c, y = BOARD_TOP) => new THREE.Vector3(c - R.CENTER, y, r - R.CENTER);

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3d8fe0');
  g.addColorStop(0.45, '#8fd0ff');
  g.addColorStop(0.75, '#d4efff');
  g.addColorStop(1, '#fff3cf');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Vetas de madera para la mesa. */
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c48a52';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = `rgba(${110 + Math.random() * 40}, ${60 + Math.random() * 20}, 25, ${0.12 + Math.random() * 0.18})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
    ctx.stroke();
  }
  // Tablones
  ctx.fillStyle = 'rgba(70, 40, 15, 0.35)';
  for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y, 512, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  tex.anisotropy = 8;
  return tex;
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#cfeeff', 70, 150);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 300);

  scene.add(new THREE.HemisphereLight('#ffffff', '#6fae62', 1.05));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.0);
  sun.position.set(10, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  // Luz de relleno cálida desde la cámara: las fichas se leen mejor.
  const fill = new THREE.DirectionalLight('#ffe8c7', 0.45);
  fill.position.set(0, 10, 24);
  scene.add(fill);

  // ── Mesa ──
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 });
  const darkWood = new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.65 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, TABLE.thick, TABLE.d), [darkWood, darkWood, wood, darkWood, darkWood, darkWood]);
  table.position.y = TABLE.top - TABLE.thick / 2;
  table.receiveShadow = true;
  table.castShadow = true;
  scene.add(table);
  const legGeo = new THREE.CylinderGeometry(0.45, 0.35, LEG_H, 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, darkWood);
      leg.position.set(sx * (TABLE.w / 2 - 1.2), TABLE.top - TABLE.thick - LEG_H / 2, sz * (TABLE.d / 2 - 1.2));
      leg.castShadow = true;
      scene.add(leg);
    }
  }

  // ── Tablero: marco con filete dorado y la cara con las casillas ──
  const frame = new THREE.Mesh(new THREE.BoxGeometry(R.SIZE + 1.1, BOARD_TOP - 0.02, R.SIZE + 1.1), new THREE.MeshStandardMaterial({ color: '#7d4f2a', roughness: 0.5 }));
  frame.position.y = (BOARD_TOP - 0.02) / 2;
  frame.castShadow = true;
  frame.receiveShadow = true;
  // Filete dorado: solo un marco alrededor de la cara (debajo de ella parpadea).
  const outer = R.SIZE / 2 + 0.18;
  const inner = R.SIZE / 2 - 0.02;
  const trimShape = new THREE.Shape([new THREE.Vector2(-outer, -outer), new THREE.Vector2(outer, -outer), new THREE.Vector2(outer, outer), new THREE.Vector2(-outer, outer)]);
  trimShape.holes.push(new THREE.Path([new THREE.Vector2(-inner, -inner), new THREE.Vector2(-inner, inner), new THREE.Vector2(inner, inner), new THREE.Vector2(inner, -inner)]));
  const trim = new THREE.Mesh(new THREE.ShapeGeometry(trimShape), new THREE.MeshStandardMaterial({ color: '#ffcb05', metalness: 0.6, roughness: 0.3 }));
  trim.rotation.x = -Math.PI / 2;
  trim.position.y = BOARD_TOP - 0.005;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(R.SIZE, R.SIZE), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.8 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = BOARD_TOP;
  face.receiveShadow = true;
  scene.add(frame, trim, face);

  // ── Diorama ──
  const sceneryGroup = new THREE.Group();
  sceneryGroup.scale.setScalar(SCENERY_SCALE);
  sceneryGroup.position.y = GROUND_Y - SCENERY_GROUND * SCENERY_SCALE;
  scene.add(sceneryGroup);
  const scenery = buildScenery(sceneryGroup);
  // Edificios y Pokémon decorativos: después del tablero, sin demorar el inicio.
  setTimeout(() => scenery.loadExtras(), 300);

  return { renderer, scene, camera, sun, scenery, face };
}
