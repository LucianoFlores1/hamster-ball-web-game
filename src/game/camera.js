// Cámara detrás y arriba de la pelota. Se aleja en pantallas angostas para que los dos
// carriles siempre entren completos; abre el FOV con la velocidad y tiembla en los roces.

import { PerspectiveCamera, MathUtils } from 'three';
import { CONFIG } from '../config.js';

const BASE_OFFSET = { y: 3.4, z: 7.2 }; // posición respecto de la pelota en pantalla ancha
const LOOK_AHEAD = 12;
const VISIBLE_HALF_WIDTH = CONFIG.lanes.width + 1.4; // ruta + margen

export function createCameraRig() {
  const camera = new PerspectiveCamera(CONFIG.fx.baseFov, 1, 0.1, 700);
  let aspect = 1;
  let trauma = 0;
  let shakeTime = 0;
  let followX = 0;

  return {
    camera,
    resize(w, h) {
      aspect = w / h;
      camera.aspect = aspect;
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    // speedFrac: 0 a velocidad inicial, 1 a velocidad máxima. ballX: posición lateral de la pelota.
    update(dt, speedFrac, ballX) {
      const fov = CONFIG.fx.baseFov + CONFIG.fx.fovBoost * speedFrac;
      camera.fov = fov;

      // Distancia necesaria para que el ancho visible a la altura de la pelota alcance.
      const dist0 = Math.hypot(BASE_OFFSET.y, BASE_OFFSET.z);
      const tanHalf = Math.tan(MathUtils.degToRad(fov / 2));
      const needed = VISIBLE_HALF_WIDTH / (tanHalf * aspect);
      const scale = Math.max(1, needed / dist0);

      // seguir un poco el carril, sin perder de vista el otro
      followX += (ballX * 0.35 - followX) * Math.min(1, dt * 8);

      trauma = Math.max(0, trauma - dt * 2.2);
      shakeTime += dt;
      const s = trauma * trauma * 0.6;
      const sx = s * (Math.sin(shakeTime * 71) + Math.sin(shakeTime * 43)) * 0.5;
      const sy = s * (Math.sin(shakeTime * 59) + Math.sin(shakeTime * 37)) * 0.5;

      camera.position.set(followX + sx, BASE_OFFSET.y * scale + sy, BASE_OFFSET.z * scale);
      camera.lookAt(followX * 0.6, 0.4, -LOOK_AHEAD);
      camera.updateProjectionMatrix();
    },
  };
}
