import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createWorld, stepWorld, tap, revive } from '../src/game/world.js';
import { seeded } from './helpers.js';

const DT = CONFIG.simStep;

function nearestInLane(world, lane) {
  let best = null;
  for (const b of world.blocks) {
    if (b.active && b.lane === lane && b.z > 0 && (!best || b.z < best.z)) best = b;
  }
  return best;
}

// Un jugador automático simple: cambia de carril cuando se le acerca un bloque.
function bot(world, reaction) {
  const { lane } = world;
  if (lane.p !== lane.target) return;
  const b = nearestInLane(world, lane.logical);
  if (b && b.z / world.speed < reaction) tap(world);
}

function run(world, seconds, reaction) {
  const events = [];
  for (let t = 0; t < seconds && world.alive; t += DT) {
    bot(world, reaction);
    stepWorld(world, DT);
    events.push(...world.events);
    world.events.length = 0;
  }
  return events;
}

describe('partida simulada', () => {
  it('un jugador que reacciona a tiempo sobrevive 5 minutos (siempre hay camino)', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const world = createWorld(CONFIG, seeded(seed));
      run(world, 300, 0.3);
      expect(world.alive, `semilla ${seed}`).toBe(true);
      expect(world.speed).toBe(CONFIG.difficulty.maxSpeed);
    }
  });

  it('un jugador que espera al último momento roza, sube el multiplicador y nunca cobra dos veces', () => {
    const world = createWorld(CONFIG, seeded(3));
    const events = run(world, 60, 0.15);
    const grazes = events.filter((e) => e.type === 'graze');
    expect(grazes.length).toBeGreaterThan(10);
    const ids = grazes.map((e) => `${e.blockId}`);
    // un mismo bloque del pool se recicla, pero nunca se cobra dos veces seguidas
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(Math.max(...grazes.map((e) => e.level))).toBe(CONFIG.multiplier.levels.length - 1);
  });

  it('sin tocar, la partida termina con un choque', () => {
    const world = createWorld(CONFIG, seeded(1));
    const events = run(world, 30, -1);
    expect(world.alive).toBe(false);
    expect(events.at(-1).type).toBe('crash');
  });

  it('continuar elimina los bloques cercanos y da invulnerabilidad', () => {
    const world = createWorld(CONFIG, seeded(1));
    run(world, 30, -1);
    revive(world);
    expect(world.alive).toBe(true);
    for (const b of world.blocks) {
      if (b.active) expect(b.z).toBeGreaterThanOrEqual(CONFIG.revive.clearAhead * world.speed);
    }
    run(world, CONFIG.revive.invulnerability - 0.1, -1);
    expect(world.alive).toBe(true);
  });

  it('el primer bloque llega a los ~1,6 s', () => {
    const world = createWorld(CONFIG, seeded(2));
    stepWorld(world, DT);
    const first = Math.min(...world.blocks.filter((b) => b.active).map((b) => b.z));
    expect(first / world.speed).toBeCloseTo(CONFIG.firstBlockDelay, 1);
  });
});
