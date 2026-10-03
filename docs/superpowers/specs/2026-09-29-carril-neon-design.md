# Carril Neón — Documento de diseño

> Nombre de trabajo. Creado: 29/09/2026 (fecha mal asumida en el brainstorming). Revisado: 02/10/2026. Estado: aprobado.
> Este documento es la fuente de verdad para Claude Code. Antes de escribir código, generar un plan de implementación a partir de él.

## 1. Objetivo y contexto

Juego web arcade de un solo toque, hecho en ~6–12 horas, para ganar algo de dinero con anuncios.

- **Plataforma principal:** CrazyGames (lanzamiento básico, subida al terminar el cronograma).
- **Plataforma secundaria:** YouTube Playables (el desarrollador aún no tiene acceso; se aplica en paralelo, o vía un socio oficial como Playgama, a evaluar).
- **Principio clave:** el juego cumple desde el día 1 los requisitos técnicos de YouTube Playables, aunque se publique primero en CrazyGames.
- **Desarrollador:** programa con soltura, sin experiencia previa en juegos.

## 2. Núcleo del juego

- Una pelota avanza sola por una ruta de **dos carriles** en perspectiva, hacia un horizonte.
- **Control:** un toque, clic o barra espaciadora cambia de carril. Transición suave de ~0,15 s.
- Llegan **bloques** desde el horizonte, en un carril u otro. Chocar = fin de partida.
- **Roce al ras:** cambiar de carril cuando el bloque está muy cerca (valor inicial: tiempo hasta el impacto < 0,25 s) cuenta como roce:
  - suma puntos extra,
  - sube el multiplicador: x1 → x2 → x3 → x4 → x6 → x8 (tope),
  - dispara destello y sonido que se intensifican con el nivel del multiplicador.
- Si pasan **3 s sin roces**, el multiplicador vuelve a x1.
- **Puntaje:** base por distancia recorrida × multiplicador, más bonus por roce.
- **Dificultad progresiva:** sube la velocidad y baja la separación entre bloques con el tiempo. Los patrones SIEMPRE dejan un camino posible. Cada tanto, secuencias de bloques alternados (zigzag) para picos de adrenalina.
- **Fin de partida:** puntaje, récord personal y dos botones:
  - "Jugar de nuevo" (instantáneo),
  - "Ver anuncio para continuar" (una vez por partida, SOLO si el adaptador confirma que hay anuncio con premio disponible). Al continuar: se eliminan los bloques cercanos y hay ~1,5 s de invulnerabilidad.
- **Duración objetivo:** 30 s a 2 min por partida.

### Reglas precisas (obligatorias, resuelven ambigüedades)

1. **Carril lógico:** al tocar empieza la animación de cambio (0,15 s), pero el carril lógico de la pelota (el que se usa para choques) cambia al **50 % de la animación** (0,075 s después del toque). Un bloque del carril de origen que llega antes de ese instante es choque.
2. **Roce al ras:** cuenta si, en el momento del toque, el bloque del **carril que dejás** tiene un tiempo hasta el impacto menor a 0,25 s (y mayor a 0,075 s, si no es choque por la regla 1). Se cobra **una sola vez por bloque** (marcar el bloque como "rozado"). Si el carril de destino tiene un bloque que llega antes de que la pelota termine el cambio, es choque, no roce.
3. **Separación en tiempo, no en distancia:** toda separación entre bloques se define y se valida en segundos según la velocidad actual. La separación inicial debe ser claramente menor al tiempo de reinicio del multiplicador (valor inicial: 1,2 s entre bloques, contra 3 s de reinicio), para que el multiplicador pueda subir desde el principio.
4. **Siempre hay camino, medido en tiempo:** en cualquier patrón (incluidos los zigzags), el tiempo entre dos bloques consecutivos de carriles distintos debe ser ≥ 0,15 s (cambio) + margen de reacción. Valor inicial: **mínimo 0,4 s**, ajustable en `config.js`. La prueba automática verifica esta separación **a la velocidad máxima**, no solo que exista un carril libre.

Todos los valores numéricos van en un único archivo de configuración (`config.js`) para ajustarlos jugando.

## 3. Visuales (estética retro futurista / synthwave)

- **Motor:** Three.js, 3D real, cámara en perspectiva.
- **Escena:** cielo en degradé (violeta oscuro → magenta), sol retro a franjas en el horizonte, montañas de silueta con líneas, piso de cuadrícula violeta que se desplaza hacia la cámara (animar el desplazamiento de textura o la posición, no crear geometría).
- **Ruta:** bordes magenta, línea central punteada.
- **Pelota:** esfera celeste con material emisivo y estela que se desvanece.
- **Bloques:** cubos oscuros con aristas magenta luminosas (EdgesGeometry / LineSegments).
- **Cámara:** detrás y arriba de la pelota. Se ajusta según la relación de aspecto para que ambos carriles siempre se vean completos, en celular vertical y en pantalla horizontal.
- **Efectos de adrenalina:**
  - el campo de visión (FOV) se abre levemente con la velocidad,
  - roce: chispas + sacudida leve de cámara,
  - la cuadrícula cambia de color según el multiplicador: violeta → magenta → dorado (x8),
  - choque: la pelota se rompe en fragmentos + ~0,4 s de cámara lenta antes de la pantalla de puntaje.
- **Interfaz (HUD y menús):** HTML/CSS superpuesto al canvas, tipografía monoespaciada del sistema (sin fuentes externas). Botón de silencio siempre visible.

### Reglas de rendimiento (obligatorias)

- Geometría de pocos polígonos.
- Brillo neón simulado con materiales emisivos/básicos, SIN posprocesado pesado (no bloom en celular).
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, y 1,5 en celulares si hace falta.
- **Pool de objetos** para bloques y partículas: reciclar, nunca crear/destruir durante la partida.
- Objetivo: 60 fps estables en un celular Android de gama media.

## 4. Sonido

- Todo generado con **Web Audio API** (sin archivos de audio, sin problemas de derechos):
  - "whoosh" al cambiar de carril,
  - notas ascendentes en cada roce, más agudas según el multiplicador,
  - golpe grave al chocar.
- **Música (OPCIONAL, último en prioridad):** loop synthwave simple (bajo + arpegio) generado por código.
- El audio se inicializa con la primera interacción del usuario (política de los navegadores).
- Respeta el estado de audio de la plataforma (en YouTube: `ytgame.system.isAudioEnabled()` y su evento de cambio).

## 5. Arquitectura

### Principio: adaptadores de plataforma

El juego nunca llama directamente a SDKs de plataformas. Habla con una interfaz común; al iniciar, se detecta el entorno y se elige el adaptador.

```js
// Interfaz común (todas las funciones async donde aplique)
platform.init()                 // inicializa el SDK si existe
platform.firstFrameReady()      // primer cuadro dibujado
platform.gameReady()            // menú listo para interactuar
platform.gameplayStart()        // empieza una partida
platform.gameplayStop()         // termina o se pausa una partida
platform.loadData()             // -> string | null
platform.saveData(str)
platform.sendScore(n)
platform.canShowRewarded()      // -> boolean
platform.showRewarded()         // -> boolean (premio obtenido)
platform.showInterstitial()     // anuncio entre partidas (frecuencia controlada)
platform.onPause(cb) / platform.onResume(cb)
platform.isAudioEnabled() / platform.onAudioChange(cb)
```

Adaptadores:

- `local.js`: localStorage, sin anuncios (o anuncios simulados en modo desarrollo). Sirve para pruebas e itch.io.
- `youtube.js`: detecta `typeof ytgame !== "undefined" && ytgame.IN_PLAYABLES_ENV`.
- `crazygames.js`: detecta el SDK de CrazyGames. En el lanzamiento básico puede quedar desactivado.

### Estructura de carpetas sugerida

```
/
├─ index.html
├─ vite.config.js          (base: './' para rutas relativas)
├─ docs/superpowers/specs/ (este documento)
├─ src/
│  ├─ main.js              (arranque, elección de adaptador, bucle principal)
│  ├─ config.js            (todos los valores ajustables)
│  ├─ game/
│  │  ├─ scene.js          (cielo, sol, montañas, cuadrícula, ruta)
│  │  ├─ camera.js         (cámara responsiva, FOV, sacudida)
│  │  ├─ player.js         (pelota, carriles, estela)
│  │  ├─ obstacles.js      (pool de bloques, generación de patrones)
│  │  ├─ collision.js      (choque y detección de roce: lógica pura)
│  │  ├─ scoring.js        (puntaje y multiplicador: lógica pura)
│  │  ├─ difficulty.js     (curva de dificultad: lógica pura)
│  │  ├─ effects.js        (chispas, color de cuadrícula, cámara lenta)
│  │  └─ state.js          (menú, jugando, pausa, fin)
│  ├─ audio/sfx.js         (sonidos y música por Web Audio)
│  ├─ ui/                  (HUD, menú, pantalla de fin, CSS)
│  └─ platform/            (index.js + local.js, youtube.js, crazygames.js)
└─ tests/                  (Vitest para la lógica pura)
```

### Bucle y tiempo

- El tiempo entre cuadros (`dt`) se limita a **50 ms** como máximo, para que al volver de una pausa o de un tirón los bloques no salten de golpe.
- `dt` pasa por un **factor de escala de tiempo** (`timeScale`, normalmente 1). La cámara lenta del choque es bajar ese factor (por ejemplo a 0,2) durante ~0,4 s reales.
- **Pausa:** en YouTube llega por `onPause`/`onResume`; el adaptador local (y el de CrazyGames si no la provee) escucha `document.visibilitychange`.
- Three.js se importa con imports nombrados (`import { Mesh, ... } from 'three'`).
- Los anuncios con premio pueden no existir en ninguna plataforma: con `canShowRewarded()` en `false`, el juego debe estar completo.

**Pruebas:** la lógica pura (carril lógico, roce y su cobro único, multiplicador y su reinicio, puntaje, dificultad, separación mínima en tiempo a velocidad máxima, adaptador local) se desarrolla con pruebas automáticas (Vitest). Lo visual y la sensación de juego se prueban a mano, en navegador de escritorio y en un celular real (`vite --host` en la misma red WiFi).

**Build:** `vite build` → carpeta `dist/` con rutas relativas → ZIP. Three.js incluido en el paquete, nunca desde CDN.

## 6. Requisitos de plataformas

### YouTube Playables (cumplir desde ya)

- [ ] Cargar el SDK con su `<script>` oficial (verificar la URL en la documentación vigente).
- [ ] `firstFrameReady()` cuando se dibuja el primer cuadro; `gameReady()` SOLO cuando el menú está listo para interactuar (nunca durante pantallas de carga).
- [ ] Guardado con `saveData` / `loadData` (el récord personal). Datos como string UTF-16 válido; mantener compatibilidad entre versiones (incluir un campo `version`).
- [ ] Pausar y reanudar (juego y audio) con `onPause` / `onResume`.
- [ ] Verificar disponibilidad de anuncios antes de pedirlos; si no hay, ocultar el botón de continuar.
- [ ] `sendScore` al terminar cada partida.
- [ ] Funciona con cualquier relación de aspecto, con táctil y mouse.
- [ ] Sin llamadas de red externas (salvo el SDK).
- [ ] Contenido apto para todo público.

### CrazyGames

- [ ] Lanzamiento básico: no requiere SDK.
- [ ] Lanzamiento completo (si nos invitan): integrar SDK, avisar inicio/fin de partida, anuncio con premio para continuar, anuncio entre partidas cada 3 derrotas como máximo. **Verificar nombres exactos de funciones en su documentación vigente al implementar.**
- [ ] Preparar portada/miniaturas en los tamaños que pida su portal.

## 7. Cronograma (≈8–9 h)

Día 1:

1. **(1 h) Base:** proyecto Vite + Three.js, escena, cámara responsiva, ruta y cuadrícula en movimiento.
2. **(1,5 h) Núcleo jugable:** pelota, cambio de carril, pool de bloques, generación de patrones, choque, reinicio. *Hito: se puede jugar, aunque se vea feo.*
3. **(1,5 h) Profundidad:** roce al ras, multiplicador, puntaje, curva de dificultad, zigzags (con pruebas de la lógica pura).

Día 2:

4. **(1,5 h) Interfaz y plataforma:** menú, HUD, pantalla de fin, récord, adaptador local, pausa, botón de silencio.
5. **(1,5 h) Sensación:** estela, chispas, sacudida, FOV, color de cuadrícula, choque con cámara lenta, efectos de sonido.
6. **(1 h) Integración y prueba:** adaptador de YouTube, esqueleto del adaptador de CrazyGames, build + ZIP, pruebas en celular real, revisión de rendimiento.
7. **(1 h, OPCIONAL) Pulido:** música, ajuste fino de valores.

**Si el tiempo aprieta, se recorta en este orden:** música → cámara lenta al chocar → montañas → cambio de color de cuadrícula. El núcleo, el roce al ras y el guardado nunca se recortan.

Día siguiente al terminar: subir a CrazyGames (lanzamiento básico) y enviar el formulario de interés de YouTube Playables (o evaluar Playgama).

## 8. Fuera de alcance (NO hacer en esta versión)

Tiendas o monedas, personajes desbloqueables, tablas de récords online, niveles diseñados a mano, más de dos carriles, multijugador, idiomas múltiples (la interfaz usa casi solo números e íconos, por lo que es mayormente independiente del idioma).

## 9. Criterios de aceptación

- Se juega de principio a fin con un toque, en celular (vertical y horizontal) y en computadora.
- El roce al ras se siente claro y gratificante; el multiplicador es visible.
- 60 fps estables en celular de gama media.
- El récord persiste al recargar.
- El juego se pausa al cambiar de pestaña, en todas las plataformas, y al volver no hay saltos.
- Ningún roce se cobra dos veces y nunca se genera un patrón imposible a velocidad máxima.
- Con el adaptador local, el botón de continuar no aparece (o simula el anuncio en modo desarrollo).
- `vite build` genera un paquete con rutas relativas que funciona abriéndolo desde un servidor estático.
