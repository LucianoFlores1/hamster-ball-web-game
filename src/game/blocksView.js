// Vista de los bloques: pool fijo de cubos oscuros con aristas magenta.
// Cada mesh sigue a un bloque del pool de la simulación (mismo índice).

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
  const bodyMat = new MeshBasicMaterial({ map: faceTexture() });
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
    items.push({ g, edgeMat, flash: 0, wasGrazed: false });
  }

  return {
    group,
    update(blocks, dt) {
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const it = items[i];
        it.g.visible = b.active;
        if (!b.active) {
          it.wasGrazed = false;
          continue;
        }
        // el frente del bloque (cara hacia la pelota) está a b.z delante
        it.g.position.set(laneToX(b.lane), HEIGHT / 2, -b.z - BLOCK_DEPTH / 2);
        if (b.grazed && !it.wasGrazed) it.flash = 1;
        it.wasGrazed = b.grazed;
        it.flash = Math.max(0, it.flash - dt * 3);
        it.edgeMat.color.copy(EDGE).lerp(EDGE_GRAZED, it.flash);
      }
    },
  };
}
