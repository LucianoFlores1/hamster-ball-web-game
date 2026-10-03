import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createSpawner, nextBlock, BLOCK_DEPTH } from '../src/game/obstacles.js';
import { speedAt } from '../src/game/difficulty.js';
import { seeded } from './helpers.js';

describe('patrones: siempre hay camino, medido en tiempo (regla 4)', () => {
  it('a velocidad máxima, bloques consecutivos de carriles distintos están separados ≥ 0,4 s', () => {
    const vmax = CONFIG.difficulty.maxSpeed;
    let zigzags = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const sp = createSpawner(seeded(seed));
      let prev = nextBlock(sp, 0, speedAt(0, CONFIG), CONFIG);
      let t = 0;
      let alternating = 0;
      for (let i = 0; i < 2000; i++) {
        const cur = nextBlock(sp, t, speedAt(t, CONFIG), CONFIG);
        // tiempo libre entre el fondo del anterior y el frente del actual, a velocidad máxima
        const freeTime = (cur.dist - BLOCK_DEPTH) / vmax;
        if (cur.lane !== prev.lane) {
          expect(freeTime).toBeGreaterThanOrEqual(CONFIG.minSwitchGap - 1e-9);
          alternating++;
          if (alternating >= 4) { zigzags++; alternating = 0; }
        } else {
          expect(freeTime).toBeGreaterThanOrEqual(CONFIG.minSameLaneGap - 1e-9);
          alternating = 0;
        }
        t += cur.dist / speedAt(t, CONFIG);
        prev = cur;
      }
    }
    expect(zigzags).toBeGreaterThan(0);
  });

  it('nunca pone dos bloques a la misma altura', () => {
    const sp = createSpawner(seeded(7));
    nextBlock(sp, 0, 20, CONFIG);
    for (let i = 0; i < 1000; i++) expect(nextBlock(sp, i * 0.5, 30, CONFIG).dist).toBeGreaterThan(BLOCK_DEPTH);
  });
});
