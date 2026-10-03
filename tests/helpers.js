// Generador pseudoaleatorio con semilla (mulberry32), para pruebas reproducibles.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function block(lane, z, extra = {}) {
  return { id: 0, active: true, grazed: false, lane, z, ...extra };
}
