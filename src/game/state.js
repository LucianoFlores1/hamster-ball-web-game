// Flujo del juego: menú → jugando ⇄ pausa → muriendo (cámara lenta) → fin → (anuncio) → ...
// Coordina simulación, plataforma, audio e interfaz. El dibujo lo hace `view` (main.js).

import { stepWorld, resetWorld, revive, tap, goToLane } from './world.js';
import { multiplier, multiplierTimeLeft } from './scoring.js';
import { encodeSave } from '../platform/save.js';

export const STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  OVER: 'over',
  AD: 'ad',
};

const LEVEL_CSS = ['#3ff0ff', '#b06bff', '#ff2fd0', '#ff2fd0', '#ff7a59', '#ffc23d'];

export function createGame({ cfg, world, platform, ui, audio, view, save }) {
  let state = STATES.MENU;
  let acc = 0;
  let dyingFor = 0;
  let overAt = 0;
  let clock = 0;
  let usedContinue = false;
  let deaths = 0;
  let lastScore = 0;

  function persist() {
    platform.saveData(encodeSave(save));
  }

  function start() {
    resetWorld(world);
    view.reset();
    usedContinue = false;
    acc = 0;
    state = STATES.PLAYING;
    ui.showPlaying();
    platform.gameplayStart();
  }

  function handleEvents() {
    for (const e of world.events) {
      switch (e.type) {
        case 'switch':
          audio.whoosh();
          break;
        case 'graze':
          audio.graze(e.level);
          view.graze(e);
          ui.graze(e.level, e.bonus, LEVEL_CSS[e.level]);
          break;
        case 'crash':
          audio.crash();
          view.crash();
          state = STATES.DYING;
          dyingFor = 0;
          break;
        default:
          break;
      }
    }
    world.events.length = 0;
  }

  function gameOver() {
    state = STATES.OVER;
    overAt = clock;
    deaths++;
    lastScore = Math.floor(world.score.points);
    const isNewBest = lastScore > save.best;
    if (isNewBest) {
      save.best = lastScore;
      persist();
    }
    platform.sendScore(lastScore);
    platform.gameplayStop();
    ui.showGameOver({
      score: lastScore,
      best: save.best,
      isNewBest,
      canContinue: !usedContinue && platform.canShowRewarded(),
    });
  }

  async function withAd(show) {
    state = STATES.AD;
    ui.showAdWait();
    audio.pause();
    try {
      return await show();
    } finally {
      audio.resume();
    }
  }

  return {
    get state() {
      return state;
    },

    // Toque, clic o barra espaciadora.
    press({ key = false } = {}) {
      audio.unlock();
      if (state === STATES.MENU) start();
      else if (state === STATES.PLAYING) tap(world);
      else if (state === STATES.PAUSED) this.resumeFromPause();
      else if (state === STATES.OVER && key) this.replay();
    },

    lane(l) {
      audio.unlock();
      if (state === STATES.PLAYING) goToLane(world, l);
      else this.press({ key: true });
    },

    async replay() {
      if (state !== STATES.OVER || clock - overAt < cfg.fx.replayLockout) return;
      if (deaths % cfg.ads.interstitialEveryDeaths === 0) {
        await withAd(() => platform.showInterstitial());
      }
      start();
    },

    async continueWithAd() {
      if (state !== STATES.OVER || usedContinue || !platform.canShowRewarded()) return;
      const rewarded = await withAd(() => platform.showRewarded());
      if (rewarded) {
        usedContinue = true;
        revive(world);
        view.revive();
        acc = 0;
        state = STATES.PLAYING;
        ui.showPlaying();
        platform.gameplayStart();
      } else {
        state = STATES.OVER;
        ui.showGameOver({ score: lastScore, best: save.best, isNewBest: false, canContinue: false });
      }
    },

    pause() {
      audio.pause();
      if (state === STATES.PLAYING) {
        state = STATES.PAUSED;
        ui.showPaused();
        platform.gameplayStop();
      }
    },

    // La plataforma volvió (pestaña visible / onResume): el juego sigue en pausa hasta un toque.
    platformResumed() {
      if (state !== STATES.AD) audio.resume();
    },

    resumeFromPause() {
      if (state !== STATES.PAUSED) return;
      audio.resume();
      state = STATES.PLAYING;
      ui.showPlaying();
      platform.gameplayStart();
    },

    toggleMute() {
      save.muted = !save.muted;
      audio.setMuted(save.muted);
      ui.setMuted(save.muted);
      persist();
    },

    // Un cuadro. dt real ya limitado a cfg.maxFrameDt.
    frame(dt) {
      clock += dt;
      let gameDt = dt;

      if (state === STATES.PLAYING) {
        acc += dt;
        while (acc >= cfg.simStep && state === STATES.PLAYING) {
          stepWorld(world, cfg.simStep);
          acc -= cfg.simStep;
          handleEvents();
        }
        const s = world.score;
        ui.updateHud(Math.floor(s.points), s.level, multiplier(s, cfg), multiplierTimeLeft(s, cfg));
      } else if (state === STATES.DYING) {
        gameDt = dt * cfg.fx.slowMoScale;
        dyingFor += dt;
        if (dyingFor >= cfg.fx.slowMoDuration) gameOver();
      } else {
        gameDt = state === STATES.PAUSED || state === STATES.AD ? 0 : dt;
      }

      view.update(dt, gameDt, state);
    },
  };
}
