// Elige el adaptador de plataforma según el entorno. El juego solo habla con esta interfaz.

import { createLocalAdapter } from './local.js';
import { createYouTubeAdapter, isYouTube } from './youtube.js';
import { createCrazyGamesAdapter, isCrazyGames } from './crazygames.js';

export function createPlatform() {
  if (isYouTube()) return createYouTubeAdapter();
  if (isCrazyGames()) return createCrazyGamesAdapter();
  // En desarrollo, `?fakeads` simula el anuncio con premio.
  const fakeAds = import.meta.env.DEV && new URLSearchParams(location.search).has('fakeads');
  return createLocalAdapter({ fakeAds });
}
