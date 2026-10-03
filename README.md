# Carril Neón

Juego web arcade de un toque, estética synthwave: una pelota avanza por dos carriles y hay
que esquivar bloques. Cambiar de carril al último momento (roce al ras) sube el multiplicador
hasta x8.

- Diseño: [`docs/superpowers/specs/2026-09-29-carril-neon-design.md`](docs/superpowers/specs/2026-09-29-carril-neon-design.md)
- Plan y estado: [`docs/superpowers/plans/2026-10-03-carril-neon-plan.md`](docs/superpowers/plans/2026-10-03-carril-neon-plan.md)

## Comandos

```bash
npm install
npm run dev               # servidor de desarrollo, accesible desde el celular en la misma WiFi
npm test                  # pruebas de la lógica pura (Vitest)

npm run build             # dist/ — sin SDKs (itch.io, CrazyGames lanzamiento básico)
npm run zip               # dist/ → carril-neon.zip

npm run build:youtube     # dist-youtube/ con el SDK de YouTube Playables
node scripts/zip.js dist-youtube

npm run build:crazygames  # dist-crazygames/ con el SDK de CrazyGames v3
node scripts/zip.js dist-crazygames
```

En desarrollo, `?fakeads` en la URL simula el anuncio con premio (botón de continuar).

## Controles

Toque, clic, barra espaciadora o Enter: cambiar de carril. Flechas o A/D: ir a un carril.
Esc o P: pausa. M: silencio.

## Ajustes

Todos los valores del juego están en [`src/config.js`](src/config.js).

## Estructura

```
src/
  main.js            arranque, renderer, entrada, bucle
  config.js          valores ajustables
  game/
    world.js         simulación de la partida (lógica pura)
    collision.js     carril lógico, choque, roce (lógica pura)
    scoring.js       puntaje y multiplicador (lógica pura)
    difficulty.js    curva de dificultad (lógica pura)
    obstacles.js     patrones y pool de bloques (lógica pura)
    state.js         flujo: menú, jugando, pausa, fin, anuncios
    scene.js         cielo, sol, montañas, cuadrícula, ruta
    camera.js        cámara responsiva, FOV, sacudida
    player.js        pelota y estela
    blocksView.js    bloques
    effects.js       chispas y fragmentos
  audio/sfx.js       sonidos y música con Web Audio
  ui/                HUD y pantallas (HTML/CSS)
  platform/          adaptadores: local, youtube, crazygames
tests/               Vitest
```
