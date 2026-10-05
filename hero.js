/*
 * Decoración de la pantalla de configuración: Pokémon al azar de los 1025
 * flotando alrededor de la presentación. Cada pocos segundos uno se va y
 * aparece otro. Solo visual.
 */
(function () {
  'use strict';

  const { $ } = window.Dom;
  const BV = window.BoardView;
  const COUNT = 10;
  const SWAP_MS = 2600;
  const total = window.ScrabbleRules.DEX.length;

  const randomId = () => 1 + Math.floor(Math.random() * total);

  function place(node, i) {
    // Repartidos por los bordes, para no tapar el texto.
    const side = i % 2 === 0;
    node.style.left = side ? `${2 + Math.random() * 14}%` : `${74 + Math.random() * 20}%`;
    node.style.top = `${Math.random() * 70}%`;
    node.style.setProperty('--float-delay', `${-Math.random() * 6}s`);
    node.style.setProperty('--float-dur', `${5 + Math.random() * 4}s`);
  }

  function start() {
    const layer = $('heroSprites');
    if (!layer) return;
    const nodes = Array.from({ length: COUNT }, (_, i) => {
      const img = BV.sprite(randomId(), 'hero-sprite');
      place(img, i);
      layer.appendChild(img);
      return img;
    });
    let k = 0;
    setInterval(() => {
      if (document.hidden || $('screenSetup').hidden) return;
      const img = nodes[k++ % COUNT];
      img.classList.add('leaving');
      setTimeout(() => {
        img.src = `assets/sprites/${randomId()}.png`;
        place(img, k);
        img.classList.remove('leaving');
      }, 500);
    }, SWAP_MS);
  }

  start();
})();
