/*
 * Panel del atril: las fichas del jugador, su ficha de tipo y los botones
 * del turno. Lo usan la pantalla principal (asientos que juegan ahí) y el
 * celular. Solo arma la jugada y la manda como intención; quien decide es
 * la pantalla principal (ScrabbleGame), que vuelve a validar todo.
 *
 * Poner fichas: tocar una ficha del atril y después una casilla (o tocar una
 * casilla y escribir con el teclado; tocarla de nuevo cambia la dirección).
 * Tocar una ficha puesta la devuelve al atril.
 */
(function () {
  'use strict';

  const R = window.ScrabbleRules;
  const { el } = window.Dom;
  const BV = window.BoardView;

  /**
   * opts.container: dónde se dibuja · opts.send(action): manda la intención
   * opts.onChange(): la jugada en armado cambió (para redibujar el tablero)
   */
  function create(opts) {
    let view = null;
    let key = '';
    let order = []; // orden visual del atril (Mezclar), índices reales
    let selected = null; // índice del atril elegido
    let pending = []; // [{ r, c, i }]
    let cursor = null; // { r, c, dir } para escribir con el teclado
    let exchange = null; // { idx:Set, type:bool } en modo cambio
    let deal = false; // atril nuevo: las fichas entran repartidas

    const me = () => (view && view.me >= 0 ? view.players[view.me] : null);
    const myTurn = () => !!view && view.phase === 'play' && view.turn === view.me;
    const rack = () => (me() && me().rack) || [];
    const usedIdx = () => new Set(pending.map((p) => p.i));
    const pendingLetters = () => pending.map((p) => ({ r: p.r, c: p.c, l: rack()[p.i] }));

    function reset() {
      selected = null;
      pending = [];
      cursor = null;
      exchange = null;
      order = rack().map((_, i) => i);
    }

    function changed() {
      render();
      if (opts.onChange) opts.onChange();
    }

    function update(next) {
      view = next;
      const p = me();
      const nextKey = p ? `${view.moveNo}:${view.turn}:${(p.rack || []).join('')}` : '';
      if (nextKey !== key) {
        key = nextKey;
        reset();
        deal = true;
      }
      render();
    }

    const occupied = (r, c) => !!view.board[R.idx(r, c)] || pending.some((p) => p.r === r && p.c === c);

    function place(r, c, i) {
      pending.push({ r, c, i });
      selected = null;
    }

    function tapCell(r, c) {
      if (!myTurn() || exchange) return;
      const at = pending.findIndex((p) => p.r === r && p.c === c);
      if (at >= 0) {
        pending.splice(at, 1);
        return changed();
      }
      if (view.board[R.idx(r, c)]) return;
      if (selected != null) {
        place(r, c, selected);
        cursor = null;
      } else if (cursor && cursor.r === r && cursor.c === c) {
        cursor.dir = cursor.dir === 'H' ? 'V' : 'H';
      } else {
        cursor = { r, c, dir: 'H' };
      }
      changed();
    }

    function tapTile(i) {
      if (exchange) {
        if (exchange.idx.has(i)) exchange.idx.delete(i);
        else exchange.idx.add(i);
        return render();
      }
      if (usedIdx().has(i)) return;
      if (cursor && myTurn()) {
        place(cursor.r, cursor.c, i);
        advanceCursor();
        return changed();
      }
      selected = selected === i ? null : i;
      render();
    }

    function advanceCursor() {
      let { r, c } = cursor;
      const dr = cursor.dir === 'V' ? 1 : 0;
      const dc = cursor.dir === 'H' ? 1 : 0;
      do {
        r += dr;
        c += dc;
      } while (R.inBounds(r, c) && occupied(r, c));
      cursor = R.inBounds(r, c) ? { r, c, dir: cursor.dir } : null;
    }

    /** Teclado (solo en pantallas con teclado): letras, Retroceso, Enter, Escape. */
    function onKey(e) {
      if (!view || !myTurn() || exchange || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return false;
      const k = e.key.length === 1 ? R.normalize(e.key) : '';
      if (k && cursor) {
        const used = usedIdx();
        const i = rack().findIndex((l, j) => l === k && !used.has(j));
        if (i < 0) return true;
        place(cursor.r, cursor.c, i);
        advanceCursor();
        changed();
        return true;
      }
      if (e.key === 'Backspace' && pending.length) {
        const last = pending.pop();
        cursor = { r: last.r, c: last.c, dir: cursor ? cursor.dir : 'H' };
        changed();
        return true;
      }
      if (e.key === 'Enter' && pending.length) {
        submitPlay();
        return true;
      }
      if (e.key === 'Escape') {
        reset();
        changed();
        return true;
      }
      return false;
    }

    function preview() {
      if (!pending.length || !me()) return null;
      return R.validatePlay({ board: view.board, placements: pendingLetters(), type: me().type, used: view.used });
    }

    function submitPlay() {
      const res = preview();
      if (!res || !res.ok) return;
      opts.send({ type: 'play', tiles: pending.map(({ r, c, i }) => ({ r, c, i })) });
    }

    function shuffle() {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      render();
    }

    // ── Dibujo ──
    function button(label, onClick, cls, disabled) {
      return el('button', { class: `btn ${cls || ''}`, text: label, attrs: { type: 'button', disabled: !!disabled }, on: { click: onClick } });
    }

    function statusLine() {
      if (view.phase !== 'play') return el('p', { class: 'pp-status', text: 'La partida terminó.' });
      if (!myTurn()) {
        const p = view.players[view.turn];
        return el('p', { class: 'pp-status wait', text: `Espera: es el turno de ${p.name}.` });
      }
      if (exchange) return el('p', { class: 'pp-status', text: 'Elige las fichas (y/o la ficha de tipo) que vuelven a la bolsa. Cambiar usa tu turno.' });
      const res = preview();
      if (!res) {
        return el('p', { class: 'pp-status', text: `Crea un Pokémon ${me().type === R.ANY_TYPE ? 'de cualquier tipo' : `de tipo ${R.typeName(me().type)}`} cruzando las fichas del tablero.` });
      }
      if (!res.ok) return el('p', { class: 'pp-status bad', text: `✗ ${res.error}` });
      return el('p', { class: 'pp-status good' }, [BV.sprite(res.entries[0].id, 'mini'), `✓ ${res.entries[0].name} · ${res.score} puntos`]);
    }

    function render() {
      const c = opts.container;
      const p = me();
      if (!view || !p || !p.rack) {
        c.replaceChildren();
        return;
      }
      const used = usedIdx();
      const turn = myTurn();
      const res = turn && !exchange ? preview() : null;
      const tiles = order
        .filter((i) => i < p.rack.length)
        .map((i, pos) =>
          el(
            'button',
            {
              style: deal ? { '--deal-delay': `${pos * 45}ms` } : {},
              class: `rack-slot ${deal ? 'deal' : ''} ${used.has(i) ? 'used' : ''} ${selected === i ? 'selected' : ''} ${exchange && exchange.idx.has(i) ? 'marked' : ''}`,
              attrs: { type: 'button', disabled: used.has(i), 'aria-label': `Ficha ${p.rack[i]}` },
              on: { click: () => tapTile(i) },
            },
            [BV.letterTile(p.rack[i])],
          ),
        );
      const typeEl = BV.typeTile(p.type, {
        selected: exchange && exchange.type,
        onClick: exchange
          ? () => {
              exchange.type = !exchange.type;
              render();
            }
          : null,
      });

      const actions = exchange
        ? [
            button('🔄 Confirmar cambio', () => opts.send({ type: 'exchange', indices: [...exchange.idx], swapType: exchange.type }), 'btn-primary', !exchange.idx.size && !exchange.type),
            button('Cancelar', () => {
              exchange = null;
              render();
            }),
          ]
        : [
            button('✅ Crear Pokémon', submitPlay, 'btn-primary', !turn || !res || !res.ok),
            button('↩ Recoger', () => {
              pending = [];
              cursor = null;
              changed();
            }, '', !pending.length),
            button('🔀 Mezclar', shuffle),
            button('🔄 Cambiar', () => {
              reset();
              exchange = { idx: new Set(), type: false };
              changed();
            }, '', !turn),
            button('⏭ Pasar', () => opts.send({ type: 'pass' }), '', !turn),
            button(view.hint ? '💡 Pista usada' : '💡 Pista (−5)', () => opts.send({ type: 'hint' }), '', !turn || !!view.hint),
          ];

      c.replaceChildren(
        el('div', { class: `play-panel ${turn ? 'my-turn' : ''}`, style: { '--pc': p.color } }, [
          el('div', { class: 'pp-head' }, [
            el('strong', { text: turn ? `¡Tu turno, ${p.name}!` : `Fichas de ${p.name}` }),
            el('span', { class: 'pp-bag', text: `Bolsa: ${view.bagCount}` }),
          ]),
          view.turnNote ? el('p', { class: 'pp-note', text: `✨ ${view.turnNote}` }) : null,
          view.hint ? el('p', { class: 'pp-hint' }, [BV.sprite(view.hint.id, 'mini'), `Pista: puedes crear a ${R.DEX[view.hint.id - 1].name} (marcado en el tablero).`]) : null,
          el('div', { class: 'rack' }, [typeEl, el('div', { class: 'rack-tiles' }, tiles)]),
          statusLine(),
          el('div', { class: 'pp-actions' }, actions),
        ]),
      );
      deal = false;
    }

    // ── Arrastrar (tablero 3D) ──
    const canEdit = () => myTurn() && !exchange;
    const freeCell = (r, c) => R.inBounds(r, c) && !occupied(r, c);

    /** Suelta la ficha i del atril en (r, c). */
    function placeAt(i, r, c) {
      if (!canEdit() || usedIdx().has(i) || i < 0 || i >= rack().length || !freeCell(r, c)) return false;
      place(r, c, i);
      cursor = null;
      changed();
      return true;
    }

    /** Mueve una ficha ya puesta este turno a otra casilla. */
    function movePending(from, to) {
      const p = pending.find((x) => x.r === from.r && x.c === from.c);
      if (!canEdit() || !p || !freeCell(to.r, to.c)) return false;
      p.r = to.r;
      p.c = to.c;
      changed();
      return true;
    }

    /** Devuelve al atril la ficha puesta en (r, c). */
    function removeAt(r, c) {
      const at = pending.findIndex((x) => x.r === r && x.c === c);
      if (!canEdit() || at < 0) return false;
      pending.splice(at, 1);
      changed();
      return true;
    }

    /** Lo que necesita el tablero: fichas en armado, cursor, pista y el atril en su orden visual. */
    function boardExtra() {
      const used = usedIdx();
      return {
        pending: pending.map((p) => ({ r: p.r, c: p.c, l: rack()[p.i], i: p.i })),
        cursor,
        hint: view && view.hint,
        rack: order.filter((i) => i < rack().length).map((i) => ({ i, l: rack()[i], used: used.has(i), selected: selected === i })),
        editable: canEdit(),
      };
    }

    return { update, tapCell, tapTile, onKey, placeAt, movePending, removeAt, boardExtra };
  }

  window.PlayPanel = { create };
})();
