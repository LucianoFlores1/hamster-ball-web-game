// Puntaje y multiplicador. Lógica pura.

export function createScore() {
  return { points: 0, level: 0, sinceGraze: 0, grazes: 0, combo: 0 };
}

export function multiplier(s, cfg) {
  return cfg.multiplier.levels[s.level];
}

export function addDistance(s, dist, cfg) {
  s.points += dist * cfg.scoring.pointsPerUnit * multiplier(s, cfg);
}

// Registra un roce: sube el multiplicador (hasta el tope), reinicia el contador y suma el bonus.
// Devuelve los puntos sumados.
export function registerGraze(s, cfg) {
  s.level = Math.min(s.level + 1, cfg.multiplier.levels.length - 1);
  s.sinceGraze = 0;
  s.grazes++;
  s.combo++; // roces seguidos sin perder el multiplicador
  const bonus = cfg.graze.bonus * multiplier(s, cfg);
  s.points += bonus;
  return bonus;
}

// Avanza el reloj del multiplicador. Devuelve true si se reinició a x1.
export function tickMultiplier(s, dt, cfg) {
  if (s.level === 0) return false;
  s.sinceGraze += dt;
  if (s.sinceGraze >= cfg.multiplier.resetAfter) {
    s.level = 0;
    s.sinceGraze = 0;
    s.combo = 0;
    return true;
  }
  return false;
}

// Fracción de tiempo restante antes del reinicio (1 = recién rozado), para el HUD.
export function multiplierTimeLeft(s, cfg) {
  if (s.level === 0) return 0;
  return 1 - s.sinceGraze / cfg.multiplier.resetAfter;
}
