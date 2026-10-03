// Formato del guardado. Siempre JSON con un campo `version`, para mantener compatibilidad
// entre versiones del juego (requisito de YouTube Playables).

export const SAVE_VERSION = 1;

export function defaultSave() {
  return { version: SAVE_VERSION, best: 0, muted: false };
}

export function decodeSave(str) {
  const save = defaultSave();
  if (typeof str !== 'string' || str === '') return save;
  try {
    const data = JSON.parse(str);
    if (data && typeof data === 'object') {
      // Versiones futuras: migrar acá según data.version.
      if (Number.isFinite(data.best) && data.best > 0) save.best = Math.floor(data.best);
      if (typeof data.muted === 'boolean') save.muted = data.muted;
    }
  } catch {
    // Dato corrupto: se empieza de cero.
  }
  return save;
}

export function encodeSave(save) {
  return JSON.stringify({ version: SAVE_VERSION, best: save.best, muted: save.muted });
}
