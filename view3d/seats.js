/*
 * Posiciones de la mesa. Un jugador por lado, como en el Scrabble real:
 * asiento 0 al sur (+Z), 1 al oeste (−X), 2 al norte (−Z), 3 al este (+X).
 *
 * Todo lo de un asiento se define en «coordenadas del asiento» (el jugador
 * en +Z mirando al centro) y se gira con SEAT_ANGLE para llevarlo al mundo.
 */
import * as THREE from 'three';

export const SEAT_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Atril: distancia al centro y separación entre fichas. */
export const RACK = { z: 9.5, y: 0.35, spacing: 0.82, tilt: 1.1 };
/** Compañero: a la derecha del jugador, detrás del borde del tablero. */
export const COMPANION_LOCAL = new THREE.Vector3(6.2, 0, 9.4);
/** Bolsa de fichas: en una esquina libre de la mesa. */
export const BAG_POS = new THREE.Vector3(10.2, 0, -10.2);
/** Cámara sentada detrás del atril («Ver la mesa»). */
export const POV = { z: 16.5, y: 8.6, targetZ: 2.6, fov: 50 };
/**
 * Vista «Tablero» (la de jugar): alta desde el lado del jugador, el tablero
 * llena la pantalla y queda lugar abajo para las fichas flotantes.
 */
export const BOARD_VIEW = { z: 8.6, y: 19.5, targetZ: 1.4, fov: 40 };
/** Fichas flotantes: distancia a la cámara y altura en pantalla (−1 abajo, 1 arriba). */
export const HUD = { dist: 6, screenY: -0.78, maxSpacing: 0.62, tilt: 0.35 };

/** Lleva un punto de coordenadas del asiento al mundo. */
export function toWorld(seat, local) {
  return local.clone().applyAxisAngle(Y_AXIS, SEAT_ANGLE[seat] || 0);
}

/** Rotación (cuaternión) del asiento, para orientar objetos hacia el jugador. */
export function seatQuat(seat) {
  return new THREE.Quaternion().setFromAxisAngle(Y_AXIS, SEAT_ANGLE[seat] || 0);
}

/** Posición y rotación de la ficha k de n en el atril de un asiento. */
export function slotTransform(seat, k, n) {
  const x = (k - (n - 1) / 2) * RACK.spacing;
  const pos = toWorld(seat, new THREE.Vector3(x, RACK.y, RACK.z));
  // Parada e inclinada hacia su dueño (la cara con la letra mira al jugador).
  const quat = seatQuat(seat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), RACK.tilt));
  return { pos, quat };
}
