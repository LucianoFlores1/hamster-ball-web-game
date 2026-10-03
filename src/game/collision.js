// Carriles, choque y roce al ras. Lógica pura (sin Three.js).
//
// La posición lateral de la pelota es `p`, de 0 (carril 0) a 1 (carril 1), y avanza
// linealmente en el tiempo hacia el carril objetivo. El carril lógico (el que cuenta
// para los choques) cambia cuando `p` cruza `logicalSwitchAt` (regla 1).

export function createLaneState(lane = 0) {
  return { p: lane, target: lane, logical: lane };
}

export function isSwitching(ls) {
  return ls.p !== ls.target;
}

// Carriles que ocupa la pelota para los choques:
// el lógico siempre; el de destino desde el toque hasta terminar el cambio (regla 2).
export function occupiesLane(ls, lane) {
  return ls.logical === lane || (isSwitching(ls) && ls.target === lane);
}

// Segundos hasta que el carril lógico pase a ser `target`, desde el estado actual.
export function timeToLogicalSwitch(ls, cfg) {
  if (ls.logical === ls.target) return 0;
  const { switchDuration, logicalSwitchAt } = cfg.lanes;
  const threshold = ls.target === 1 ? logicalSwitchAt : 1 - logicalSwitchAt;
  return (Math.abs(threshold - ls.p)) * switchDuration;
}

export function stepLane(ls, dt, cfg) {
  const { switchDuration, logicalSwitchAt } = cfg.lanes;
  if (ls.p !== ls.target) {
    const delta = dt / switchDuration;
    ls.p = ls.target === 1 ? Math.min(1, ls.p + delta) : Math.max(0, ls.p - delta);
  }
  if (ls.target === 1 && ls.p >= logicalSwitchAt) ls.logical = 1;
  else if (ls.target === 0 && ls.p <= 1 - logicalSwitchAt) ls.logical = 0;
}

// Cambia el carril objetivo. Devuelve el carril que se deja.
export function toggleLane(ls) {
  ls.target = 1 - ls.target;
  return 1 - ls.target;
}

// Posición visual con aceleración suave (simétrica: al 50 % del tiempo, a mitad de camino).
export function visualLaneT(ls) {
  const t = ls.p;
  return t * t * (3 - 2 * t);
}

// Busca el bloque que cuenta como roce al tocar (regla 2). `blocks` es la lista de bloques
// activos con { lane, z, grazed }; z es la distancia del frente del bloque a la pelota.
// Debe llamarse justo después de `toggleLane`. Devuelve el bloque o null.
export function findGraze(ls, leavingLane, blocks, speed, cfg) {
  // Solo se roza el carril en el que la pelota estaba realmente.
  if (ls.logical !== leavingLane) return null;
  const minTime = timeToLogicalSwitch(ls, cfg);
  let best = null;
  for (const b of blocks) {
    if (!b.active || b.grazed || b.lane !== leavingLane || b.z <= 0) continue;
    const tti = b.z / speed;
    if (tti > minTime && tti < cfg.graze.window && (!best || b.z < best.z)) best = b;
  }
  return best;
}

// ¿El bloque está a la altura de la pelota? (frente ya llegó, fondo todavía no pasó)
export function blockAtBall(b, depth) {
  return b.z <= 0 && b.z + depth >= 0;
}

export function findCollision(ls, blocks, depth) {
  for (const b of blocks) {
    if (b.active && blockAtBall(b, depth) && occupiesLane(ls, b.lane)) return b;
  }
  return null;
}
