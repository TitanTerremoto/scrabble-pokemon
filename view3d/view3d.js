/*
 * Entrada del modo 3D (módulo). Si el navegador puede mostrar WebGL, deja
 * window.Board3D.create disponible y avisa con el evento «board3d-ready»;
 * host.js decide si usarlo (botón «🧊 3D»). Si no, queda el tablero 2D.
 */
import { createBoard3D } from './board3d.js';

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (err) {
    console.warn('Sin WebGL: se usa el tablero 2D.', err);
    return false;
  }
}

if (webglAvailable()) {
  window.Board3D = { create: createBoard3D };
  window.dispatchEvent(new Event('board3d-ready'));
}
