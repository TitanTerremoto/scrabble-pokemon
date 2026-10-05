/*
 * Mouse sobre el tablero 3D: arrastrar fichas del atril al tablero, mover
 * las ya puestas, devolverlas al atril, y los clics de siempre (tocar casilla
 * para escribir con el teclado, tocar ficha para elegirla).
 *
 * Mientras se arrastra, una copia de la ficha sigue al mouse por encima del
 * tablero y la casilla de destino se marca. Solo decide la intención; el
 * panel (play-panel.js) la valida y la partida la vuelve a validar.
 */
import * as THREE from 'three';
import { tween, ease } from './tween.js';
import { BOARD_TOP } from './stage.js';

const R = window.ScrabbleRules;
const CLICK_PX = 6;
const CARRY_Y = BOARD_TOP + 1.1;

/**
 * opts: canvas, camera, factory, getRackTiles(), getPendingTiles(),
 *   slotOf(tile), overRack(ndc), canEdit(), onHover(cell), onHoverTile(tile),
 *   onPlace(i, cell), onMove(from, to), onRemove(cell), onTapCell(cell),
 *   onTapTile(i), onDragState(on)
 */
export function createDrag(opts) {
  const raycaster = new THREE.Raycaster();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
  const carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CARRY_Y);
  let press = null; // { x, y, kind: 'rack'|'pending'|'cell', tile, i, cell }
  let drag = null; // { proxy, source }
  let hover = null;

  const ndc = new THREE.Vector2();
  function setRay(ev) {
    const rect = opts.canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, opts.camera);
  }

  function planePoint(plane) {
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }

  function cellOf(point) {
    if (!point) return null;
    const c = Math.round(point.x + R.CENTER);
    const r = Math.round(point.z + R.CENTER);
    return R.inBounds(r, c) ? { r, c } : null;
  }

  /** ¿Qué ficha hay bajo el mouse? (las del atril propio y las puestas este turno) */
  function pickTile(list) {
    const meshes = list.map((t) => t.group);
    const hit = raycaster.intersectObjects(meshes, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.tile) o = o.parent;
    return o ? o.userData.tile : null;
  }

  function setHover(cell) {
    if ((cell && hover && cell.r === hover.r && cell.c === hover.c) || (!cell && !hover)) return;
    hover = cell;
    opts.onHover(cell);
  }

  function startDrag() {
    const src = press.tile;
    const proxy = opts.factory.make(src.letter);
    proxy.group.position.copy(src.group.getWorldPosition(new THREE.Vector3()));
    proxy.group.quaternion.copy(src.group.getWorldQuaternion(new THREE.Quaternion()));
    proxy.group.scale.copy(src.group.scale);
    opts.factory.skin(proxy, src.letter, '', 'pending', src.top.rotation.z);
    src.group.visible = false;
    src.group.userData.held = true;
    drag = { proxy, source: press };
    opts.onDragState(true);
  }

  function moveProxy() {
    const p = planePoint(carryPlane);
    if (!p) return;
    const g = drag.proxy.group;
    g.position.lerp(p, 0.55);
    g.scale.lerp(new THREE.Vector3(1, 1, 1), 0.25);
    g.quaternion.slerp(new THREE.Quaternion(), 0.3);
    g.rotation.z = Math.max(-0.3, Math.min(0.3, (p.x - g.position.x) * 0.8));
    setHover(cellOf(planePoint(boardPlane)));
  }

  async function endDrag() {
    const { proxy, source } = drag;
    drag = null;
    opts.onDragState(false);
    // Soltada sobre la fila de fichas flotantes: vuelve al atril.
    const overRack = opts.overRack(ndc);
    const point = planePoint(boardPlane);
    const cell = overRack ? null : cellOf(point);
    // Antes de avisar: si la jugada cambia el atril, se vuelve a acomodar entero.
    source.tile.group.userData.held = false;
    let ok = false;
    if (source.kind === 'rack') {
      ok = !!cell && opts.onPlace(source.i, cell);
    } else if (cell && (cell.r !== source.cell.r || cell.c !== source.cell.c)) {
      ok = opts.onMove(source.cell, cell);
    } else if (!cell) {
      ok = opts.onRemove(source.cell);
    }
    setHover(null);
    if (ok) {
      opts.factory.dispose(proxy);
      return;
    }
    // No se pudo: la ficha vuelve a su lugar (oculta mientras vuelve la copia).
    source.tile.group.userData.held = true;
    source.tile.group.visible = false;
    const back = source.kind === 'rack' ? opts.slotOf(source.tile) : { pos: source.tile.group.position.clone(), quat: source.tile.group.quaternion.clone(), scale: 1 };
    if (back) {
      const from = proxy.group.position.clone();
      const q0 = proxy.group.quaternion.clone();
      await tween(260, (k) => {
        proxy.group.position.lerpVectors(from, back.pos, k);
        proxy.group.quaternion.slerpQuaternions(q0, back.quat, k);
        proxy.group.scale.setScalar(1 + ((back.scale || 1) - 1) * k);
      }, ease.out);
    }
    opts.factory.dispose(proxy);
    source.tile.group.userData.held = false;
    source.tile.group.visible = true;
  }

  const canvas = opts.canvas;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    setRay(ev);
    const editable = opts.canEdit();
    // Las fichas del atril se pueden tocar siempre (por ejemplo, para marcarlas al cambiar).
    const rackTile = pickTile(opts.getRackTiles());
    if (rackTile) {
      press = { x: ev.clientX, y: ev.clientY, kind: 'rack', tile: rackTile, i: rackTile.group.userData.rackIndex };
    } else {
      const pend = editable ? pickTile(opts.getPendingTiles()) : null;
      if (pend) press = { x: ev.clientX, y: ev.clientY, kind: 'pending', tile: pend, cell: pend.group.userData.cell };
      else press = { x: ev.clientX, y: ev.clientY, kind: 'cell', cell: cellOf(planePoint(boardPlane)) };
    }
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener('pointermove', (ev) => {
    setRay(ev);
    if (press && !drag && press.kind !== 'cell' && opts.canEdit() && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > CLICK_PX) startDrag();
    if (drag) return moveProxy();
    if (ev.pointerType !== 'mouse') return;
    const rackHover = pickTile(opts.getRackTiles());
    opts.onHoverTile(rackHover);
    const overTile = rackHover || pickTile(opts.getPendingTiles());
    canvas.style.cursor = overTile && opts.canEdit() ? 'grab' : cellOf(planePoint(boardPlane)) ? 'pointer' : 'default';
    if (!press) setHover(rackHover ? null : cellOf(planePoint(boardPlane)));
  });

  canvas.addEventListener('pointerup', (ev) => {
    setRay(ev);
    if (drag) {
      press = null;
      endDrag();
      return;
    }
    const p = press;
    press = null;
    if (!p) return;
    if (p.kind === 'rack') opts.onTapTile(p.i);
    else if (p.kind === 'pending') opts.onRemove(p.cell);
    else if (p.cell) opts.onTapCell(p.cell);
  });

  canvas.addEventListener('pointerleave', () => {
    if (!drag) setHover(null);
  });

  return {
    isDragging: () => !!drag,
    /** En cada frame: la copia arrastrada se mueve suave aunque el mouse esté quieto. */
    tick() {
      if (drag) moveProxy();
    },
  };
}
