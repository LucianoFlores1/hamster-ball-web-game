// Vista de la pelota: esfera emisiva, halo y estela que se desvanece.
// La posición lógica vive en world.lane (collision.js); acá solo se dibuja.

import {
  Group, Mesh, IcosahedronGeometry, MeshLambertMaterial, Sprite, SpriteMaterial, CanvasTexture,
  BufferGeometry, BufferAttribute, MeshBasicMaterial, AdditiveBlending, DoubleSide,
} from 'three';
import { CONFIG } from '../config.js';
import { visualLaneT } from './collision.js';

export const BALL_RADIUS = 0.5;
const TRAIL_POINTS = 24;
const TRAIL_SPACING = 0.35;
const TRAIL_WIDTH = 0.42;

export function laneToX(t) {
  return (t - 0.5) * CONFIG.lanes.width;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(120,240,255,0.55)');
  grad.addColorStop(1, 'rgba(60,200,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function createPlayerView() {
  const group = new Group();

  const ball = new Mesh(
    new IcosahedronGeometry(BALL_RADIUS, 2),
    new MeshLambertMaterial({ color: '#7ff6ff', emissive: '#18b8d8', emissiveIntensity: 0.9, flatShading: true }),
  );
  ball.position.y = BALL_RADIUS;

  const glow = new Sprite(new SpriteMaterial({
    map: glowTexture(), color: '#6ff0ff', blending: AdditiveBlending, depthWrite: false, depthTest: false,
    transparent: true,
  }));
  glow.renderOrder = 10;
  glow.scale.setScalar(2.6);
  glow.position.y = BALL_RADIUS;

  // Estela: cinta horizontal con color que se apaga (blending aditivo: negro = invisible).
  const positions = new Float32Array(TRAIL_POINTS * 2 * 3);
  const colors = new Float32Array(TRAIL_POINTS * 2 * 3);
  const index = [];
  for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const trailGeo = new BufferGeometry();
  trailGeo.setAttribute('position', new BufferAttribute(positions, 3));
  trailGeo.setAttribute('color', new BufferAttribute(colors, 3));
  trailGeo.setIndex(index);
  const trail = new Mesh(trailGeo, new MeshBasicMaterial({
    vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide,
  }));
  trail.frustumCulled = false;

  group.add(trail, ball, glow);

  // historial de x de la pelota, una muestra cada TRAIL_SPACING de distancia
  const history = new Float32Array(TRAIL_POINTS);
  let lastSampleDist = 0;
  let prevX = laneToX(0);
  let prevDist = 0;

  function resetTrail(x) {
    history.fill(x);
  }

  return {
    group,
    ball,
    // Se llama al empezar y al continuar: la estela arranca desde la posición actual.
    reset(world) {
      ball.visible = glow.visible = trail.visible = true;
      prevX = laneToX(visualLaneT(world.lane));
      resetTrail(prevX);
      lastSampleDist = prevDist = world.distance;
    },
    hide() {
      ball.visible = glow.visible = trail.visible = false;
    },
    ballX(lane) {
      return laneToX(visualLaneT(lane));
    },
    update(world, dt, time) {
      const x = laneToX(visualLaneT(world.lane));
      ball.position.x = glow.position.x = x;
      ball.rotation.x -= (world.speed * dt) / BALL_RADIUS;

      // invulnerable: parpadeo
      const inv = world.invulnerable > 0;
      ball.visible = !inv || Math.sin(time * 40) > -0.3;

      // muestras interpoladas entre la posición del cuadro anterior y la actual
      const frameDist = world.distance - prevDist;
      while (world.distance - lastSampleDist >= TRAIL_SPACING) {
        lastSampleDist += TRAIL_SPACING;
        const k = frameDist > 0 ? Math.min(1, (lastSampleDist - prevDist) / frameDist) : 1;
        history.copyWithin(1, 0);
        history[0] = prevX + (x - prevX) * k;
      }
      prevX = x;
      prevDist = world.distance;
      const frac = (world.distance - lastSampleDist) / TRAIL_SPACING;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const px = i === 0 ? x : history[i - 1];
        const z = i === 0 ? 0 : (i - 1 + frac) * TRAIL_SPACING + 0.05;
        const k = 1 - i / (TRAIL_POINTS - 1);
        const w = TRAIL_WIDTH * (0.25 + 0.75 * k);
        const o = i * 6;
        positions[o] = px - w; positions[o + 1] = BALL_RADIUS * 0.6; positions[o + 2] = z;
        positions[o + 3] = px + w; positions[o + 4] = BALL_RADIUS * 0.6; positions[o + 5] = z;
        const c = k * k * 0.7;
        colors[o] = colors[o + 3] = 0.25 * c;
        colors[o + 1] = colors[o + 4] = 0.9 * c;
        colors[o + 2] = colors[o + 5] = 1.0 * c;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
    },
  };
}
