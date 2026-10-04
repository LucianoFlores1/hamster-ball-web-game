// Vista de la pelota: esfera emisiva, halo y estela que se desvanece.
// La posición lógica vive en world.lane (collision.js); acá solo se dibuja.
// Animaciones: deformación y giro al cambiar de carril, "pop" con resorte en roces y al
// aparecer, latido con la música, color según el multiplicador y flotación en el menú.

import {
  Group, Mesh, IcosahedronGeometry, MeshLambertMaterial, Sprite, SpriteMaterial, CanvasTexture,
  BufferGeometry, BufferAttribute, MeshBasicMaterial, AdditiveBlending, DoubleSide, Color,
} from 'three';
import { CONFIG } from '../config.js';
import { visualLaneT } from './collision.js';
import { LEVEL_COLORS } from './palette.js';

export const BALL_RADIUS = 0.5;
const TRAIL_POINTS = 28;
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
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

// Resorte amortiguado: valor que vuelve a 1 con rebote.
function spring(stiffness, damping) {
  return {
    v: 1,
    vel: 0,
    kick(amount) {
      this.vel += amount;
    },
    set(v) {
      this.v = v;
      this.vel = 0;
    },
    update(dt) {
      const a = stiffness * (1 - this.v) - damping * this.vel;
      this.vel += a * dt;
      this.v += this.vel * dt;
    },
  };
}

export function createPlayerView() {
  const group = new Group();
  const body = new Group(); // deformación e inclinación
  body.position.y = BALL_RADIUS;

  const ballMat = new MeshLambertMaterial({ color: '#7ff6ff', emissive: '#18b8d8', emissiveIntensity: 0.9, flatShading: true });
  const ball = new Mesh(new IcosahedronGeometry(BALL_RADIUS, 2), ballMat);
  body.add(ball);

  const glowMat = new SpriteMaterial({
    map: glowTexture(), color: '#6ff0ff', blending: AdditiveBlending, depthWrite: false, depthTest: false,
    transparent: true,
  });
  const glow = new Sprite(glowMat);
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

  group.add(trail, body, glow);

  // historial de x de la pelota, una muestra cada TRAIL_SPACING de distancia
  const history = new Float32Array(TRAIL_POINTS);
  let lastSampleDist = 0;
  let prevX = laneToX(0);
  let prevDist = 0;
  let lastX = laneToX(0);
  let lean = 0;
  let stretch = 0;
  const pop = spring(260, 11);
  const color = LEVEL_COLORS[0].clone();
  const white = new Color('#ffffff');
  let flash = 0;

  return {
    group,
    // Se llama al empezar y al continuar: la estela arranca desde la posición actual
    // y la pelota aparece desde cero con rebote.
    reset(world) {
      body.visible = glow.visible = trail.visible = true;
      prevX = lastX = laneToX(visualLaneT(world.lane));
      history.fill(prevX);
      lastSampleDist = prevDist = world.distance;
      pop.set(0.05);
      pop.kick(6);
      flash = 1;
    },
    hide() {
      body.visible = glow.visible = trail.visible = false;
    },
    showIdle() {
      body.visible = glow.visible = true;
      trail.visible = false;
    },
    ballX(lane) {
      return laneToX(visualLaneT(lane));
    },
    graze(level) {
      pop.kick(4 + level);
      flash = 1;
    },
    // Pelota flotando en el menú.
    idle(dt, time, beatPulse) {
      body.position.x = glow.position.x = 0; // centrada en la ruta
      body.rotation.z = 0;
      const bob = Math.sin(time * 2.2) * 0.12;
      body.position.y = BALL_RADIUS + 0.15 + bob;
      glow.position.y = body.position.y;
      ball.rotation.x -= dt * 2.5;
      ball.rotation.y += dt * 0.8;
      pop.update(dt);
      body.scale.setScalar(pop.v * (1 + beatPulse * 0.06));
      glow.scale.setScalar(2.6 * (1 + beatPulse * 0.3));
      ballMat.emissiveIntensity = 0.9 + beatPulse * 0.6;
    },
    update(world, dt, time, beatPulse) {
      const x = laneToX(visualLaneT(world.lane));
      body.position.x = glow.position.x = x;
      body.position.y = glow.position.y = BALL_RADIUS;
      ball.rotation.x -= (world.speed * dt) / BALL_RADIUS;

      // velocidad lateral → estiramiento en el sentido del movimiento e inclinación
      const vx = dt > 0 ? (x - lastX) / dt : 0;
      lastX = x;
      const k = Math.min(1, Math.abs(vx) / 18);
      stretch += (k - stretch) * Math.min(1, dt * 30);
      lean += (-vx * 0.035 - lean) * Math.min(1, dt * 20);
      body.rotation.z = lean;

      pop.update(dt);
      const s = pop.v * (1 + beatPulse * 0.05);
      body.scale.set(s * (1 + stretch * 0.26), s * (1 - stretch * 0.16), s * (1 - stretch * 0.08));

      // color según el multiplicador, con destello blanco en roces
      color.lerp(LEVEL_COLORS[world.score.level], Math.min(1, dt * 8));
      flash = Math.max(0, flash - dt * 4);
      ballMat.color.copy(color).lerp(white, 0.45 + flash * 0.5);
      ballMat.emissive.copy(color).multiplyScalar(0.55);
      ballMat.emissiveIntensity = 0.9 + beatPulse * 0.5 + flash;
      glowMat.color.copy(color);
      glow.scale.setScalar(2.6 * (1 + beatPulse * 0.22 + flash * 0.6 + world.score.level * 0.06));

      // invulnerable: parpadeo
      const inv = world.invulnerable > 0;
      body.visible = !inv || Math.sin(time * 40) > -0.3;

      // muestras interpoladas entre la posición del cuadro anterior y la actual
      const frameDist = world.distance - prevDist;
      while (world.distance - lastSampleDist >= TRAIL_SPACING) {
        lastSampleDist += TRAIL_SPACING;
        const kk = frameDist > 0 ? Math.min(1, (lastSampleDist - prevDist) / frameDist) : 1;
        history.copyWithin(1, 0);
        history[0] = prevX + (x - prevX) * kk;
      }
      prevX = x;
      prevDist = world.distance;
      const frac = (world.distance - lastSampleDist) / TRAIL_SPACING;
      const width = TRAIL_WIDTH * (1 + world.score.level * 0.08);
      const bright = 0.65 + world.score.level * 0.06;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const px = i === 0 ? x : history[i - 1];
        const z = i === 0 ? 0 : (i - 1 + frac) * TRAIL_SPACING + 0.05;
        const f = 1 - i / (TRAIL_POINTS - 1);
        const w = width * (0.2 + 0.8 * f);
        const o = i * 6;
        positions[o] = px - w; positions[o + 1] = BALL_RADIUS * 0.6; positions[o + 2] = z;
        positions[o + 3] = px + w; positions[o + 4] = BALL_RADIUS * 0.6; positions[o + 5] = z;
        const c = f * f * bright;
        colors[o] = colors[o + 3] = color.r * c;
        colors[o + 1] = colors[o + 4] = color.g * c;
        colors[o + 2] = colors[o + 5] = color.b * c;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
    },
  };
}
