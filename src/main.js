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
import { LEVEL_COLORS } from './game/palette.js';

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
let beatPulse = 0;
const audio = createAudio();

const ballPos = (z = 0) => [player.ballX(world.lane), 0.5, z];

const view = {
  reset() {
    player.reset(world);
    effects.clear();
    blocks.clearHit();
  },
  start() {
    const [x, y] = ballPos();
    effects.ring(x, 0, LEVEL_COLORS[0], 4, 0.6);
    effects.burst(x, y, 0, LEVEL_COLORS[0], 40, 9, 0.6);
    camRig.punch(6);
  },
  revive() {
    player.reset(world);
    effects.clear();
    blocks.clearHit();
    const [x, y] = ballPos();
    effects.ring(x, 0, LEVEL_COLORS[5], 6, 0.7);
    effects.burst(x, y, 0, LEVEL_COLORS[5], 70, 12, 0.8);
    camRig.punch(8);
  },
  switchLane() {
    camRig.shake(0.04);
  },
  graze(e) {
    const side = e.lane === 0 ? -1 : 1;
    const x = player.ballX(world.lane);
    effects.sparks(x, side, e.level, cfg.fx.sparksPerGraze + e.level * 8);
    effects.ring(x + side * 0.6, 0.4, LEVEL_COLORS[e.level], 1.2 + e.level * 0.3, 0.35);
    player.graze(e.level);
    camRig.shake(cfg.fx.shakeOnGraze + e.level * 0.03);
    camRig.punch(cfg.fx.fovPunch + e.level * 0.6);
  },
  maxLevel() {
    const [x, y] = ballPos();
    effects.ring(x, 0, LEVEL_COLORS[5], 6, 0.7);
    effects.burst(x, y, 0, LEVEL_COLORS[5], 90, 14, 0.9);
    camRig.punch(6);
  },
  newBest() {
    const [x, y] = ballPos();
    effects.burst(x, y + 1, -2, LEVEL_COLORS[5], 80, 11, 1.1, 4);
    effects.burst(x, y + 1, -2, LEVEL_COLORS[2], 40, 9, 1.1, 4);
  },
  crash(blockId) {
    const [x, y] = ballPos();
    const level = world.score.level;
    effects.shatter(x, level);
    effects.burst(x, y, 0, LEVEL_COLORS[level], 90, 13, 0.9, 9);
    effects.ring(x, 0, LEVEL_COLORS[3], 7, 0.7);
    blocks.markHit(blockId);
    player.hide();
    camRig.shake(1);
    camRig.punch(-6);
  },
  beatPulse() {
    return beatPulse;
  },
  update(dt, gameDt, state) {
    time += dt;
    // pulso de la música: 1 en cada bombo, cae rápido
    const beat = audio.beat();
    beatPulse = Math.exp(-(beat - Math.floor(beat)) * 6);

    const { startSpeed, maxSpeed } = cfg.difficulty;
    const menu = state === STATES.MENU;
    if (menu) attractDistance += startSpeed * 0.6 * dt;
    const distance = menu ? attractDistance : world.distance;
    const speedFrac = menu ? 0 : (world.speed - startSpeed) / (maxSpeed - startSpeed);
    const playing = state === STATES.PLAYING;
    const level = playing ? world.score.level : 0;

    sceneCtl.setLevel(level);
    sceneCtl.update(distance, dt, time, beatPulse);
    blocks.update(world.blocks, gameDt, beatPulse);
    if (menu) {
      player.showIdle();
      player.idle(dt, time, beatPulse);
    } else if (playing) {
      player.update(world, gameDt, time, beatPulse);
    }
    effects.setSpeedLines(playing ? Math.min(1, 0.15 + speedFrac * 0.6 + level * 0.06) : 0);
    effects.update(gameDt, menu ? startSpeed * 0.6 : playing ? world.speed : 0);
    const camMode = menu ? 'menu' : state === STATES.DYING || state === STATES.OVER ? 'dead' : 'play';
    camRig.update(state === STATES.PAUSED ? 0 : dt, speedFrac, menu ? 0 : player.ballX(world.lane), camMode);
    renderer.render(sceneCtl.scene, camRig.camera);
  },
};

// ---------- arranque ----------
const ui = createUI();

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

  game.showMenu();
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
    audio.click();
    game.replay();
  });
  ui.el.btnContinue.addEventListener('click', () => {
    audio.unlock();
    audio.click();
    game.continueWithAd();
  });
  ui.el.btnMute.addEventListener('click', () => {
    audio.unlock();
    game.toggleMute();
    audio.click();
  });
}

boot();
