import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  createLaneState, toggleLane, stepLane, occupiesLane, findGraze, findCollision, timeToLogicalSwitch,
} from '../src/game/collision.js';
import { block } from './helpers.js';

const SPEED = 20;
const DEPTH = 1.2;

function advance(ls, seconds, step = 0.001) {
  for (let t = 0; t < seconds - 1e-9; t += step) stepLane(ls, step, CONFIG);
}

describe('carril lógico (regla 1)', () => {
  it('cambia al 50 % de la animación (0,075 s)', () => {
    const ls = createLaneState(0);
    toggleLane(ls);
    advance(ls, 0.07);
    expect(ls.logical).toBe(0);
    advance(ls, 0.01);
    expect(ls.logical).toBe(1);
    advance(ls, 0.1);
    expect(ls.p).toBe(1);
  });

  it('un bloque del carril de origen que llega antes del cambio lógico es choque', () => {
    const ls = createLaneState(0);
    toggleLane(ls);
    advance(ls, 0.05);
    expect(findCollision(ls, [block(0, -0.1)], DEPTH)).not.toBeNull();
  });

  it('pasado el cambio lógico, el carril de origen ya no choca', () => {
    const ls = createLaneState(0);
    toggleLane(ls);
    advance(ls, 0.08);
    expect(findCollision(ls, [block(0, -0.1)], DEPTH)).toBeNull();
  });

  it('el carril de destino choca desde el toque hasta terminar el cambio (regla 2)', () => {
    const ls = createLaneState(0);
    toggleLane(ls);
    expect(occupiesLane(ls, 1)).toBe(true);
    advance(ls, 0.02);
    expect(findCollision(ls, [block(1, -0.1)], DEPTH)).not.toBeNull();
  });

  it('volver a tocar a mitad de camino invierte el cambio', () => {
    const ls = createLaneState(0);
    toggleLane(ls);
    advance(ls, 0.1); // lógico ya en 1
    toggleLane(ls);
    expect(ls.logical).toBe(1);
    expect(timeToLogicalSwitch(ls, CONFIG)).toBeGreaterThan(0);
    advance(ls, 0.2);
    expect(ls.logical).toBe(0);
    expect(ls.p).toBe(0);
  });
});

describe('roce al ras (regla 2)', () => {
  it('cuenta con el bloque del carril que se deja entre 0,075 s y 0,25 s', () => {
    for (const tti of [0.08, 0.15, 0.24]) {
      const ls = createLaneState(0);
      const leaving = toggleLane(ls);
      const b = block(0, tti * SPEED);
      expect(findGraze(ls, leaving, [b], SPEED, CONFIG)).toBe(b);
    }
  });

  it('no cuenta si el bloque está lejos, demasiado cerca o en el otro carril', () => {
    for (const [lane, tti] of [[0, 0.3], [0, 0.05], [1, 0.15]]) {
      const ls = createLaneState(0);
      const leaving = toggleLane(ls);
      expect(findGraze(ls, leaving, [block(lane, tti * SPEED)], SPEED, CONFIG)).toBeNull();
    }
  });

  it('un bloque ya rozado no se vuelve a cobrar', () => {
    const ls = createLaneState(0);
    const leaving = toggleLane(ls);
    expect(findGraze(ls, leaving, [block(0, 3, { grazed: true })], SPEED, CONFIG)).toBeNull();
  });

  it('no se puede rozar un carril en el que la pelota no estaba (amague)', () => {
    const ls = createLaneState(0);
    toggleLane(ls); // va hacia 1
    advance(ls, 0.01);
    const leaving = toggleLane(ls); // vuelve: "deja" el 1, pero nunca estuvo
    expect(findGraze(ls, leaving, [block(1, 0.15 * SPEED)], SPEED, CONFIG)).toBeNull();
  });
});
