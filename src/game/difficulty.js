// Curva de dificultad en función del tiempo de partida. Lógica pura.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - (1 - x) * (1 - x);

export function speedAt(t, cfg) {
  const d = cfg.difficulty;
  return d.startSpeed + (d.maxSpeed - d.startSpeed) * easeOut(clamp01(t / d.speedRampTime));
}

export function gapAt(t, cfg) {
  const d = cfg.difficulty;
  return d.startGap + (d.minGap - d.startGap) * easeOut(clamp01(t / d.gapRampTime));
}

export function zigzagChanceAt(t, cfg) {
  const d = cfg.difficulty;
  if (t < d.zigzagStartTime) return 0;
  const k = clamp01((t - d.zigzagStartTime) / d.gapRampTime);
  return d.zigzagChanceStart + (d.zigzagChanceMax - d.zigzagChanceStart) * k;
}
