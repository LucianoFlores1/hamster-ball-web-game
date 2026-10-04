# Carril Neón — Plan de implementación

> Generado a partir de `docs/superpowers/specs/2026-09-29-carril-neon-design.md` (revisado 02/10).
> Estado de cada paso al 03/10/2026.

## Decisiones de implementación

- **Simulación separada del dibujo.** `src/game/world.js` es lógica pura (sin Three.js):
  pelota, bloques, puntaje y dificultad. Las vistas (`player.js`, `blocksView.js`, `effects.js`,
  `scene.js`) solo leen ese estado. Por eso todas las reglas se pueden probar con Vitest.
- **Paso fijo de simulación** de 1/120 s, con el `dt` real limitado a 50 ms. La cámara lenta
  del choque escala el `dt` de efectos y cámara (la simulación ya terminó).
- **Regla 1 y 2 (carril lógico y roce).** La posición lateral `p` avanza linealmente de 0 a 1;
  el carril lógico cambia al cruzar el 50 %. Mientras dura el cambio, la pelota ocupa además el
  carril de destino. El roce exige que la pelota estuviera realmente en el carril que deja
  (evita "amagues" que cobran roces sin riesgo) y se marca en el bloque.
- **Regla 4 (siempre hay camino).** Los patrones se deciden en segundos y se convierten a
  distancia con la velocidad actual, pero nunca por debajo de `minSwitchGap × velocidad máxima`
  (+ largo del bloque) entre carriles distintos. Así el margen en tiempo se cumple a cualquier
  velocidad. Lo verifican una prueba de 80 000 bloques y un jugador automático que sobrevive
  5 minutos a velocidad máxima.
- **SDKs por build.** `vite build` no carga ningún SDK (sin llamadas externas). `--mode youtube`
  y `--mode crazygames` inyectan el `<script>` oficial como primer script del `<head>`.
- **Anuncios en YouTube desactivados** hasta confirmar en la documentación vigente que hay
  anuncios con premio para el juego (`canShowRewarded()` devuelve `false`; el juego está completo así).

## Pasos

| # | Paso | Estado |
|---|------|--------|
| 1 | Base: Vite + Three.js, escena, cámara responsiva, ruta y cuadrícula en movimiento | Hecho |
| 2 | Núcleo jugable: pelota, cambio de carril, pool de bloques, patrones, choque, reinicio | Hecho |
| 3 | Profundidad: roce, multiplicador, puntaje, dificultad, zigzags + pruebas | Hecho |
| 4 | Interfaz y plataforma: menú, HUD, fin, récord, adaptador local, pausa, silencio | Hecho |
| 5 | Sensación: estela, chispas, sacudida, FOV, color de cuadrícula, cámara lenta, sonidos | Hecho |
| 6 | Integración: adaptador YouTube, adaptador CrazyGames, build + ZIP | Hecho |
| 6b | Prueba en celular real y revisión de rendimiento (60 fps en Android de gama media) | **Pendiente (manual)** |
| 7 | Pulido: música (hecha, simple), ajuste fino de valores en `config.js` | Música hecha; ajuste pendiente jugando |

## Pendiente antes de publicar

1. Jugar en un celular real (`npm run dev` → abrir la URL de red en el celular) y ajustar
   `config.js`: velocidad inicial y máxima, curva de separación, ventana de roce, bonus.
   Objetivo: partidas de 30 s a 2 min.
2. Medir fps en un Android de gama media. Si no llega a 60: bajar `setPixelRatio` a 1.25 en
   táctil, bajar `MAX_SPARKS` o la cantidad de líneas de la cuadrícula.
3. Portada y miniaturas en los tamaños que pida CrazyGames.
4. YouTube: verificar la URL del SDK y los nombres de la API en la documentación vigente
   (`ytgame.game.*`, `ytgame.system.*`, `ytgame.engagement.sendScore`) y probar en su entorno de pruebas.
5. CrazyGames (lanzamiento completo, si invitan): verificar nombres del SDK v3 en su documentación.

## Pasada de "juice" (04/10/2026)

**Música** (`src/audio/music.js`): pista synthwave por capas a 118 BPM (La menor, Fa, Do, Sol).
Pad, arpegio con eco, bajo, bombo con efecto de bombeo, platillos, caja y melodía. Las capas
entran con el multiplicador y la velocidad; el filtro se abre al subir de nivel y se cierra
("bajo el agua") al chocar. Expone el pulso para que lo visual lata en tiempo.

**Sonido** (`src/audio/sfx.js`): compresor final; cambio de carril con paneo hacia el carril
destino; roces con notas que suben por la escala pentatónica con cada roce seguido; acorde y
barrido al llegar a x8; sonido de multiplicador perdido; choque con astillas de vidrio;
barridos de inicio y de continuar; fanfarria de récord; conteo del puntaje; clic de botones.

**Visual**: todo late con la música (cuadrícula, bordes, sol, bloques, pelota). Pelota con
deformación e inclinación al cambiar de carril, rebote con resorte, color según el multiplicador
(también la estela) y flotación en el menú. Bloques que caen del cielo con rebote y giro, se
sacuden al ser rozados y el que te golpea queda rojo. Ondas expansivas, explosiones de
partículas, líneas de velocidad, estrellas titilantes. Cámara con vuelo en el menú, bajada al
empezar, golpe de FOV en roces, inclinación y acercamiento al chocar.

**Sensación de juego**: micro cámara lenta en cada roce, congelamiento corto antes de la cámara
lenta del choque, vibración en Android, cartel de nivel (x2…x6, "MAX x8"), récord superado en
plena partida.

**Interfaz**: título que se enciende como un tubo de neón, pantallas con entrada animada,
puntaje final que cuenta desde 0, botones que aparecen con rebote, botón de continuar que
pulsa, viñeta de color según el multiplicador, barra del multiplicador que parpadea cuando
está por perderse. Respeta `prefers-reduced-motion`.

Todo ajustable en `config.js` → `fx` (cámara lenta de roce, congelamiento, golpe de FOV, vibración).
