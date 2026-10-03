// Sonido generado con Web Audio API: sin archivos. El contexto se crea con la primera
// interacción del usuario (política de los navegadores).

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]; // pentatónica menor, en semitonos

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noise = null;
  let muted = false;
  let platformEnabled = true;
  let paused = false;
  let music = null;

  function applyVolume() {
    if (!master) return;
    const on = !muted && platformEnabled;
    master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
  }

  function noiseBuffer() {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(gainNode, t, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function ready() {
    return ctx && ctx.state === 'running' && !paused;
  }

  // ---------- música (opcional): bajo + arpegio synthwave ----------
  const CHORDS = [ // La menor, Fa, Do, Sol (raíces MIDI)
    [57, [0, 3, 7]], [53, [0, 4, 7]], [48, [0, 4, 7]], [55, [0, 4, 7]],
  ];
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);

  function note(type, freq, t, dur, peak, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    env(g, t, 0.005, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function startMusic() {
    if (music || !ctx) return;
    const bpm = 112;
    const step = 60 / bpm / 4; // semicorchea
    let nextTime = ctx.currentTime + 0.1;
    let i = 0;
    const timer = setInterval(() => {
      if (!ready()) {
        nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
        return;
      }
      while (nextTime < ctx.currentTime + 0.12) {
        const bar = Math.floor(i / 16) % CHORDS.length;
        const [root, tones] = CHORDS[bar];
        const s = i % 16;
        if (s % 2 === 0) note('sawtooth', midi(root - 24 + (s % 4 === 2 ? 12 : 0)), nextTime, step * 1.6, 0.11, musicBus);
        const arp = tones[s % 3] + (s % 6 >= 3 ? 12 : 0);
        note('triangle', midi(root + 12 + arp), nextTime, step * 0.9, 0.05, musicBus);
        nextTime += step;
        i++;
      }
    }, 25);
    music = { timer };
  }

  return {
    // Llamar desde un gesto del usuario.
    unlock() {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.55;
        // filtro para suavizar el serrucho del bajo
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        musicBus.connect(lp).connect(master);
        noise = noiseBuffer();
        applyVolume();
        startMusic();
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

    whoosh() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
      const g = ctx.createGain();
      env(g, t, 0.01, 0.35, 0.13);
      src.connect(f).connect(g).connect(sfxBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.2);
    },

    // Nota ascendente según el nivel del multiplicador.
    graze(level) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const freq = 523.25 * 2 ** (SCALE[Math.min(level, SCALE.length - 1)] / 12);
      note('square', freq, t, 0.18, 0.09 + level * 0.015, sfxBus);
      note('sine', freq * 2, t + 0.04, 0.25, 0.08 + level * 0.02, sfxBus);
      if (level >= 4) note('sine', freq * 3, t + 0.08, 0.3, 0.06, sfxBus);
    },

    crash() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(35, t + 0.55);
      env(g, t, 0.005, 0.9, 0.6);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 0.7);

      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2000, t);
      lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
      const ng = ctx.createGain();
      env(ng, t, 0.005, 0.6, 0.5);
      src.connect(lp).connect(ng).connect(sfxBus);
      src.start(t);
      src.stop(t + 0.6);
    },
  };
}
