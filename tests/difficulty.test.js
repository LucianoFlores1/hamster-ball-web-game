import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { speedAt, gapAt, zigzagChanceAt } from '../src/game/difficulty.js';

describe('curva de dificultad', () => {
  it('la velocidad sube de forma monótona y se queda en el máximo', () => {
    let prev = 0;
    for (let t = 0; t <= 300; t += 1) {
      const v = speedAt(t, CONFIG);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(CONFIG.difficulty.maxSpeed);
      prev = v;
    }
    expect(speedAt(0, CONFIG)).toBe(CONFIG.difficulty.startSpeed);
    expect(speedAt(1000, CONFIG)).toBe(CONFIG.difficulty.maxSpeed);
  });

  it('la separación baja de forma monótona hasta el mínimo', () => {
    let prev = Infinity;
    for (let t = 0; t <= 300; t += 1) {
      const g = gapAt(t, CONFIG);
      expect(g).toBeLessThanOrEqual(prev);
      expect(g).toBeGreaterThanOrEqual(CONFIG.difficulty.minGap);
      prev = g;
    }
  });

  it('la separación inicial es claramente menor al reinicio del multiplicador (regla 3)', () => {
    expect(gapAt(0, CONFIG)).toBeLessThan(CONFIG.multiplier.resetAfter / 2);
  });

  it('no hay zigzags al principio', () => {
    expect(zigzagChanceAt(0, CONFIG)).toBe(0);
    expect(zigzagChanceAt(60, CONFIG)).toBeGreaterThan(0);
  });
});
