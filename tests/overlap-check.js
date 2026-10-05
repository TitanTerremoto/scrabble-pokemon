/*
 * Revisión de superposiciones de la pantalla de juego (se corre en el
 * navegador, con una partida abierta, desde la consola):
 *
 *   await import('./tests/overlap-check.js');  checkOverlaps()
 *
 * Devuelve la lista de problemas (vacía = nada se pisa):
 * - dos elementos del HUD que se tocan (barra, botones, aviso, placas, atril);
 * - un elemento del HUD sobre el espacio del tablero (data-safe, hud.js);
 * - algo fuera del área de juego o de la pantalla (cámaras);
 * - dentro de una placa, el nombre sobre los puntos; dentro del atril, sus
 *   partes entre sí; texto recortado en la barra de arriba.
 */
const box = (el) => el.getBoundingClientRect();
const visible = (el) => !!el && !el.closest('[hidden]') && box(el).width > 0 && box(el).height > 0;
const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

function checkOverlaps() {
  const problems = [];
  const area = document.getElementById('playArea');
  if (!visible(area)) return ['No hay partida en pantalla.'];
  const A = box(area);
  const [sx, sy, sw, sh] = (area.dataset.safe || '0,0,0,0').split(',').map(Number);
  const safe = { left: A.left + sx, top: A.top + sy, right: A.left + sx + sw, bottom: A.top + sy + sh };
  if (sw < 200 || sh < 200) problems.push(`espacio del tablero muy chico (${sw}×${sh})`);

  const items = [];
  const add = (selector, name) =>
    document.querySelectorAll(selector).forEach((el, i) => {
      if (visible(el)) items.push({ name: `${name}${i + 1}`, r: box(el) });
    });
  add('#hudTop .hud-btn', 'botón');
  add('#hudTurn > *', 'barra de turno');
  add('#hudToast', 'aviso');
  add('#roomBadge', 'sala');
  add('#ctrlStatusGame', 'estado');
  add('#hudPlaques .corner-plate', 'placa');
  add('#hudBottom', 'atril');

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) if (hit(items[i].r, items[j].r)) problems.push(`${items[i].name} × ${items[j].name}`);
    const it = items[i];
    if (hit(it.r, safe)) problems.push(`${it.name} × tablero`);
    if (it.r.left < A.left - 1 || it.r.right > A.right + 1 || it.r.top < A.top - 1 || it.r.bottom > A.bottom + 1) problems.push(`${it.name} fuera del área`);
  }

  document.querySelectorAll('.cam-slot').forEach((slot, i) => {
    const r = box(slot);
    if (r.top < -1 || r.bottom > innerHeight + 1) problems.push(`cámara ${i + 1} fuera de la pantalla`);
    if (hit(r, A)) problems.push(`cámara ${i + 1} × área de juego`);
  });

  document.querySelectorAll('.plate').forEach((plate, i) => {
    const info = plate.querySelector('.plate-info');
    const score = plate.querySelector('.plate-score');
    if (visible(info) && visible(score) && hit(box(info), box(score))) problems.push(`placa ${i + 1}: nombre × puntos`);
  });

  const parts = ['.play-panel .type-tile', '.play-panel .rack', '.play-panel .pp-side'].map((s) => document.querySelector(s)).filter(visible);
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(box(parts[i]), box(parts[j]))) problems.push(`atril: ${parts[i].className} × ${parts[j].className}`);
  document.querySelectorAll('.pp-actions .btn').forEach((b, i, all) => {
    for (let j = i + 1; j < all.length; j++) if (visible(b) && visible(all[j]) && hit(box(b), box(all[j]))) problems.push(`atril: botón ${i + 1} × botón ${j + 1}`);
  });

  document.querySelectorAll('#hudTurn .hud-pill, #hudTurn .ctrl-scores').forEach((bar) => {
    if (bar.scrollWidth > bar.clientWidth + 2) problems.push('barra de turno recortada');
  });
  return problems;
}

window.checkOverlaps = checkOverlaps;
export { checkOverlaps };
