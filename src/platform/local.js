// Adaptador local: localStorage, sin anuncios. Sirve para desarrollo, itch.io y el
// lanzamiento básico de CrazyGames. Con `fakeAds` simula un anuncio con premio.

const KEY = 'zipzapp-save';
const LEGACY_KEY = 'carril-neon-save'; // nombre anterior del juego: se sigue leyendo

export function createLocalAdapter({
  storage = globalThis.localStorage,
  doc = globalThis.document,
  fakeAds = false,
  fakeAdDuration = 1200,
} = {}) {
  return {
    name: 'local',
    async init() {},
    firstFrameReady() {},
    gameReady() {},
    gameplayStart() {},
    gameplayStop() {},
    async loadData() {
      try {
        return storage?.getItem(KEY) ?? storage?.getItem(LEGACY_KEY) ?? null;
      } catch {
        return null;
      }
    },
    async saveData(str) {
      try {
        storage?.setItem(KEY, str);
      } catch {
        // Almacenamiento bloqueado (modo privado, iframe de terceros): se ignora.
      }
    },
    sendScore() {},
    canShowRewarded() {
      return fakeAds;
    },
    async showRewarded() {
      if (!fakeAds) return false;
      await new Promise((r) => setTimeout(r, fakeAdDuration));
      return true;
    },
    async showInterstitial() {},
    onPause(cb) {
      doc?.addEventListener('visibilitychange', () => { if (doc.hidden) cb(); });
    },
    onResume(cb) {
      doc?.addEventListener('visibilitychange', () => { if (!doc.hidden) cb(); });
    },
    isAudioEnabled() {
      return true;
    },
    onAudioChange() {},
  };
}
