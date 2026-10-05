/*
 * Atriles de los 4 jugadores, la bolsa de fichas y las fichas que vuelan.
 *
 * - El atril de quien mira (pov) muestra sus letras; los de los rivales,
 *   fichas boca abajo: solo se conoce cuántas tienen (rackCount). Las letras
 *   ajenas nunca llegan a esta pantalla.
 * - Jugar: las fichas vuelan del atril a sus casillas (la letra se ve al
 *   caer, cuando ya es pública) y después se roban fichas de la bolsa.
 * - Cambiar: las fichas vuelan a la bolsa y salen otras.
 *
 * Mientras un atril está animando, los cambios que llegan se guardan
 * (want) y se aplican al terminar.
 *
 * Las fichas de quien mira no se dibujan en 3D: las tiene en el atril HTML
 * de abajo de la pantalla (play-panel.js). Las que roba vuelan desde la
 * bolsa hacia abajo de la pantalla. Sus rivales, en sus pantallas, las ven
 * boca abajo en su atril de la mesa.
 */
import * as THREE from 'three';
import { tween, ease, wait } from './tween.js';
import { labelTexture } from './textures.js';
import { cellPos } from './stage.js';
import { RACK, BAG_POS, HUD, seatQuat, slotTransform } from './seats.js';

const FLAT = new THREE.Quaternion();
const SELECT_LIFT = 0.3;
const TILE_W = 0.92; // ancho de una ficha con su separación
const FACE_CAMERA = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - HUD.tilt);

function makeBag() {
  const profile = [
    [0, 0], [0.9, 0.05], [1.3, 0.4], [1.4, 0.9], [1.25, 1.4], [0.8, 1.75], [0.45, 1.9], [0.5, 2.1], [0.7, 2.35], [0.5, 2.4], [0, 2.38],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sack = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), new THREE.MeshStandardMaterial({ color: '#7048e8', roughness: 0.85 }));
  sack.castShadow = true;
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.07, 8, 24), new THREE.MeshStandardMaterial({ color: '#ffcb05', roughness: 0.4, metalness: 0.3 }));
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 1.95;
  const body = new THREE.Group();
  body.add(sack, rope);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
  label.scale.set(2.4, 0.94, 1);
  label.position.y = 3.3;
  label.renderOrder = 10;
  const group = new THREE.Group();
  group.add(body, label);
  group.position.copy(BAG_POS);
  let count = null;
  return {
    group,
    mouth: BAG_POS.clone().add(new THREE.Vector3(0, 2.3, 0)),
    setCount(n) {
      if (n === count) return;
      count = n;
      if (label.material.map) label.material.map.dispose();
      label.material.map = labelTexture(['Bolsa', `${n} fichas`], '#7048e8', false);
      label.material.needsUpdate = true;
    },
    jiggle() {
      return tween(260, (t) => {
        const k = Math.sin(t * Math.PI);
        body.scale.set(1 + 0.12 * k, 1 - 0.14 * k, 1 + 0.12 * k);
      }, ease.linear);
    },
  };
}

function makeBar(seat) {
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.6 });
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(RACK.spacing * 10 + 0.8, 0.3, 1.1), wood);
  base.position.set(0, 0.15, RACK.z + 0.15);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(RACK.spacing * 10 + 0.8, 0.45, 0.16), wood);
  lip.position.set(0, 0.3, RACK.z - 0.42);
  for (const m of [base, lip]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.quaternion.copy(seatQuat(seat));
  return g;
}

export function createRacks(scene, factory, camera) {
  const racks = new Map(); // seat → { bar, tiles: [tile], items, reserve, busy, want }
  const bag = makeBag();
  scene.add(bag.group);
  let povSeat = null;

  /** Lugar de la ficha k de n abajo de la pantalla (adonde vuelan las que roba quien mira). */
  function hudTransform(k, n, lift = 0) {
    const h = 2 * HUD.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const w = h * camera.aspect;
    const spacing = Math.min(HUD.maxSpacing, (w * 0.8) / 10);
    const local = new THREE.Vector3((k - (n - 1) / 2) * spacing, (HUD.screenY * h) / 2 + lift * spacing, -HUD.dist);
    camera.updateMatrixWorld();
    return { pos: camera.localToWorld(local), quat: camera.quaternion.clone().multiply(FACE_CAMERA), scale: spacing / TILE_W };
  }

  /** Lugar de una ficha: flotante para quien mira, en su atril para los demás. */
  function slot(seat, k, n, lift = 0) {
    if (seat === povSeat) return hudTransform(k, n, lift);
    const at = slotTransform(seat, k, n);
    if (lift) at.pos.y += SELECT_LIFT;
    return { ...at, scale: 1 };
  }

  function ensure(seat) {
    if (!racks.has(seat)) {
      const bar = makeBar(seat);
      scene.add(bar);
      racks.set(seat, { bar, tiles: [], items: [], reserve: 0, busy: false, want: null });
    }
    return racks.get(seat);
  }

  /** Coloca las fichas del atril. reserve: lugares vacíos al final (para las que llegan). */
  function layout(seat, items, { animate = false, reserve = 0 } = {}) {
    const r = ensure(seat);
    const hud = seat === povSeat;
    r.bar.visible = !hud;
    while (r.tiles.length > items.length) factory.dispose(r.tiles.pop());
    while (r.tiles.length < items.length) {
      const t = factory.make(null);
      const at = slot(seat, r.tiles.length, items.length + reserve);
      t.group.position.copy(at.pos);
      t.group.quaternion.copy(at.quat);
      t.group.scale.setScalar(at.scale);
      r.tiles.push(t);
    }
    r.items = items;
    r.reserve = reserve;
    const n = items.length + reserve;
    items.forEach((item, k) => {
      const t = r.tiles[k];
      t.group.visible = true;
      t.gone = false;
      factory.skin(t, item.l, '', 'placed', 0);
      if (hud) {
        t.group.visible = false; // las de quien mira están en el atril HTML
        return;
      }
      const at = slot(seat, k, n, item.selected ? 1 : 0);
      t.group.scale.setScalar(1);
      if (!animate) {
        t.group.position.copy(at.pos);
        t.group.quaternion.copy(at.quat);
        return;
      }
      const from = t.group.position.clone();
      const q0 = t.group.quaternion.clone();
      tween(260, (k2) => {
        t.group.position.lerpVectors(from, at.pos, k2);
        t.group.quaternion.slerpQuaternions(q0, at.quat, k2);
      }, ease.out);
    });
  }

  /** Una ficha vuela de un lugar a otro en arco y desaparece al llegar. */
  async function flight(from, to, letter, ms, arc) {
    const t = factory.make(letter);
    const s0 = from.scale || 1;
    const s1 = to.scale || 1;
    t.group.position.copy(from.pos);
    t.group.quaternion.copy(from.quat);
    await tween(ms, (k) => {
      t.group.position.lerpVectors(from.pos, to.pos, k);
      t.group.position.y += Math.sin(k * Math.PI) * arc;
      t.group.quaternion.slerpQuaternions(from.quat, to.quat, k);
      t.group.scale.setScalar(s0 + (s1 - s0) * k);
    }, ease.inOutCubic);
    factory.dispose(t);
  }

  const transformOf = (tile) => ({ pos: tile.group.position.clone(), quat: tile.group.quaternion.clone(), scale: tile.group.scale.x });

  /** Índices repartidos a lo largo del atril (de qué fichas «salen» las jugadas). */
  function spread(n, k) {
    return Array.from({ length: k }, (_, j) => Math.min(n - 1, Math.max(0, Math.round(((j + 0.5) / k) * n - 0.5))));
  }

  function finish(seat) {
    const r = ensure(seat);
    r.busy = false;
    if (r.want) {
      const want = r.want;
      r.want = null;
      layout(seat, want, { animate: true });
    }
  }

  /** Roba d fichas: salen de la bolsa y vuelan a los lugares nuevos del atril. */
  async function draw(seat, d) {
    if (d <= 0) return;
    const r = ensure(seat);
    const kept = r.items;
    layout(seat, kept, { animate: true, reserve: d });
    const letters = r.want ? r.want.slice(-d) : Array(d).fill({ l: null });
    const n = kept.length + d;
    const arrivals = [];
    for (let j = 0; j < d; j++) {
      const to = slot(seat, kept.length + j, n);
      arrivals.push(
        wait(j * 130).then(() => {
          bag.jiggle();
          return flight({ pos: bag.mouth, quat: FLAT, scale: 1 }, to, letters[j] ? letters[j].l : null, 560, 2.5);
        }),
      );
    }
    await Promise.all(arrivals);
    layout(seat, [...kept, ...letters.map((x) => ({ l: x ? x.l : null, i: x ? x.i : null }))]);
  }

  /** Saca del atril las fichas que se fueron (ocultas) y acomoda el resto. */
  function keepVisible(seat) {
    const r = ensure(seat);
    const keep = r.tiles.map((t, k) => (t.gone ? null : r.items[k])).filter(Boolean);
    layout(seat, keep, { animate: true });
  }

  return {
    bag,
    /** Atriles según la vista. pov: asiento de quien mira (o null). */
    sync(view, extra, pov) {
      if (pov !== povSeat) {
        // Cambió quien mira (pantalla compartida): esos atriles se rearman.
        const old = povSeat;
        povSeat = pov;
        for (const seat of [old, pov]) {
          const r = racks.get(seat);
          if (r && !r.busy) layout(seat, r.items);
        }
      }
      bag.setCount(view.bagCount);
      const seats = new Set(view.players.map((p) => p.seat));
      for (const [seat, r] of racks) {
        if (seats.has(seat)) continue;
        r.tiles.forEach((t) => factory.dispose(t));
        scene.remove(r.bar);
        racks.delete(seat);
      }
      for (const p of view.players) {
        const mine = p.seat === pov && extra && extra.rack;
        const items = mine
          ? extra.rack.filter((x) => !x.used).map((x) => ({ l: x.l, i: x.i, selected: x.selected }))
          : Array.from({ length: p.rackCount }, () => ({ l: null, i: null }));
        const r = ensure(p.seat);
        if (r.busy) r.want = items;
        else layout(p.seat, items);
      }
    },

    /**
     * Jugada: cells [{ r, c, idx, fromRack }]. Las que ya estaban puestas en
     * el tablero (fromRack false) solo «aterrizan»; landed(idx) avisa cuándo
     * mostrar cada ficha en su casilla. drawn: fichas que roba después.
     */
    async play(seat, cells, drawn, landed) {
      const r = ensure(seat);
      r.busy = true;
      const flying = cells.filter((c) => c.fromRack);
      cells.filter((c) => !c.fromRack).forEach((c) => landed(c.idx));
      const picks = spread(r.tiles.length, flying.length);
      await Promise.all(
        flying.map((c, j) => {
          const src = r.tiles[picks[j]];
          const from = src ? transformOf(src) : slot(seat, 0, 1);
          if (src) {
            src.group.visible = false;
            src.gone = true;
          }
          const to = { pos: cellPos(c.r, c.c, 0.3), quat: FLAT, scale: 1 };
          return wait(j * 110)
            .then(() => flight(from, to, null, 560, 2.4))
            .then(() => landed(c.idx));
        }),
      );
      keepVisible(seat);
      await wait(260);
      await draw(seat, drawn);
      finish(seat);
    },

    /** Cambio de fichas: count van a la bolsa y salen otras tantas. */
    async exchange(seat, count) {
      const r = ensure(seat);
      r.busy = true;
      const picks = spread(r.tiles.length, count);
      await Promise.all(
        picks.map((k, j) => {
          const src = r.tiles[k];
          if (!src) return null;
          const from = transformOf(src);
          src.group.visible = false;
          src.gone = true;
          return wait(j * 110)
            .then(() => flight(from, { pos: bag.mouth, quat: FLAT, scale: 1 }, null, 520, 2.2))
            .then(() => bag.jiggle());
        }),
      );
      keepVisible(seat);
      await wait(300);
      await draw(seat, count);
      finish(seat);
    },
  };
}
