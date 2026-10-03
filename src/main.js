// Arranque: renderer, elección de adaptador de plataforma, entrada y bucle principal.

import { WebGLRenderer } from 'three';
import { CONFIG } from './config.js';
import { createWorld } from './game/world.js';
import { createWorldScene } from './game/scene.js';
import { createCameraRig } from './game/camera.js';
import { createPlayerView } from './game/player.js';
import { createBlocksView } from './game/blocksView.js';
import { createEffects } from './game/effects.js';
import { createGame, STATES } from './game/state.js';
import { createAudio } from './audio/sfx.js';
import { createUI } from './ui/ui.js';
import { createPlatform } from './platform/index.js';
import { decodeSave } from './platform/save.js';

const cfg = CONFIG;
const app = document.getElementById('app');
const canvas = document.getElementById('game');
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- render ----------
const renderer = new WebGLRenderer({
  canvas,
  antialias: !isTouch || devicePixelRatio < 2,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));

const world = createWorld(cfg);
const sceneCtl = createWorldScene();
const camRig = createCameraRig();
const player = createPlayerView();
const blocks = createBlocksView(world.blocks.length);
const effects = createEffects();
sceneCtl.scene.add(player.group, blocks.group, effects.group);
player.reset(world);

function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h, false);
  camRig.resize(w, h);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

let attractDistance = 0; // desplazamiento del escenario en el menú
let time = 0;

const view = {
  reset() {
    player.reset(world);
    effects.clear();
  },
  revive() {
    player.reset(world);
    effects.clear();
  },
  graze(e) {
    const side = e.lane === 0 ? -1 : 1;
    effects.sparks(player.ballX(world.lane), side, e.level, cfg.fx.sparksPerGraze + e.level * 6);
    camRig.shake(cfg.fx.shakeOnGraze + e.level * 0.03);
  },
  crash() {
    effects.shatter(player.ballX(world.lane));
    player.hide();
    camRig.shake(0.9);
  },
  update(dt, gameDt, state) {
    time += dt;
    const { startSpeed, maxSpeed } = cfg.difficulty;
    if (state === STATES.MENU) attractDistance += startSpeed * 0.6 * dt;
    const distance = state === STATES.MENU ? attractDistance : world.distance;
    const speedFrac = state === STATES.MENU ? 0 : (world.speed - startSpeed) / (maxSpeed - startSpeed);

    sceneCtl.setLevel(state === STATES.PLAYING ? world.score.level : 0);
    sceneCtl.update(distance, dt, time);
    blocks.update(world.blocks, dt);
    if (state === STATES.PLAYING) player.update(world, gameDt, time);
    effects.update(gameDt);
    camRig.update(gameDt, speedFrac, player.ballX(world.lane));
    renderer.render(sceneCtl.scene, camRig.camera);
  },
};

// ---------- arranque ----------
const ui = createUI();
const audio = createAudio();

async function boot() {
  const platform = createPlatform();
  await platform.init();

  // primer cuadro lo antes posible
  view.update(0, 0, STATES.MENU);
  platform.firstFrameReady();

  const save = decodeSave(await platform.loadData());
  audio.setMuted(save.muted);
  ui.setMuted(save.muted);
  audio.setPlatformEnabled(platform.isAudioEnabled());
  platform.onAudioChange((on) => audio.setPlatformEnabled(on));

  const game = createGame({ cfg, world, platform, ui, audio, view, save });
  platform.onPause(() => game.pause());
  platform.onResume(() => game.platformResumed());

  bindInput(game);
  if (import.meta.env.DEV) window.__carril = { world, game, platform };

  ui.showMenu(save.best);
  platform.gameReady();

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(Math.max(0, (now - last) / 1000), cfg.maxFrameDt);
    last = now;
    game.frame(dt);
  }
  requestAnimationFrame(loop);
}

function bindInput(game) {
  app.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    game.press();
  });
  app.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault();
        game.press({ key: true });
        break;
      case 'ArrowLeft':
      case 'KeyA':
        game.lane(0);
        break;
      case 'ArrowRight':
      case 'KeyD':
        game.lane(1);
        break;
      case 'Escape':
      case 'KeyP':
        if (game.state === STATES.PLAYING) game.pause();
        else if (game.state === STATES.PAUSED) game.resumeFromPause();
        break;
      case 'KeyM':
        game.toggleMute();
        break;
      default:
        break;
    }
  });

  ui.el.btnReplay.addEventListener('click', () => {
    audio.unlock();
    game.replay();
  });
  ui.el.btnContinue.addEventListener('click', () => {
    audio.unlock();
    game.continueWithAd();
  });
  ui.el.btnMute.addEventListener('click', () => {
    audio.unlock();
    game.toggleMute();
  });
}

boot();
