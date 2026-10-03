// Adaptador de YouTube Playables. El SDK (https://www.youtube.com/game_api/v1) se carga
// como primer <script> de la página solo en el build `--mode youtube` (ver vite.config.js).

export function isYouTube() {
  return typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;
}

export function createYouTubeAdapter(yt = globalThis.ytgame) {
  return {
    name: 'youtube',
    async init() {},
    firstFrameReady() {
      yt.game.firstFrameReady();
    },
    gameReady() {
      yt.game.gameReady();
    },
    gameplayStart() {},
    gameplayStop() {},
    async loadData() {
      try {
        return (await yt.game.loadData()) || null;
      } catch {
        return null;
      }
    },
    async saveData(str) {
      try {
        await yt.game.saveData(str);
      } catch {
        // Si falla, se reintenta en el próximo guardado.
      }
    },
    sendScore(n) {
      yt.engagement?.sendScore({ value: Math.floor(n) }).catch?.(() => {});
    },
    // Anuncios: verificar en la documentación vigente de Playables si hay anuncios con
    // premio disponibles para el juego antes de activarlos acá. Mientras tanto, sin anuncios.
    canShowRewarded() {
      return false;
    },
    async showRewarded() {
      return false;
    },
    async showInterstitial() {},
    onPause(cb) {
      yt.system.onPause(cb);
    },
    onResume(cb) {
      yt.system.onResume(cb);
    },
    isAudioEnabled() {
      return yt.system.isAudioEnabled();
    },
    onAudioChange(cb) {
      yt.system.onAudioEnabledChange(cb);
    },
  };
}
