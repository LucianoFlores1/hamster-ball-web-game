import { describe, it, expect } from 'vitest';
import { createLocalAdapter } from '../src/platform/local.js';
import { decodeSave, encodeSave, SAVE_VERSION } from '../src/platform/save.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

function fakeDoc() {
  const listeners = [];
  return {
    hidden: false,
    addEventListener: (_t, cb) => listeners.push(cb),
    set(hidden) {
      this.hidden = hidden;
      listeners.forEach((cb) => cb());
    },
  };
}

describe('adaptador local', () => {
  it('guarda y recupera el récord', async () => {
    const storage = memoryStorage();
    const a = createLocalAdapter({ storage, doc: fakeDoc() });
    expect(await a.loadData()).toBeNull();
    await a.saveData(encodeSave({ best: 1234, muted: true }));
    const b = createLocalAdapter({ storage, doc: fakeDoc() });
    expect(decodeSave(await b.loadData())).toEqual({ version: SAVE_VERSION, best: 1234, muted: true });
  });

  it('recupera el récord guardado con el nombre anterior del juego', async () => {
    const storage = memoryStorage();
    storage.setItem('carril-neon-save', encodeSave({ best: 777, muted: false }));
    const a = createLocalAdapter({ storage, doc: fakeDoc() });
    expect(decodeSave(await a.loadData()).best).toBe(777);
  });

  it('sobrevive a un almacenamiento bloqueado', async () => {
    const storage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    const a = createLocalAdapter({ storage, doc: fakeDoc() });
    await expect(a.saveData('x')).resolves.toBeUndefined();
    expect(await a.loadData()).toBeNull();
  });

  it('sin anuncios: no ofrece continuar', async () => {
    const a = createLocalAdapter({ storage: memoryStorage(), doc: fakeDoc() });
    expect(a.canShowRewarded()).toBe(false);
    expect(await a.showRewarded()).toBe(false);
  });

  it('con anuncios simulados: ofrece continuar y da el premio', async () => {
    const a = createLocalAdapter({ storage: memoryStorage(), doc: fakeDoc(), fakeAds: true, fakeAdDuration: 1 });
    expect(a.canShowRewarded()).toBe(true);
    expect(await a.showRewarded()).toBe(true);
  });

  it('pausa y reanuda al cambiar de pestaña', () => {
    const doc = fakeDoc();
    const a = createLocalAdapter({ storage: memoryStorage(), doc });
    const log = [];
    a.onPause(() => log.push('pausa'));
    a.onResume(() => log.push('sigue'));
    doc.set(true);
    doc.set(false);
    expect(log).toEqual(['pausa', 'sigue']);
  });
});

describe('formato de guardado', () => {
  it('tolera datos vacíos, corruptos o de otra forma', () => {
    for (const s of [null, '', '{', '[]', '"hola"', '{"best":"mucho"}', '{"best":-5}']) {
      expect(decodeSave(s).best).toBe(0);
    }
  });

  it('incluye el campo version', () => {
    expect(JSON.parse(encodeSave({ best: 5, muted: false })).version).toBe(SAVE_VERSION);
  });
});
