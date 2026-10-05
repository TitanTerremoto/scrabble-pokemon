/*
 * Director de cámara del modo 3D.
 *
 * Pose base:
 * - jugador (pov = asiento): vista «Tablero», alta desde su lado (la de
 *   jugar); con «alt», sentado detrás de su atril («Ver la mesa»);
 * - vista general (pov = null): en diagonal, se ve toda la mesa (público);
 *   con «alt», cenital.
 * Sobre la base se suman efectos: entrada en vuelo, balanceo leve,
 * inclinación al arrastrar una ficha (se ve mejor el tablero), acercamiento
 * a la palabra creada y vuelta alrededor de la mesa al terminar.
 */
import * as THREE from 'three';
import { tween, ease } from './tween.js';
import { POV, BOARD_VIEW, toWorld } from './seats.js';

const HALF = window.ScrabbleRules.SIZE / 2;
const OVERVIEW_FOV = 32;

export function createCameraDirector(camera) {
  let pov = null;
  let altView = false;
  const base = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: OVERVIEW_FOV };
  let focusPoint = new THREE.Vector3();
  let focusW = 0;
  let tiltW = 0;
  let tiltTween = 0;
  let orbit = 0;
  let orbiting = false;
  let introK = 1;

  function pose(seat = pov, alt = altView) {
    const aspect = camera.aspect;
    if (seat != null) {
      const v = alt ? POV : BOARD_VIEW;
      // En pantallas angostas la vista de tablero se aleja para que entre entero.
      const k = alt ? 1 : Math.max(1, 1.35 / aspect);
      const target = new THREE.Vector3(0, 0, v.targetZ);
      const pos = target.clone().add(new THREE.Vector3(0, v.y, v.z - v.targetZ).multiplyScalar(k));
      return { pos: toWorld(seat, pos), target: toWorld(seat, target), fov: v.fov };
    }
    const tanV = Math.tan(THREE.MathUtils.degToRad(OVERVIEW_FOV / 2));
    if (alt) {
      const dist = Math.max(HALF + 1.2, (HALF + 1.2) / aspect) / tanV;
      return { pos: new THREE.Vector3(0, dist, 0.01), target: new THREE.Vector3(), fov: OVERVIEW_FOV };
    }
    const elev = THREE.MathUtils.degToRad(52);
    const dist = Math.max(14 / (tanV * aspect), 11.6 / tanV);
    const target = new THREE.Vector3(0, 0, 1.4);
    return { pos: target.clone().add(new THREE.Vector3(0, Math.sin(elev) * dist, Math.cos(elev) * dist)), target, fov: OVERVIEW_FOV };
  }

  /** Pose inclinada (al arrastrar sentado): más alta y mirando más hacia abajo. */
  function tiltPose() {
    if (pov == null || !altView) return null;
    return { pos: toWorld(pov, new THREE.Vector3(0, 15.5, 9.5)), target: toWorld(pov, new THREE.Vector3(0, 0, 0.6)) };
  }

  function snap() {
    const p = pose();
    base.pos.copy(p.pos);
    base.target.copy(p.target);
    base.fov = p.fov;
  }

  function moveTo(ms) {
    const from = { pos: base.pos.clone(), target: base.target.clone(), fov: base.fov };
    const to = pose();
    return tween(ms, (t) => {
      base.pos.lerpVectors(from.pos, to.pos, t);
      base.target.lerpVectors(from.target, to.target, t);
      base.fov = from.fov + (to.fov - from.fov) * t;
    }, ease.inOutCubic);
  }

  const yawAround = (v, center, a) => center.clone().add(v.clone().sub(center).applyAxisAngle(new THREE.Vector3(0, 1, 0), a));

  return {
    snap,
    intro() {
      snap();
      introK = 0;
      return tween(2800, (t) => (introK = t), ease.inOutCubic);
    },
    /** Cambia de asiento (o a la vista general con null), en vuelo. */
    setPov(seat) {
      if (seat === pov) return null;
      pov = seat;
      return moveTo(1300);
    },
    getPov: () => pov,
    /** Jugador: alterna «Tablero» / «Ver la mesa». Vista general: alterna diagonal / cenital. */
    toggleAlt() {
      altView = !altView;
      return moveTo(800);
    },
    isAlt: () => altView,
    setTilt(on) {
      const id = ++tiltTween;
      const from = tiltW;
      const to = on ? 1 : 0;
      tween(450, (t) => {
        if (id === tiltTween) tiltW = from + (to - from) * t;
      }, ease.inOutCubic);
    },
    async focus(point, holdMs) {
      focusPoint = point.clone();
      await tween(700, (t) => (focusW = t), ease.inOutCubic);
      await new Promise((r) => setTimeout(r, holdMs));
      await tween(900, (t) => (focusW = 1 - t), ease.inOutCubic);
    },
    setOrbit(on) {
      orbiting = on;
    },
    update(dt, t) {
      if (orbiting) orbit += dt * 0.18;
      else orbit *= Math.max(0, 1 - dt * 2);
      let pos = base.pos.clone();
      let target = base.target.clone();
      const tp = tiltPose();
      if (tp && tiltW > 0) {
        pos.lerp(tp.pos, tiltW);
        target.lerp(tp.target, tiltW);
      }
      const away = 1 - introK;
      if (away > 0) {
        pos = yawAround(pos, target, -1.4 * away);
        pos.sub(target).multiplyScalar(1 + away * 1.6).add(target);
        pos.y += away * 10;
      }
      // Balanceo: casi nada en la vista de jugar (las fichas flotantes siguen a la cámara).
      const still = (pov == null && altView) || (pov != null && !altView);
      const swayAmp = still ? 0.004 : pov != null ? 0.012 : 0.035;
      pos = yawAround(pos, target, Math.sin(t * 0.21) * swayAmp + orbit);
      pos.y += still ? 0 : Math.sin(t * 0.33) * (pov != null ? 0.08 : 0.25);
      if (focusW > 0) {
        target.lerp(focusPoint, 0.45 * focusW);
        pos.lerp(target, 0.22 * focusW);
      }
      if (Math.abs(camera.fov - base.fov) > 0.01) {
        camera.fov = base.fov;
        camera.updateProjectionMatrix();
      }
      camera.position.copy(pos);
      camera.lookAt(target);
    },
  };
}
