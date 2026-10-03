// Generación de patrones y pool de bloques. Lógica pura.
//
// Toda separación se decide en segundos (regla 3) y se convierte a distancia al generar.
// La distancia mínima entre bloques consecutivos se calcula a la VELOCIDAD MÁXIMA (regla 4),
// así el margen en tiempo nunca baja del mínimo aunque el juego acelere después.

import { gapAt, zigzagChanceAt } from './difficulty.js';

export const BLOCK_DEPTH = 1.2;

export function createSpawner(rng) {
  return { rng, queue: [], prevLane: -1 };
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Llena la cola con el próximo patrón: lista de { lane, gap } (gap en segundos desde el bloque anterior).
function enqueuePattern(sp, t, cfg) {
  const { rng } = sp;
  const d = cfg.difficulty;
  const base = gapAt(t, cfg);
  const last = sp.prevLane < 0 ? randInt(rng, 0, 1) : sp.prevLane;

  if (rng() < zigzagChanceAt(t, cfg)) {
    // Zigzag: bloques alternados, separación corta y regular.
    const n = randInt(rng, d.zigzagLength[0], d.zigzagLength[1]);
    let lane = 1 - last;
    sp.queue.push({ lane, gap: base * 1.3 }); // pausa de entrada
    for (let i = 1; i < n; i++) {
      lane = 1 - lane;
      sp.queue.push({ lane, gap: d.zigzagGap });
    }
    sp.queue.push({ lane: randInt(rng, 0, 1), gap: base * 1.5 }); // respiro de salida
    return;
  }

  const r = rng();
  if (r < 0.2) {
    // Dos seguidos en el mismo carril: invita a quedarse del otro lado o a rozar.
    const lane = randInt(rng, 0, 1);
    sp.queue.push({ lane, gap: base });
    sp.queue.push({ lane, gap: base * 0.6 });
  } else {
    // Bloque suelto; un poco más probable en el carril contrario al anterior.
    const lane = rng() < 0.6 ? 1 - last : last;
    sp.queue.push({ lane, gap: base * (0.85 + rng() * 0.4) });
  }
}

// Distancia mínima (frente a frente) para que entre bloques consecutivos haya al menos
// la separación mínima en tiempo a velocidad máxima, sin contar el largo del bloque.
export function minDistance(sameLane, cfg) {
  const gap = sameLane ? cfg.minSameLaneGap : cfg.minSwitchGap;
  return gap * cfg.difficulty.maxSpeed + BLOCK_DEPTH;
}

// Devuelve el próximo bloque: { lane, dist } con dist = distancia desde el bloque anterior.
export function nextBlock(sp, t, speed, cfg) {
  if (sp.queue.length === 0) enqueuePattern(sp, t, cfg);
  const { lane, gap } = sp.queue.shift();
  const sameLane = lane === sp.prevLane;
  const dist = sp.prevLane < 0 ? 0 : Math.max(gap * speed, minDistance(sameLane, cfg));
  sp.prevLane = lane;
  return { lane, dist };
}

// Pool fijo de bloques: se reciclan, nunca se crean durante la partida.
export function createBlockPool(size) {
  const pool = [];
  for (let i = 0; i < size; i++) pool.push({ id: i, active: false, lane: 0, z: 0, grazed: false });
  return pool;
}

export function acquireBlock(pool) {
  for (const b of pool) if (!b.active) return b;
  return null;
}
