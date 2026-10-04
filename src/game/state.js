// Flujo del juego: menú → jugando ⇄ pausa → muriendo (cámara lenta) → fin → (anuncio) → ...
// Coordina simulación, plataforma, audio e interfaz. El dibujo lo hace `view` (main.js).

import { stepWorld, resetWorld, revive, tap, goToLane } from './world.js';
import { multiplier, multiplierTimeLeft } from './scoring.js';
import { speedAt } from './difficulty.js';
import { encodeSave } from '../platform/save.js';
import { LEVEL_HEX } from './palette.js';

export const STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  OVER: 'over',
  AD: 'ad',
};

export function createGame({ cfg, world, platform, ui, audio, view, save }) {
  let state = STATES.MENU;
  let acc = 0;
  let dyingFor = 0;
  let overAt = 0;
  let clock = 0;
  let usedContinue = false;
  let deaths = 0;
  let lastScore = 0;
  let slowFor = 0; // micro cámara lenta tras un roce (segundos reales restantes)
  let bestAtStart = 0;
  let bestAnnounced = false;
  let maxAnnounced = false;

  function persist() {
    platform.saveData(encodeSave(save));
  }

  function vibrate(pattern) {
    if (!cfg.fx.haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // no soportado
    }
  }

  function start() {
    resetWorld(world);
    view.reset();
    view.start();
    usedContinue = false;
    acc = 0;
    slowFor = 0;
    bestAtStart = save.best;
    bestAnnounced = false;
    maxAnnounced = false;
    state = STATES.PLAYING;
    ui.showPlaying({ fresh: true });
    audio.setMode('play');
    audio.start();
    platform.gameplayStart();
  }

  function handleEvents() {
    for (const e of world.events) {
      switch (e.type) {
        case 'switch':
          audio.whoosh(e.lane);
          view.switchLane(e.lane);
          break;
        case 'graze': {
          const side = e.lane === 0 ? -1 : 1;
          audio.graze(e.level, e.combo, side);
          view.graze(e);
          ui.graze(e.level, e.bonus, LEVEL_HEX[e.level]);
          vibrate(10 + e.level * 4);
          slowFor = cfg.fx.grazeSlowDuration;
          const top = cfg.multiplier.levels.length - 1;
          if (e.level === top && !maxAnnounced) {
            maxAnnounced = true;
            ui.banner(`MAX x${cfg.multiplier.levels[top]}`, LEVEL_HEX[top]);
            audio.maxLevel();
            view.maxLevel();
          } else if (e.level > 0 && e.level < top) {
            ui.banner(`x${cfg.multiplier.levels[e.level]}`, LEVEL_HEX[e.level]);
          }
          break;
        }
        case 'multReset':
          audio.multLost();
          ui.multLost();
          maxAnnounced = false;
          break;
        case 'crash':
          audio.crash();
          audio.setMode('over');
          view.crash(e.blockId);
          ui.crash();
          vibrate([50, 30, 90]);
          state = STATES.DYING;
          dyingFor = 0;
          break;
        default:
          break;
      }
    }
    world.events.length = 0;
  }

  // Récord superado en plena partida: se festeja una sola vez.
  function checkLiveBest() {
    if (bestAnnounced || bestAtStart <= 0 || world.score.points <= bestAtStart) return;
    bestAnnounced = true;
    ui.banner('★ NEW BEST ★', '#ffc23d', true);
    audio.newBest();
    view.newBest();
    vibrate([20, 40, 20]);
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
    audio.gameOver();
    ui.showGameOver({
      score: lastScore,
      best: save.best,
      isNewBest,
      canContinue: !usedContinue && platform.canShowRewarded(),
    }, {
      onTick: (p) => audio.tick(p),
      onDone: () => {
        if (!isNewBest || state !== STATES.OVER) return;
        audio.newBest();
        view.newBest();
      },
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
        ui.showPlaying({ fresh: true });
        ui.flash('#ffc23d', 0.5);
        audio.setMode('play');
        audio.revive();
        platform.gameplayStart();
      } else {
        state = STATES.OVER;
        ui.showGameOverStatic({ score: lastScore, best: save.best });
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
      ui.setMuted(save.muted, true);
      persist();
    },

    // Un cuadro. dt real ya limitado a cfg.maxFrameDt.
    frame(dt) {
      clock += dt;
      let gameDt = dt;

      if (state === STATES.PLAYING) {
        // micro cámara lenta tras un roce: se siente el "¡uf!"
        if (slowFor > 0) {
          slowFor -= dt;
          gameDt = dt * cfg.fx.grazeSlowScale;
        }
        acc += gameDt;
        while (acc >= cfg.simStep && state === STATES.PLAYING) {
          stepWorld(world, cfg.simStep);
          acc -= cfg.simStep;
          handleEvents();
        }
        checkLiveBest();
        const s = world.score;
        const { startSpeed, maxSpeed } = cfg.difficulty;
        audio.setIntensity(s.level, (speedAt(world.time, cfg) - startSpeed) / (maxSpeed - startSpeed));
        ui.updateHud(
          Math.floor(s.points), s.level, multiplier(s, cfg), multiplierTimeLeft(s, cfg),
          view.beatPulse(), LEVEL_HEX[s.level],
        );
      } else if (state === STATES.DYING) {
        dyingFor += dt;
        // primero un congelamiento corto, después cámara lenta
        gameDt = dyingFor < cfg.fx.hitStop ? 0 : dt * cfg.fx.slowMoScale;
        if (dyingFor >= cfg.fx.hitStop + cfg.fx.slowMoDuration) gameOver();
      } else {
        gameDt = state === STATES.PAUSED || state === STATES.AD ? 0 : dt;
      }

      view.update(dt, gameDt, state);
    },

    // Volver a mostrar el menú (arranque).
    showMenu() {
      state = STATES.MENU;
      audio.setMode('menu');
      ui.showMenu(save.best);
    },
  };
}
