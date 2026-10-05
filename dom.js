/*
 * Utilidades de interfaz (igual que en Pokémon Party): creación segura de
 * nodos, ventanas superpuestas y avisos breves.
 *
 * Todo el texto se inserta con textContent (nunca innerHTML), así un nombre
 * de jugador como "<b>Ana</b>" se muestra literalmente.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /** opts: { class, text, attrs, style, on } · children: nodos o textos. */
  function el(tag, opts, children) {
    const node = document.createElement(tag);
    const o = opts || {};
    if (o.class) node.className = o.class;
    if (o.text != null) node.textContent = String(o.text);
    for (const [k, v] of Object.entries(o.attrs || {})) {
      if (v === false || v == null) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const [k, v] of Object.entries(o.style || {})) node.style.setProperty(k, v);
    for (const [evt, fn] of Object.entries(o.on || {})) node.addEventListener(evt, fn);
    for (const child of children || []) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function openOverlay(id) {
    const ov = $(id);
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  function closeOverlay(id) {
    const ov = $(id);
    ov.classList.remove('show');
    ov.hidden = true;
  }

  let toastTimer = null;
  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth; // reinicia la animación
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      t.hidden = true;
    }, ms || 2200);
  }

  window.Dom = { $, el, openOverlay, closeOverlay, toast };
})();
