// Efectos: chispas, explosiones de partículas, ondas expansivas en el piso, líneas de
// velocidad y fragmentos del choque. Pools fijos: nada se crea durante la partida.

import {
  Points, PointsMaterial, BufferGeometry, BufferAttribute, AdditiveBlending, Group, Mesh,
  TetrahedronGeometry, MeshBasicMaterial, CanvasTexture, RingGeometry, LineSegments,
  LineBasicMaterial, DoubleSide,
} from 'three';
import { BALL_RADIUS } from './player.js';
import { LEVEL_COLORS } from './palette.js';

const MAX_SPARKS = 400;
const FRAGMENTS = 26;
const RINGS = 8;
const SPEED_LINES = 70;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

export function createEffects() {
  const group = new Group();

  // ---------- partículas ----------
  const pos = new Float32Array(MAX_SPARKS * 3);
  const col = new Float32Array(MAX_SPARKS * 3);
  const vel = new Float32Array(MAX_SPARKS * 3);
  const life = new Float32Array(MAX_SPARKS);
  const maxLife = new Float32Array(MAX_SPARKS).fill(1);
  const gravity = new Float32Array(MAX_SPARKS);
  const base = new Float32Array(MAX_SPARKS * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const sparks = new Points(geo, new PointsMaterial({
    size: 0.34, map: dotTexture(), vertexColors: true, blending: AdditiveBlending,
    transparent: true, depthWrite: false,
  }));
  sparks.frustumCulled = false;
  let nextSpark = 0;

  function emit(x, y, z, vx, vy, vz, l, g, color) {
    const i = nextSpark;
    nextSpark = (nextSpark + 1) % MAX_SPARKS;
    const o = i * 3;
    pos[o] = x;
    pos[o + 1] = y;
    pos[o + 2] = z;
    vel[o] = vx;
    vel[o + 1] = vy;
    vel[o + 2] = vz;
    life[i] = maxLife[i] = l;
    gravity[i] = g;
    base[o] = color.r;
    base[o + 1] = color.g;
    base[o + 2] = color.b;
  }

  // ---------- ondas expansivas ----------
  const ringGeo = new RingGeometry(0.85, 1, 48);
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const mat = new MeshBasicMaterial({
      transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
    });
    const m = new Mesh(ringGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    group.add(m);
    rings.push({ m, mat, life: 0, max: 1, size: 1 });
  }
  let nextRing = 0;

  // ---------- líneas de velocidad ----------
  const linePos = new Float32Array(SPEED_LINES * 6);
  const lineCol = new Float32Array(SPEED_LINES * 6);
  const lineData = [];
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new BufferAttribute(lineCol, 3));
  const lines = new LineSegments(lineGeo, new LineBasicMaterial({
    vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false,
  }));
  lines.frustumCulled = false;
  function placeLine(d, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    d.x = side * (3.5 + Math.random() * 10);
    d.y = 0.4 + Math.random() * 6;
    d.z = z;
    d.k = 0.4 + Math.random() * 0.6;
  }
  for (let i = 0; i < SPEED_LINES; i++) {
    const d = {};
    placeLine(d, -Math.random() * 130);
    lineData.push(d);
  }
  let lineAmount = 0;

  // ---------- fragmentos ----------
  const fragGeo = new TetrahedronGeometry(0.24);
  const fragMat = new MeshBasicMaterial({ color: '#7ff6ff' });
  const frags = [];
  for (let i = 0; i < FRAGMENTS; i++) {
    const m = new Mesh(fragGeo, fragMat);
    m.visible = false;
    group.add(m);
    frags.push({ m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0 });
  }

  group.add(sparks, lines);

  return {
    group,

    // Chispas en el costado de la pelota que da al bloque rozado.
    sparks(x, side, level, count) {
      const color = LEVEL_COLORS[level];
      for (let n = 0; n < count; n++) {
        emit(
          x + side * BALL_RADIUS * 0.8, BALL_RADIUS + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4,
          side * (2 + Math.random() * 7), 1 + Math.random() * 6, 3 + Math.random() * 12,
          0.35 + Math.random() * 0.3, 14, color,
        );
      }
    },

    // Explosión esférica de partículas.
    burst(x, y, z, color, count, speed, l = 0.7, g = 6) {
      for (let n = 0; n < count; n++) {
        const a = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - u * u);
        const s = speed * (0.4 + Math.random() * 0.6);
        emit(x, y, z, Math.cos(a) * r * s, Math.abs(u) * s + 1, Math.sin(a) * r * s, l * (0.6 + Math.random() * 0.4), g, color);
      }
    },

    // Onda expansiva en el piso.
    ring(x, z, color, size = 3, l = 0.45) {
      const r = rings[nextRing];
      nextRing = (nextRing + 1) % RINGS;
      r.m.visible = true;
      r.m.position.set(x, 0.05, z);
      r.mat.color.copy(color);
      r.life = r.max = l;
      r.size = size;
    },

    shatter(x, level) {
      fragMat.color.copy(LEVEL_COLORS[level]);
      for (const f of frags) {
        f.m.visible = true;
        f.m.position.set(x + (Math.random() - 0.5) * 0.5, BALL_RADIUS + (Math.random() - 0.5) * 0.5, 0);
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 7;
        f.vx = Math.cos(a) * s;
        f.vy = 3 + Math.random() * 8;
        f.vz = 2 + Math.random() * 9;
        f.rx = (Math.random() - 0.5) * 20;
        f.ry = (Math.random() - 0.5) * 20;
        f.m.scale.setScalar(0.6 + Math.random() * 0.9);
      }
    },

    // Cantidad de líneas de velocidad visibles (0 a 1).
    setSpeedLines(amount) {
      lineAmount = amount;
    },

    clear() {
      for (const f of frags) f.m.visible = false;
      for (const r of rings) r.m.visible = false;
      life.fill(0);
      col.fill(0);
      geo.attributes.color.needsUpdate = true;
    },

    // dt: tiempo de juego (cámara lenta incluida). speed: velocidad del mundo.
    update(dt, speed) {
      for (let i = 0; i < MAX_SPARKS; i++) {
        const o = i * 3;
        if (life[i] <= 0) {
          col[o] = col[o + 1] = col[o + 2] = 0;
          continue;
        }
        life[i] -= dt;
        vel[o + 1] -= gravity[i] * dt;
        pos[o] += vel[o] * dt;
        pos[o + 1] = Math.max(0.05, pos[o + 1] + vel[o + 1] * dt);
        pos[o + 2] += vel[o + 2] * dt;
        const k = Math.max(0, life[i] / maxLife[i]);
        col[o] = base[o] * k;
        col[o + 1] = base[o + 1] * k;
        col[o + 2] = base[o + 2] * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      for (const r of rings) {
        if (!r.m.visible) continue;
        r.life -= dt;
        if (r.life <= 0) {
          r.m.visible = false;
          continue;
        }
        const t = 1 - r.life / r.max;
        r.m.scale.setScalar(0.3 + r.size * (1 - (1 - t) * (1 - t)));
        r.mat.opacity = 0.75 * (1 - t) * (1 - t);
        r.m.position.z += speed * dt; // se queda en el piso mientras el mundo avanza
      }

      // líneas de velocidad: vienen del horizonte, más largas cuanto más rápido
      const len = 1.5 + speed * 0.12;
      for (let i = 0; i < SPEED_LINES; i++) {
        const d = lineData[i];
        d.z += speed * 1.25 * dt;
        if (d.z > 12) placeLine(d, -110 - Math.random() * 30);
        const o = i * 6;
        linePos[o] = linePos[o + 3] = d.x;
        linePos[o + 1] = linePos[o + 4] = d.y;
        linePos[o + 2] = d.z;
        linePos[o + 5] = d.z - len * d.k;
        const visible = i < SPEED_LINES * lineAmount ? lineAmount * d.k : 0;
        lineCol[o] = lineCol[o + 3] = 0.8 * visible;
        lineCol[o + 1] = lineCol[o + 4] = 0.6 * visible;
        lineCol[o + 2] = lineCol[o + 5] = 1.0 * visible;
        lineCol[o + 3] *= 0.1;
        lineCol[o + 4] *= 0.1;
        lineCol[o + 5] *= 0.1;
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      for (const f of frags) {
        if (!f.m.visible) continue;
        f.vy -= 18 * dt;
        f.m.position.x += f.vx * dt;
        f.m.position.y += f.vy * dt;
        f.m.position.z += f.vz * dt;
        if (f.m.position.y < 0.1) {
          f.m.position.y = 0.1;
          f.vy *= -0.4;
          f.vx *= 0.7;
          f.vz *= 0.7;
        }
        f.m.rotation.x += f.rx * dt;
        f.m.rotation.y += f.ry * dt;
      }
    },
  };
}
