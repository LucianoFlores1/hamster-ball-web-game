// Escenario synthwave: cielo estrellado, sol a franjas, montañas, cuadrícula en movimiento y ruta.
// Todo se crea una sola vez; durante la partida solo se mueven posiciones y colores.
// Todo late con la música (cuadrícula, bordes de la ruta, sol) y cambia de color con el multiplicador.

import {
  Scene, Color, Fog, CanvasTexture, SRGBColorSpace, Mesh, Group, PlaneGeometry, CircleGeometry,
  ShaderMaterial, MeshBasicMaterial, LineBasicMaterial, LineSegments, BufferGeometry,
  Float32BufferAttribute, Shape, ShapeGeometry, Line, HemisphereLight, DirectionalLight,
  Points, PointsMaterial, BufferAttribute,
} from 'three';
import { CONFIG } from '../config.js';

const HORIZON = new Color('#3a0b4a');
const GRID_CELL = 4;
const DASH_PERIOD = 6;

export const GRID_COLORS = ['#7b2fff', '#a32cff', '#ff2fd0', '#ff2fd0', '#ff6a5c', '#ffc23d'].map((c) => new Color(c));
const EDGE_COLORS = ['#ff2fd0', '#ff2fd0', '#ff4fdc', '#ff6fa0', '#ff8a5c', '#ffd25a'].map((c) => new Color(c));
const STARS = 160;

// Estrellas en una cúpula lejana, titilando (solo cambia su brillo).
function makeStars() {
  const pos = new Float32Array(STARS * 3);
  const col = new Float32Array(STARS * 3);
  const phase = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const a = (Math.random() - 0.5) * Math.PI * 1.4;
    const h = 0.08 + Math.random() * 0.9;
    const r = 500;
    pos[i * 3] = Math.sin(a) * r;
    pos[i * 3 + 1] = 40 + h * 260;
    pos[i * 3 + 2] = -Math.cos(a) * r;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const points = new Points(geo, new PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false }));
  points.renderOrder = -3;
  return {
    points,
    update(time) {
      for (let i = 0; i < STARS; i++) {
        const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1 + (i % 5) * 0.4) + phase[i]));
        col[i * 3] = b;
        col[i * 3 + 1] = b * 0.85;
        col[i * 3 + 2] = b;
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0b0217');
  grad.addColorStop(0.45, '#2a0640');
  grad.addColorStop(0.75, '#6a0f6e');
  grad.addColorStop(1, '#c4237f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeSun() {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        if (length(p) > 1.0) discard;
        float y = vUv.y;
        // franjas horizontales que se ensanchan hacia abajo y bajan lentamente
        if (y < 0.55) {
          float band = fract((y + uTime * 0.03) * 14.0);
          float cut = mix(0.65, 0.05, y / 0.55);
          if (band < cut) discard;
        }
        vec3 top = vec3(1.0, 0.86, 0.3);
        vec3 bottom = vec3(1.0, 0.18, 0.62);
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.1, 0.95, y)), 1.0);
      }
    `,
  });
  const sun = new Mesh(new CircleGeometry(1, 48), mat);
  sun.scale.setScalar(70);
  sun.position.set(0, 26, -420);
  sun.renderOrder = -2;
  return sun;
}

// Cordillera: silueta oscura con borde luminoso. Determinista para que siempre se vea igual.
function makeMountains() {
  const group = new Group();
  let seed = 12345;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const layers = [
    { z: -360, height: 34, color: '#1a0626', line: '#ff2fd0', spread: 1100 },
    { z: -320, height: 20, color: '#12041c', line: '#3ff0ff', spread: 1000 },
  ];
  for (const layer of layers) {
    const pts = [];
    const n = 70;
    for (let i = 0; i <= n; i++) {
      const x = -layer.spread / 2 + (layer.spread * i) / n;
      // valle en el centro para que el sol se vea
      const valley = Math.min(1, Math.abs(x) / 90);
      const h = (0.25 + rand() * 0.75) * layer.height * (0.15 + 0.85 * valley);
      pts.push([x, h]);
    }
    const shape = new Shape();
    shape.moveTo(pts[0][0], -5);
    for (const [x, y] of pts) shape.lineTo(x, y);
    shape.lineTo(pts[n][0], -5);
    const fill = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ color: layer.color, fog: false }));
    const lineGeo = new BufferGeometry().setFromPoints(pts.map(([x, y]) => ({ x, y, z: 0.1 })));
    const line = new Line(lineGeo, new LineBasicMaterial({ color: layer.line, fog: false }));
    fill.position.z = line.position.z = layer.z;
    fill.renderOrder = line.renderOrder = -1;
    group.add(fill, line);
  }
  return group;
}

function makeGrid() {
  const halfW = 160;
  const near = 30;
  const far = -340;
  const verts = [];
  // líneas a lo largo (fijas)
  for (let x = -halfW; x <= halfW; x += GRID_CELL) verts.push(x, 0, near, x, 0, far);
  const along = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: GRID_COLORS[0] }));
  along.geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));

  // líneas transversales (se desplazan hacia la cámara)
  const cross = [];
  for (let z = near + GRID_CELL; z >= far; z -= GRID_CELL) cross.push(-halfW, 0, z, halfW, 0, z);
  const across = new LineSegments(new BufferGeometry(), along.material);
  across.geometry.setAttribute('position', new Float32BufferAttribute(cross, 3));

  const floor = new Mesh(new PlaneGeometry(halfW * 2, near - far), new MeshBasicMaterial({ color: '#0d0216' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, (near + far) / 2);

  const group = new Group();
  group.add(floor, along, across);
  return { group, across, material: along.material };
}

function makeRoad() {
  const laneW = CONFIG.lanes.width;
  const halfRoad = laneW + 0.35;
  const near = 30;
  const far = -340;
  const group = new Group();

  const surface = new Mesh(
    new PlaneGeometry(halfRoad * 2, near - far),
    new MeshBasicMaterial({ color: '#07010d' }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, 0.01, (near + far) / 2);
  group.add(surface);

  const edgeMat = new MeshBasicMaterial({ color: '#ff2fd0' });
  for (const side of [-1, 1]) {
    const edge = new Mesh(new PlaneGeometry(0.16, near - far), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * halfRoad, 0.03, (near + far) / 2);
    group.add(edge);
  }

  // línea central punteada: un solo mesh con todos los trazos, se desplaza en módulo
  const dashGeo = new BufferGeometry();
  const pos = [];
  const idx = [];
  let v = 0;
  for (let z = near + DASH_PERIOD; z >= far; z -= DASH_PERIOD) {
    const z0 = z;
    const z1 = z - DASH_PERIOD * 0.5;
    pos.push(-0.06, 0, z0, 0.06, 0, z0, 0.06, 0, z1, -0.06, 0, z1);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  dashGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  dashGeo.setIndex(idx);
  const dashes = new Mesh(dashGeo, new MeshBasicMaterial({ color: '#ff8be8', side: 2 }));
  dashes.position.y = 0.03;
  group.add(dashes);

  return { group, dashes, edgeMat };
}

export function createWorldScene() {
  const scene = new Scene();
  scene.background = skyTexture();
  scene.fog = new Fog(HORIZON, 60, 330);

  scene.add(new HemisphereLight('#c7a0ff', '#2a0640', 1.2));
  const sunLight = new DirectionalLight('#ffd0f0', 1.4);
  sunLight.position.set(2, 6, 4);
  scene.add(sunLight);

  const sun = makeSun();
  const stars = makeStars();
  const mountains = makeMountains();
  const grid = makeGrid();
  const road = makeRoad();
  scene.add(stars.points, sun, mountains, grid.group, road.group);

  const gridColor = GRID_COLORS[0].clone();
  const edgeColor = EDGE_COLORS[0].clone();
  let targetLevel = 0;

  return {
    scene,
    setLevel(level) {
      targetLevel = level;
    },
    // distance: distancia total recorrida (desplaza cuadrícula y línea central)
    // beatPulse: 1 justo en el golpe del bombo, cae a 0 antes del siguiente
    update(distance, dt, time, beatPulse) {
      grid.across.position.z = distance % GRID_CELL;
      road.dashes.position.z = distance % DASH_PERIOD;
      sun.material.uniforms.uTime.value = time;
      sun.scale.setScalar(70 * (1 + beatPulse * 0.015));
      stars.update(time);

      const k = Math.min(1, dt * 6);
      gridColor.lerp(GRID_COLORS[targetLevel], k);
      grid.material.color.copy(gridColor).multiplyScalar(0.75 + beatPulse * 0.6);
      edgeColor.lerp(EDGE_COLORS[targetLevel], k);
      road.edgeMat.color.copy(edgeColor).multiplyScalar(0.85 + beatPulse * 0.5);
    },
  };
}
