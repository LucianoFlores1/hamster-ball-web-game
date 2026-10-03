// Chispas del roce y fragmentos del choque. Pools fijos: nada se crea durante la partida.

import {
  Points, PointsMaterial, BufferGeometry, BufferAttribute, AdditiveBlending, Group, Mesh,
  TetrahedronGeometry, MeshBasicMaterial, CanvasTexture, Color,
} from 'three';
import { BALL_RADIUS } from './player.js';

const MAX_SPARKS = 240;
const FRAGMENTS = 22;
const SPARK_LIFE = 0.55;

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

const LEVEL_COLORS = ['#3ff0ff', '#b06bff', '#ff2fd0', '#ff2fd0', '#ff7a59', '#ffc23d'].map((c) => new Color(c));

export function createEffects() {
  const group = new Group();

  // Chispas
  const pos = new Float32Array(MAX_SPARKS * 3);
  const col = new Float32Array(MAX_SPARKS * 3);
  const vel = new Float32Array(MAX_SPARKS * 3);
  const life = new Float32Array(MAX_SPARKS);
  const base = new Float32Array(MAX_SPARKS * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const sparks = new Points(geo, new PointsMaterial({
    size: 0.32, map: dotTexture(), vertexColors: true, blending: AdditiveBlending,
    transparent: true, depthWrite: false,
  }));
  sparks.frustumCulled = false;
  let nextSpark = 0;

  // Fragmentos
  const fragGeo = new TetrahedronGeometry(0.22);
  const fragMat = new MeshBasicMaterial({ color: '#7ff6ff' });
  const frags = [];
  for (let i = 0; i < FRAGMENTS; i++) {
    const m = new Mesh(fragGeo, fragMat);
    m.visible = false;
    group.add(m);
    frags.push({ m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0 });
  }

  group.add(sparks);

  return {
    group,
    // Chispas en el costado de la pelota que da al bloque rozado.
    sparks(x, side, level, count) {
      const color = LEVEL_COLORS[level] || LEVEL_COLORS[0];
      for (let n = 0; n < count; n++) {
        const i = nextSpark;
        nextSpark = (nextSpark + 1) % MAX_SPARKS;
        const o = i * 3;
        pos[o] = x + side * BALL_RADIUS * 0.8;
        pos[o + 1] = BALL_RADIUS + (Math.random() - 0.5) * 0.4;
        pos[o + 2] = (Math.random() - 0.5) * 0.4;
        vel[o] = side * (2 + Math.random() * 6);
        vel[o + 1] = 1 + Math.random() * 5;
        vel[o + 2] = 4 + Math.random() * 10; // hacia atrás, con el flujo
        life[i] = SPARK_LIFE * (0.6 + Math.random() * 0.4);
        base[o] = color.r;
        base[o + 1] = color.g;
        base[o + 2] = color.b;
      }
    },
    shatter(x) {
      for (const f of frags) {
        f.m.visible = true;
        f.m.position.set(x + (Math.random() - 0.5) * 0.5, BALL_RADIUS + (Math.random() - 0.5) * 0.5, 0);
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 6;
        f.vx = Math.cos(a) * s;
        f.vy = 3 + Math.random() * 7;
        f.vz = 2 + Math.random() * 8;
        f.rx = (Math.random() - 0.5) * 20;
        f.ry = (Math.random() - 0.5) * 20;
      }
    },
    clear() {
      for (const f of frags) f.m.visible = false;
      life.fill(0);
      col.fill(0);
      geo.attributes.color.needsUpdate = true;
    },
    update(dt) {
      for (let i = 0; i < MAX_SPARKS; i++) {
        const o = i * 3;
        if (life[i] <= 0) {
          col[o] = col[o + 1] = col[o + 2] = 0;
          continue;
        }
        life[i] -= dt;
        vel[o + 1] -= 14 * dt;
        pos[o] += vel[o] * dt;
        pos[o + 1] = Math.max(0.05, pos[o + 1] + vel[o + 1] * dt);
        pos[o + 2] += vel[o + 2] * dt;
        const k = Math.max(0, life[i] / SPARK_LIFE);
        col[o] = base[o] * k;
        col[o + 1] = base[o + 1] * k;
        col[o + 2] = base[o + 2] * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

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
