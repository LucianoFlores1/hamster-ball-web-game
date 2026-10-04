import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  createScore, multiplier, registerGraze, tickMultiplier, addDistance,
} from '../src/game/scoring.js';

describe('multiplicador', () => {
  it('sube x1 → x2 → x3 → x4 → x6 → x8 y se queda en el tope', () => {
    const s = createScore();
    const seen = [multiplier(s, CONFIG)];
    for (let i = 0; i < 7; i++) {
      registerGraze(s, CONFIG);
      seen.push(multiplier(s, CONFIG));
    }
    expect(seen).toEqual([1, 2, 3, 4, 6, 8, 8, 8]);
  });

  it('vuelve a x1 tras 3 s sin roces', () => {
    const s = createScore();
    registerGraze(s, CONFIG);
    registerGraze(s, CONFIG);
    expect(tickMultiplier(s, 2.9, CONFIG)).toBe(false);
    expect(multiplier(s, CONFIG)).toBe(3);
    expect(tickMultiplier(s, 0.2, CONFIG)).toBe(true);
    expect(multiplier(s, CONFIG)).toBe(1);
  });

  it('cuenta los roces seguidos y los reinicia al perder el multiplicador', () => {
    const s = createScore();
    for (let i = 0; i < 8; i++) registerGraze(s, CONFIG);
    expect(s.combo).toBe(8);
    tickMultiplier(s, 3, CONFIG);
    expect(s.combo).toBe(0);
    expect(s.grazes).toBe(8);
  });

  it('un roce reinicia el reloj de 3 s', () => {
    const s = createScore();
    registerGraze(s, CONFIG);
    tickMultiplier(s, 2.5, CONFIG);
    registerGraze(s, CONFIG);
    tickMultiplier(s, 2.5, CONFIG);
    expect(multiplier(s, CONFIG)).toBe(3);
  });
});

describe('puntaje', () => {
  it('distancia × multiplicador, más bonus por roce con el multiplicador nuevo', () => {
    const s = createScore();
    addDistance(s, 100, CONFIG);
    expect(s.points).toBeCloseTo(100 * CONFIG.scoring.pointsPerUnit);
    const bonus = registerGraze(s, CONFIG);
    expect(bonus).toBe(CONFIG.graze.bonus * 2);
    const before = s.points;
    addDistance(s, 100, CONFIG);
    expect(s.points - before).toBeCloseTo(100 * CONFIG.scoring.pointsPerUnit * 2);
  });
});
