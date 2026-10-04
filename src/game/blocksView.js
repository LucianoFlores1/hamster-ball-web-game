// Vista de los bloques: pool fijo de cubos oscuros con aristas magenta.
// Cada mesh sigue a un bloque del pool de la simulación (mismo índice).
// Animaciones: caen del cielo girando al aparecer, laten con la música, se sacuden y
// destellan al ser rozados, y el que te golpea se pone rojo.

import {
  Group, Mesh, BoxGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, MeshBasicMaterial, Color,
  CanvasTexture, SRGBColorSpace,
} from 'three';
import { CONFIG } from '../config.js';
import { BLOCK_DEPTH } from './obstacles.js';
import { laneToX } from './player.js';

const WIDTH = CONFIG.lanes.width * 0.8;
const HEIGHT = 1.5;
const EDGE = new Color('#ff2fd0');
const EDGE_GRAZED = new Color('#ffffff');
const EDGE_HIT = new Color('#ff1a3c');
const DROP_FROM = CONFIG.spawnDistance; // empiezan a caer al aparecer…
const DROP_TO = CONFIG.spawnDistance - 38; // …y aterrizan acá
const DROP_HEIGHT = 12;

// Caída con dos rebotes contra el piso.
function easeOutBounce(t) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

// Cara con marco neón grueso (las líneas de WebGL miden siempre 1 px).
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1c0629';
  g.fillRect(0, 0, 128, 128);
  g.shadowColor = '#ff2fd0';
  g.shadowBlur = 18;
  g.strokeStyle = '#ff4fdc';
  g.lineWidth = 9;
  g.strokeRect(6, 6, 116, 116);
  g.shadowBlur = 0;
  g.strokeStyle = '#ffd0f6';
  g.lineWidth = 2;
  g.strokeRect(6, 6, 116, 116);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function createBlocksView(count) {
  const group = new Group();
  const box = new BoxGeometry(WIDTH, HEIGHT, BLOCK_DEPTH);
  const edges = new EdgesGeometry(box);
  const map = faceTexture();
  const bodyMat = new MeshBasicMaterial({ map });
  const hitMat = new MeshBasicMaterial({ map, color: '#ff3a50' });
  const items = [];

  for (let i = 0; i < count; i++) {
    const g = new Group();
    const body = new Mesh(box, bodyMat);
    const edgeMat = new LineBasicMaterial({ color: EDGE });
    const line = new LineSegments(edges, edgeMat);
    line.scale.setScalar(1.002);
    g.add(body, line);
    g.visible = false;
    group.add(g);
    items.push({ g, body, edgeMat, flash: 0, jolt: 0, hit: false, wasGrazed: false });
  }

  const baseColor = new Color('#ffffff');

  return {
    group,
    // El bloque que causó el choque queda rojo hasta reiniciar.
    markHit(id) {
      items[id].hit = true;
      items[id].jolt = 1;
      items[id].body.material = hitMat;
    },
    clearHit() {
      for (const it of items) {
        it.hit = false;
        it.body.material = bodyMat;
      }
    },
    update(blocks, dt, beatPulse) {
      bodyMat.color.copy(baseColor).multiplyScalar(1 + beatPulse * 0.5);
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const it = items[i];
        it.g.visible = b.active;
        if (!b.active) {
          it.wasGrazed = false;
          if (it.hit) {
            it.hit = false;
            it.body.material = bodyMat;
          }
          continue;
        }
        // caída desde el cielo con rebote y medio giro
        const t = Math.min(1, Math.max(0, (DROP_FROM - b.z) / (DROP_FROM - DROP_TO)));
        const drop = (1 - easeOutBounce(t)) * DROP_HEIGHT;
        it.g.rotation.y = (1 - t) * (1 - t) * Math.PI * 0.75 * (b.lane === 0 ? 1 : -1);

        if (b.grazed && !it.wasGrazed) {
          it.flash = 1;
          it.jolt = 1;
        }
        it.wasGrazed = b.grazed;
        it.flash = Math.max(0, it.flash - dt * 3);
        it.jolt = Math.max(0, it.jolt - dt * 5);

        // sacudida lateral (se aleja de la pelota) y estiramiento al ser rozado
        const wobble = Math.sin(it.jolt * 22) * it.jolt * 0.18;
        const side = b.lane === 0 ? -1 : 1;
        // el frente del bloque (cara hacia la pelota) está a b.z delante
        it.g.position.set(laneToX(b.lane) + side * wobble, HEIGHT / 2 + drop, -b.z - BLOCK_DEPTH / 2);
        const sc = 1 + it.jolt * 0.12;
        it.g.scale.set(sc, 2 - sc, sc);

        if (it.hit) it.edgeMat.color.copy(EDGE_HIT);
        else it.edgeMat.color.copy(EDGE).lerp(EDGE_GRAZED, it.flash);
      }
    },
  };
}
