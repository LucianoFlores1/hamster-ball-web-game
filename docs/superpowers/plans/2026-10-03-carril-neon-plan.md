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
