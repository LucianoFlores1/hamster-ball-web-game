// Sonido generado con Web Audio API: sin archivos. El contexto se crea con la primera
// interacción del usuario (política de los navegadores). La música vive en music.js.

import { createMusic, SECONDS_PER_BEAT } from './music.js';

// La menor pentatónica desde La4: cada roce seguido sube un escalón.
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let music = null;
  let noise = null;
  let muted = false;
  let platformEnabled = true;
  let paused = false;
  let pendingMode = 'menu';
  const startedAt = performance.now();

  function applyVolume() {
    if (!master) return;
    const on = !muted && platformEnabled;
    master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02);
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  // Con el contexto recién creado (todavía 'suspended' hasta que resuelve resume()),
  // igual se programa: suena apenas arranca. Así el primer toque ya tiene sonido.
  function ready() {
    return ctx && ctx.state !== 'closed' && !paused;
  }

  // Salida con paneo (-1 izquierda, 1 derecha), si el navegador lo soporta.
  function panned(pan) {
    if (!pan || !ctx.createStereoPanner) return sfxBus;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(sfxBus);
    return p;
  }

  function tone(type, freq, t, dur, peak, dest = sfxBus, { attack = 0.004, glideTo = 0, detune = 0 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + dur);
    o.detune.value = detune;
    env(g, t, attack, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  function noiseSweep(t, dur, peak, type, from, to, dest = sfxBus, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, Math.min(0.02, dur * 0.3), peak, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.1);
  }

  return {
    // Llamar desde un gesto del usuario.
    unlock() {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        // compresor final: más "pegada" y nada satura
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(comp).connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.connect(master);
        const musicBus = ctx.createGain();
        musicBus.gain.value = 0.5;
        musicBus.connect(master);
        noise = noiseBuffer();
        music = createMusic(ctx, musicBus, noise);
        music.setMode(pendingMode);
        applyVolume();
        music.start();
      }
      if (ctx.state === 'suspended' && !paused) ctx.resume();
    },
    setMuted(m) {
      muted = m;
      applyVolume();
    },
    setPlatformEnabled(on) {
      platformEnabled = on;
      applyVolume();
    },
    pause() {
      paused = true;
      if (ctx && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      paused = false;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },

    // ---------- música ----------
    setMode(mode) {
      pendingMode = mode;
      music?.setMode(mode);
    },
    setIntensity(level, speedFrac) {
      music?.setIntensity(level, speedFrac);
    },
    // Pulso en negras; sin audio, sigue un reloj propio al mismo tempo.
    beat() {
      if (music && ctx.state === 'running') return music.beat();
      return (performance.now() - startedAt) / 1000 / SECONDS_PER_BEAT;
    },

    // ---------- efectos ----------
    // Cambio de carril: soplido que viaja hacia el carril de destino.
    whoosh(toLane) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const out = panned(toLane === 1 ? 0.45 : -0.45);
      noiseSweep(t, 0.13, 0.3, 'bandpass', 450 + Math.random() * 100, 2800, out, 1.4);
      tone('sine', 220, t, 0.08, 0.06, out, { glideTo: 330 });
    },

    // Roce: nota que sube con cada roce seguido + brillo + golpe grave.
    graze(level, combo, side) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const out = panned(side * 0.5);
      const f = midi(PENTA[Math.min(combo - 1, PENTA.length - 1)]);
      const vol = 0.1 + level * 0.018;
      tone('square', f, t, 0.16, vol, out);
      tone('sine', f * 2, t + 0.03, 0.3, vol * 0.9, out);
      tone('triangle', f * 3, t + 0.06, 0.35, vol * 0.5, out, { detune: 7 });
      tone('sine', 110, t, 0.12, 0.25, sfxBus, { glideTo: 55 }); // golpe
      noiseSweep(t, 0.08, 0.12 + level * 0.03, 'highpass', 6000, 9000, out);
    },

    // Llegar a x8: acorde que sube + barrido.
    maxLevel() {
      if (!ready()) return;
      const t = ctx.currentTime;
      noiseSweep(t, 0.5, 0.18, 'bandpass', 800, 9000, sfxBus, 2);
      [69, 72, 76, 81, 84].forEach((n, i) => tone('square', midi(n), t + i * 0.045, 0.35, 0.06));
      tone('sawtooth', midi(57), t, 0.6, 0.08, sfxBus, { attack: 0.05 });
    },

    // Se perdió el multiplicador.
    multLost() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone('sawtooth', 330, t, 0.28, 0.05, sfxBus, { glideTo: 120 });
      tone('sine', 220, t, 0.25, 0.08, sfxBus, { glideTo: 90 });
    },

    crash() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone('sine', 150, t, 0.75, 1, sfxBus, { glideTo: 30 });
      tone('square', 90, t, 0.25, 0.15, sfxBus, { glideTo: 40 });
      noiseSweep(t, 0.6, 0.7, 'lowpass', 3000, 100, sfxBus);
      // vidrio: astillas agudas desparramadas
      for (let i = 0; i < 7; i++) {
        const dt = 0.01 + Math.random() * 0.25;
        noiseSweep(t + dt, 0.05 + Math.random() * 0.08, 0.12, 'bandpass', 3000 + Math.random() * 6000, 9000, panned(Math.random() * 2 - 1), 8);
      }
    },

    // Empezar partida: barrido ascendente.
    start() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone('sawtooth', 160, t, 0.35, 0.09, sfxBus, { glideTo: 1100 });
      noiseSweep(t, 0.35, 0.12, 'bandpass', 400, 6000, sfxBus, 1.5);
      tone('square', midi(81), t + 0.3, 0.2, 0.06);
    },

    revive() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone('sawtooth', 120, t, 0.5, 0.1, sfxBus, { glideTo: 900 });
      [69, 76, 81, 88].forEach((n, i) => tone('square', midi(n), t + 0.1 + i * 0.06, 0.25, 0.06));
    },

    // Superaste tu récord (durante la partida o al terminar).
    newBest() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [69, 73, 76, 81].forEach((n, i) => {
        tone('square', midi(n), t + i * 0.08, 0.18, 0.08);
        tone('sine', midi(n + 12), t + i * 0.08, 0.25, 0.05);
      });
      tone('square', midi(88), t + 0.32, 0.6, 0.08, sfxBus, { detune: 6 });
      noiseSweep(t + 0.32, 0.4, 0.1, 'highpass', 5000, 10000);
    },

    gameOver() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [76, 74, 69].forEach((n, i) => tone('triangle', midi(n), t + i * 0.14, 0.3, 0.1));
    },

    // Conteo del puntaje final.
    tick(progress) {
      if (!ready()) return;
      tone('square', 600 + progress * 900, ctx.currentTime, 0.025, 0.035);
    },

    click() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone('sine', 880, t, 0.06, 0.12, sfxBus, { glideTo: 1320 });
    },
  };
}
