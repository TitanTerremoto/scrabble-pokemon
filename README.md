# Pokémon Scrabble

Scrabble de Pokémon para 2 a 4 jugadores, con el estilo y el sistema de sala
de **Pokémon Party** (Carrera de Medallas). Cada palabra tiene que ser uno de
los **1025 Pokémon**.

## Cómo jugar

| Forma | Qué hace falta |
| --- | --- |
| **Celulares en la misma Wi-Fi** | Correr el servidor local en la PC y abrir la pantalla principal con la **IP de la PC** (por ejemplo `http://192.168.1.9:8766`). «🌐 Crear sala en línea» muestra el enlace para los celulares. |
| **Varias pestañas en una PC** | Igual: cada pestaña de `control.html` es un jugador distinto. |
| **Una sola pantalla** | Solo la pantalla principal. Con varios jugadores en la misma pantalla, una cortina tapa el atril hasta que el jugador en turno la toca. |

Cada jugador tiene **su posición en la mesa** (Jugadores 1 y 3 a la izquierda,
2 y 4 a la derecha del tablero) y **todos ven el tablero**: en la pantalla
principal y en su celular, que además muestra **solo sus fichas**. Los asientos
pueden ser personas, bots o quedar vacíos.

```bash
python -m http.server 8766 --directory games/scrabble-pokemon
```

La PC necesita internet: PeerJS usa su servidor público para presentar los
dispositivos (los mensajes del juego viajan directo por la Wi-Fi).

## Vista 3D (navegador en horizontal)

La mesa es cuadrada, con **un jugador por lado** (Jugador 1 al sur, 2 al
oeste, 3 al norte y 4 al este), cada uno con su atril, su Pokémon compañero
(modelos de Cobblemon) y un cartel de nombre y puntos. Alrededor está el
**diorama de Kanto** de Pokémon Party (Centro Pokémon, Tienda, Liga, mar,
Monte Moon, árboles y Pokémon decorativos), y en una esquina, la **bolsa** de
fichas con cuántas quedan.

- **Vista de jugador:** en su pantalla (`control.html`, otra PC o pestaña),
  cada jugador ve el **tablero desde su lado**, alto y orientado hacia él,
  con **sus fichas flotando** en una fila abajo de la pantalla (siguen a la
  cámara). «🪑 Ver la mesa» lo sienta detrás de su atril para mirar a los
  rivales; «🎯 Ver el tablero» vuelve. Los atriles rivales están **boca
  abajo**: solo se ve cuántas fichas tienen (las letras ajenas nunca llegan
  a su pantalla). Sus propias fichas, los demás las ven boca abajo en su
  atril de la mesa.
- **Arrastrar:** se agarra una ficha de la fila flotante y se suelta en una
  casilla. Una ficha puesta se puede mover a otra casilla o devolver
  soltándola sobre la fila (o con un clic). Sigue valiendo hacer clic en una
  casilla y escribir.
- **Fichas de los rivales:** cuando alguien juega, sus fichas vuelan de su
  atril a las casillas (la letra se ve al caer) y después roba fichas de la
  bolsa, que vuelan a su atril. Si cambia fichas, van a la bolsa y salen
  otras. Solo se muestra lo confirmado, no lo que el rival está probando.
- **Crear un Pokémon:** el compañero lanza una Poké Ball sobre la palabra,
  se abre con un destello y sale el Pokémon con su nombre y los puntos.
  Un foco de luz marca el turno; al final hay fuegos artificiales.
- **Pantalla principal:** vista general de toda la mesa (para el público o
  el stream). Si el jugador en turno juega en esa misma pantalla, la cámara
  viaja a su asiento en primera persona.
- «🎥 Cámara» en la pantalla principal: vista general o cenital.
  «▦ Vista 2D» vuelve al tablero plano (se recuerda).

**Interfaz:** fondo con Poké Balls que se deslizan, tarjetas de jugador con
el puntaje que sube animado (+N), atril de madera donde las fichas se
reparten al renovarse, y Pokémon al azar flotando en la configuración.
`effects.css` tiene lo decorativo y las animaciones; con «reducir movimiento»
del sistema se desactivan.

Compañeros disponibles: Pikachu, Bulbasaur, Charmander, Squirtle, Treecko,
Jolteon, Emolga y Noibat.

## Reglas

- **Atril:** 10 fichas de letra y 1 **ficha de tipo**.
- **Ficha de tipo:** el Pokémon que crees tiene que ser de ese tipo (vale
  cualquiera de sus dos tipos). Sale según cuántos Pokémon hay de cada tipo;
  ★ Comodín (10 %) vale cualquier tipo. Después de jugar se roba otra.
- **Palabras:** nombres sin acentos ni signos (`Mr. Mime` → `MRMIME`,
  `Flabébé` → `FLABEBE`, `Ho-Oh` → `HOOH`). En una sola fila o columna, sin
  huecos. La primera pasa por la Poké Ball del centro; las demás se cruzan o
  se unen con fichas del tablero. Si se forman palabras de costado, también
  tienen que ser Pokémon.
- **Cada Pokémon se crea una sola vez** por partida.
- **Puntos:** letras según su frecuencia en los nombres (A=1 … Q/J=10),
  casillas x2/x3 letra y x2/x3 palabra (solo las que se cubren ese turno),
  +20 por usar 7 fichas o más.
- **Regla de oro:** al empezar cada turno, la bolsa garantiza que con las
  fichas del jugador se pueda crear al menos un Pokémon nuevo de su tipo en
  el tablero. Si no se puede, cambia las fichas justas (vuelven a la bolsa) y,
  si ningún Pokémon de ese tipo entra, también la ficha de tipo. El atril
  avisa cuando hubo ajuste.
- **Otras acciones:** cambiar fichas y/o la ficha de tipo (usa el turno),
  pasar, o pedir una pista (−5 puntos: muestra un Pokémon posible).
- **Fin:** al terminar las rondas elegidas, al vaciarse la bolsa (se termina
  la ronda), si todos pasan dos veces seguidas o cuando ya no entra ningún
  Pokémon en el tablero.

## Código

| Archivo | Responsabilidad |
| --- | --- |
| `pokedex.js` | Los 1025 Pokémon (nombre en español y tipos), generado desde los CSV de PokeAPI. |
| `rules.js` | Diccionario, fichas, casillas especiales, validación y puntaje (puro, sin DOM). |
| `moves.js` | Búsqueda de jugadas, bots y la regla de oro. |
| `game.js` | Estado de la partida: turnos, bolsa, atriles, fin; `publicView` filtra los atriles ajenos. |
| `board-view.js` | Tablero, fichas, ficha de tipo, tarjetas de jugador (compartido). |
| `play-panel.js` | Atril y botones del turno (compartido pantalla/celular). |
| `setup.js`, `host.js` | Configuración y partida en la pantalla principal (dueña del estado). |
| `net-protocol.js`, `net-host.js`, `control.js` | Sala PeerJS y página del jugador. |
| `view3d/` | Vista 3D (three.js): `stage.js` mesa, luces y diorama (`scenery.js`, `townmodels.js` de Pokémon Party); `board3d.js` une todo; `seats.js` posiciones de la mesa; `racks.js` atriles, bolsa y fichas que vuelan; `drag.js` arrastrar con el mouse; `tiles.js` fichas; `camera.js` cámara (primera persona y vista general); `companions.js` modelos; `fx.js` Poké Ball; `particles.js` partículas; `textures.js` texturas en canvas. |
| `effects.css`, `hero.js` | Fondo, tarjetas y animaciones de interfaz; Pokémon flotando en la configuración. |

La pantalla principal es la autoridad: los celulares solo mandan intenciones
y la partida se vuelve a validar ahí. La partida se guarda en `localStorage`
de la pantalla principal (al recargar sigue donde estaba).

Pruebas (reglas, regla de oro y partidas completas de bots):

```bash
node games/scrabble-pokemon/tests/rules.test.js
```

## Recursos Pokémon (uso privado)

Proyecto para jugar entre amigos, sin publicar. `assets/sprites/` (sprites de
los 1025) y los datos de `pokedex.js` vienen de [PokeAPI](https://github.com/PokeAPI);
`assets/types/`, `assets/town/` (edificios), `vendor/` (PeerJS y three.js) y
`models/` (modelos de [Cobblemon](https://cobblemon.tools)) se copiaron de
Pokémon Party. Las
imágenes son de Nintendo / Game Freak / The Pokémon Company.
