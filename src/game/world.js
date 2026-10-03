// Simulación de una partida: pelota, bloques, puntaje y dificultad. Lógica pura (sin Three.js),
// para poder probarla y para que el render solo dibuje lo que hay acá.

import {
  createLaneState, toggleLane, stepLane, findGraze, findCollision,
} from './collision.js';
import { createScore, registerGraze, addDistance, tickMultiplier } from './scoring.js';
import { speedAt } from './difficulty.js';
import {
  BLOCK_DEPTH, createSpawner, nextBlock, createBlockPool, acquireBlock,
} from './obstacles.js';

const BEHIND_LIMIT = -12; // los bloques que quedaron atrás de la cámara se reciclan

export function createWorld(cfg, rng = Math.random) {
  const world = {
    cfg,
    rng,
    blocks: createBlockPool(48),
    events: [],
    pendingTaps: 0,
  };
  resetWorld(world);
  return world;
}

export function resetWorld(world) {
  const { cfg } = world;
  world.time = 0;
  world.distance = 0;
  world.speed = speedAt(0, cfg);
  world.lane = createLaneState(0);
  world.score = createScore();
  world.spawner = createSpawner(world.rng);
  // Negativo: el primer bloque aparece ya cerca, para llegar a los `firstBlockDelay` segundos.
  world.nextSpawnIn = cfg.firstBlockDelay * world.speed - cfg.spawnDistance;
  world.pendingLane = nextBlock(world.spawner, 0, world.speed, cfg).lane;
  world.invulnerable = 0;
  world.alive = true;
  world.events.length = 0;
  world.pendingTaps = 0;
  for (const b of world.blocks) b.active = false;
}

export function tap(world) {
  if (world.alive) world.pendingTaps++;
}

// Para teclas direccionales: ir a un carril concreto.
export function goToLane(world, lane) {
  if (world.alive && world.lane.target !== lane) world.pendingTaps++;
}

function processTap(world) {
  const { cfg, lane } = world;
  const leaving = toggleLane(lane);
  world.events.push({ type: 'switch', lane: lane.target });
  const g = findGraze(lane, leaving, world.blocks, world.speed, cfg);
  if (g) {
    g.grazed = true;
    const bonus = registerGraze(world.score, cfg);
    world.events.push({ type: 'graze', level: world.score.level, bonus, lane: leaving, blockId: g.id });
  }
}

function spawn(world) {
  const { cfg } = world;
  // `nextSpawnIn` es lo que le falta al bloque pendiente para llegar a la línea de aparición;
  // si es negativo, ya la pasó y se lo coloca más cerca, respetando la distancia exacta.
  while (world.nextSpawnIn <= 0) {
    const b = acquireBlock(world.blocks);
    if (b) { // siempre hay lugar con el tamaño del pool
      b.active = true;
      b.grazed = false;
      b.lane = world.pendingLane;
      b.z = cfg.spawnDistance + world.nextSpawnIn;
    }
    const next = nextBlock(world.spawner, world.time, world.speed, cfg);
    world.pendingLane = next.lane;
    world.nextSpawnIn += next.dist;
  }
}

// Avanza la simulación `dt` segundos (ya escalados por la cámara lenta).
export function stepWorld(world, dt) {
  if (!world.alive) return;
  const { cfg } = world;

  while (world.pendingTaps > 0) {
    world.pendingTaps--;
    processTap(world);
  }

  world.speed = speedAt(world.time, cfg);
  const dz = world.speed * dt;

  stepLane(world.lane, dt, cfg);

  for (const b of world.blocks) {
    if (!b.active) continue;
    b.z -= dz;
    if (b.z + BLOCK_DEPTH < BEHIND_LIMIT) b.active = false;
  }

  world.distance += dz;
  addDistance(world.score, dz, cfg);
  if (tickMultiplier(world.score, dt, cfg)) world.events.push({ type: 'multReset' });

  world.nextSpawnIn -= dz;
  spawn(world);

  if (world.invulnerable > 0) world.invulnerable = Math.max(0, world.invulnerable - dt);
  else {
    const hit = findCollision(world.lane, world.blocks, BLOCK_DEPTH);
    if (hit) {
      world.alive = false;
      world.events.push({ type: 'crash', blockId: hit.id });
    }
  }

  world.time += dt;
}

// Continuar tras el anuncio: se eliminan los bloques cercanos y hay invulnerabilidad.
export function revive(world) {
  const { cfg } = world;
  for (const b of world.blocks) {
    if (b.active && b.z < cfg.revive.clearAhead * world.speed) b.active = false;
  }
  world.invulnerable = cfg.revive.invulnerability;
  world.alive = true;
  world.pendingTaps = 0;
  world.score.level = 0;
  world.score.sinceGraze = 0;
}

export function activeBlocks(world) {
  return world.blocks.filter((b) => b.active);
}
