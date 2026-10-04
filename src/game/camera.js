// Cámara detrás y arriba de la pelota. Se aleja en pantallas angostas para que los dos
// carriles siempre entren completos; abre el FOV con la velocidad y tiembla en los roces.
// Animaciones: vuelo lento en el menú, bajada en picada al empezar, golpe de FOV en roces,
// inclinación al cambiar de carril y acercamiento al chocar.

import { PerspectiveCamera, MathUtils } from 'three';
import { CONFIG } from '../config.js';

const BASE_OFFSET = { y: 3.4, z: 7.2 }; // posición respecto de la pelota en pantalla ancha
const LOOK_AHEAD = 12;
const VISIBLE_HALF_WIDTH = CONFIG.lanes.width + 1.4; // ruta + margen

const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function createCameraRig() {
  const camera = new PerspectiveCamera(CONFIG.fx.baseFov, 1, 0.1, 700);
  let aspect = 1;
  let trauma = 0;
  let shakeTime = 0;
  let followX = 0;
  let prevBallX = 0;
  let roll = 0;
  let fovKick = 0;
  let menuBlend = 1;
  let deadBlend = 0;
  let time = 0;

  return {
    camera,
    resize(w, h) {
      aspect = w / h;
      camera.aspect = aspect;
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    // Golpe de FOV (grados), vuelve solo.
    punch(degrees) {
      fovKick += degrees;
    },
    // mode: 'menu' | 'play' | 'dead'. speedFrac: 0 a 1. ballX: posición lateral.
    update(dt, speedFrac, ballX, mode) {
      time += dt;
      // al empezar, la cámara baja del plano de menú con una curva rápida
      menuBlend = approach(menuBlend, mode === 'menu' ? 1 : 0, mode === 'menu' ? 1.5 : 4.5, dt);
      deadBlend = approach(deadBlend, mode === 'dead' ? 1 : 0, mode === 'dead' ? 2.5 : 6, dt);
      fovKick = approach(fovKick, 0, 7, dt);

      const fov = CONFIG.fx.baseFov + CONFIG.fx.fovBoost * speedFrac + fovKick - deadBlend * 10 + menuBlend * 6;
      camera.fov = fov;

      // Distancia necesaria para que el ancho visible a la altura de la pelota alcance.
      const dist0 = Math.hypot(BASE_OFFSET.y, BASE_OFFSET.z);
      const tanHalf = Math.tan(MathUtils.degToRad(fov / 2));
      const needed = VISIBLE_HALF_WIDTH / (tanHalf * aspect);
      const scale = Math.max(1, needed / dist0);

      // seguir un poco el carril, sin perder de vista el otro; inclinarse con el movimiento
      followX = approach(followX, ballX * 0.35, 8, dt);
      const vx = dt > 0 ? (ballX - prevBallX) / dt : 0;
      prevBallX = ballX;
      roll = approach(roll, MathUtils.clamp(-vx * 0.006, -0.06, 0.06), 10, dt);

      trauma = Math.max(0, trauma - dt * 2.2);
      shakeTime += dt;
      const s = trauma * trauma * 0.6;
      const sx = s * (Math.sin(shakeTime * 71) + Math.sin(shakeTime * 43)) * 0.5;
      const sy = s * (Math.sin(shakeTime * 59) + Math.sin(shakeTime * 37)) * 0.5;

      // menú: más alto, balanceo lento de lado a lado
      const swayX = Math.sin(time * 0.35) * 1.6 * menuBlend;
      const lift = menuBlend * 1.6;
      // muerte: se acerca al lugar del choque
      const closer = 1 - deadBlend * 0.35;

      camera.position.set(
        followX + sx + swayX,
        (BASE_OFFSET.y * scale + lift) * closer + sy,
        BASE_OFFSET.z * scale * closer + menuBlend * 1.5,
      );
      camera.lookAt(followX * 0.6 + swayX * 0.3, 0.4 + menuBlend * 1.2, -LOOK_AHEAD);
      camera.rotateZ(roll + Math.sin(time * 0.5) * 0.02 * menuBlend);
      camera.updateProjectionMatrix();
    },
  };
}
