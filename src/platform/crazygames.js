// Adaptador de CrazyGames (SDK HTML5 v3). Para el lanzamiento básico no hace falta: el
// SDK solo se carga en el build `--mode crazygames` (ver vite.config.js).
// Nombres verificados contra las definiciones de tipos del SDK v3; revisar la
// documentación vigente de CrazyGames antes del lanzamiento completo.

const KEY = 'carril-neon-save';

export function isCrazyGames() {
  return typeof window !== 'undefined' && !!window.CrazyGames?.SDK;
}

export function createCrazyGamesAdapter({ sdk = globalThis.CrazyGames?.SDK, doc = globalThis.document } = {}) {
  let ready = false;
  let adPlaying = false;
  const pauseCbs = [];
  const resumeCbs = [];

  function requestAd(type) {
    return new Promise((resolve) => {
      sdk.ad.requestAd(type, {
        adStarted: () => {
          adPlaying = true;
          pauseCbs.forEach((cb) => cb());
        },
        adFinished: () => {
          adPlaying = false;
          resumeCbs.forEach((cb) => cb());
          resolve(true);
        },
        adError: () => {
          if (adPlaying) resumeCbs.forEach((cb) => cb());
          adPlaying = false;
          resolve(false);
        },
      });
    });
  }

  return {
    name: 'crazygames',
    async init() {
      try {
        await sdk.init();
        ready = true;
      } catch {
        ready = false;
      }
    },
    firstFrameReady() {},
    gameReady() {
      if (ready) sdk.game.loadingStop?.();
    },
    gameplayStart() {
      if (ready) sdk.game.gameplayStart();
    },
    gameplayStop() {
      if (ready) sdk.game.gameplayStop();
    },
    async loadData() {
      try {
        return ready ? sdk.data.getItem(KEY) : null;
      } catch {
        return null;
      }
    },
    async saveData(str) {
      try {
        if (ready) sdk.data.setItem(KEY, str);
      } catch {
        // ignorar
      }
    },
    sendScore() {},
    canShowRewarded() {
      return ready;
    },
    async showRewarded() {
      return ready ? requestAd('rewarded') : false;
    },
    async showInterstitial() {
      if (ready) await requestAd('midgame');
    },
    onPause(cb) {
      pauseCbs.push(cb);
      doc?.addEventListener('visibilitychange', () => { if (doc.hidden) cb(); });
    },
    onResume(cb) {
      resumeCbs.push(cb);
      doc?.addEventListener('visibilitychange', () => { if (!doc.hidden && !adPlaying) cb(); });
    },
    isAudioEnabled() {
      return !(ready && sdk.game.settings?.muteAudio);
    },
    onAudioChange(cb) {
      if (ready) sdk.game.addSettingsChangeListener(() => cb(!sdk.game.settings.muteAudio));
    },
  };
}
