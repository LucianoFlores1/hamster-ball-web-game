// Música synthwave generada por código, por capas que reaccionan a la partida:
//   menú   → pad + arpegio suave, filtrado
//   juego  → + bombo, bajo, platillos; con el multiplicador se suman caja, semicorcheas,
//            se abre el filtro y a partir de x6 entra la melodía
//   fin    → se apagan la batería y el bajo, el filtro se cierra (sonido "bajo el agua")
// Expone el pulso (`beat()`) para que lo visual lata con la música.

const BPM = 118;
export const SECONDS_PER_BEAT = 60 / BPM;
const STEP = SECONDS_PER_BEAT / 4; // semicorchea
const LOOKAHEAD = 0.15;

// La menor, Fa, Do, Sol: raíz MIDI y tríada
const CHORDS = [
  [57, [0, 3, 7]],
  [53, [0, 4, 7]],
  [48, [0, 4, 7]],
  [55, [0, 4, 7]],
];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createMusic(ctx, out, noise) {
  // ---------- ruteo ----------
  // instrumentos melódicos → duck (bombeo con el bombo) → filtro → salida
  const duck = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.9;
  duck.connect(filter).connect(out);

  // eco en corcheas con puntillo para arpegio y melodía
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.33;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2400;
  delay.connect(delayTone).connect(feedback).connect(delay);
  delayTone.connect(duck);

  const drums = ctx.createGain();
  drums.connect(out);

  const layer = (dest, value = 0) => {
    const g = ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  };
  const pad = layer(duck, 0.5);
  const arp = layer(duck, 0.35);
  const arpSend = ctx.createGain();
  arpSend.gain.value = 0.35;
  arp.connect(arpSend).connect(delay);
  const bass = layer(duck);
  const lead = layer(duck);
  const leadSend = ctx.createGain();
  leadSend.gain.value = 0.45;
  lead.connect(leadSend).connect(delay);
  const kick = layer(drums);
  const snare = layer(drums);
  const hat = layer(drums);

  // ---------- instrumentos ----------
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function osc(type, freq, t, dur, peak, dest, attack = 0.005, detune = 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    env(g, t, attack, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  function noiseHit(t, dur, peak, type, freq, dest, q = 0.8) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, 0.002, peak, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.05);
  }

  function playKick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    env(g, t, 0.002, 1, 0.34);
    o.connect(g).connect(kick);
    o.start(t);
    o.stop(t + 0.4);
    noiseHit(t, 0.012, 0.25, 'highpass', 3000, kick);
    // bombeo: los demás instrumentos bajan y vuelven
    duck.gain.setValueAtTime(0.4, t);
    duck.gain.linearRampToValueAtTime(1, t + 0.24);
  }

  function playSnare(t) {
    noiseHit(t, 0.17, 0.5, 'bandpass', 1900, snare, 0.7);
    osc('triangle', 185, t, 0.09, 0.35, snare);
  }

  function playHat(t, open) {
    noiseHit(t, open ? 0.14 : 0.035, open ? 0.18 : 0.14, 'highpass', 7500, hat);
  }

  function playBass(t, freq) {
    const o = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    sub.type = 'square';
    o.frequency.value = freq;
    sub.frequency.value = freq / 2;
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(220, t + STEP * 1.6);
    env(g, t, 0.004, 0.32, STEP * 1.8);
    o.connect(f);
    sub.connect(f);
    f.connect(g).connect(bass);
    o.start(t);
    sub.start(t);
    o.stop(t + STEP * 2.2);
    sub.stop(t + STEP * 2.2);
  }

  function playPad(t, root, tones, dur) {
    for (const tone of tones) {
      const f = midi(root + tone);
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.35);
        g.gain.setValueAtTime(0.045, t + dur - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
        o.connect(g).connect(pad);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
  }

  // ---------- estado ----------
  let mode = 'menu';
  let level = 0;
  let speedFrac = 0;
  let t0 = 0;
  let nextTime = 0;
  let step = 0;
  let timer = null;

  const fade = (param, v, tc = 0.25) => param.setTargetAtTime(v, ctx.currentTime, tc);

  function applyMix() {
    const playing = mode === 'play';
    fade(kick.gain, playing ? 0.9 : 0, playing ? 0.05 : 0.08);
    fade(bass.gain, playing ? 0.85 : 0, playing ? 0.1 : 0.15);
    fade(hat.gain, playing ? 0.8 : 0, 0.1);
    fade(snare.gain, playing && (level >= 1 || speedFrac > 0.35) ? 0.75 : 0, 0.15);
    fade(lead.gain, playing && level >= 4 ? 0.5 : 0, 0.4);
    fade(arp.gain, mode === 'over' ? 0.2 : 0.35, 0.3);
    let cutoff;
    if (mode === 'menu') cutoff = 900;
    else if (mode === 'over') cutoff = 380;
    else cutoff = 1400 + level * 900 + speedFrac * 1600;
    fade(filter.frequency, cutoff, mode === 'over' ? 0.12 : 0.3);
  }

  function schedule(t, s) {
    const bar = Math.floor(s / 16);
    const [root, tones] = CHORDS[bar % CHORDS.length];
    const i = s % 16;
    const playing = mode === 'play';

    if (i === 0) playPad(t, root, tones, STEP * 16);

    // arpegio: corcheas en el menú, semicorcheas jugando
    if (playing || i % 2 === 0) {
      const pattern = [0, 1, 2, 1];
      const tone = tones[pattern[i % 4]] + (i >= 8 ? 12 : 0);
      osc('square', midi(root + 12 + tone), t, STEP * 0.8, 0.06, arp);
    }

    if (playing) {
      if (i % 4 === 0) playKick(t);
      if (i % 2 === 0) playBass(t, midi(root - 24 + (i % 4 === 2 ? 12 : 0)));
      if (i % 4 === 2) playHat(t, i === 14);
      else if (level >= 3 && i % 2 === 1) playHat(t, false);
      if (i === 4 || i === 12) playSnare(t);
      if (level >= 5 && (i === 14 || i === 15) && bar % 2 === 1) playSnare(t); // redoble en x8

      // melodía (motivo de 1 compás sobre las notas del acorde, varía cada 2 ciclos)
      const variant = Math.floor(bar / 4) % 2;
      const motif = variant
        ? [[0, 2, 4], [4, 1, 2], [6, 0, 2], [8, 2, 6], [14, 1, 2]]
        : [[0, 1, 3], [3, 2, 3], [6, 1, 2], [8, 0, 4], [12, 2, 4]];
      for (const [at, idx, len] of motif) {
        if (at === i) osc('square', midi(root + 24 + tones[idx]), t, STEP * len * 0.9, 0.07, lead, 0.01, 4);
      }
    }
  }

  function tick() {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // si el temporizador se atrasó, saltar pasos enteros para no perder la grilla
    while (nextTime < now) {
      nextTime += STEP;
      step++;
    }
    while (nextTime < now + LOOKAHEAD) {
      schedule(nextTime, step);
      nextTime += STEP;
      step++;
    }
  }

  return {
    start() {
      if (timer) return;
      t0 = nextTime = ctx.currentTime + 0.1;
      step = 0;
      applyMix();
      timer = setInterval(tick, 25);
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      applyMix();
    },
    setIntensity(l, s) {
      const sNorm = Math.round(s * 10) / 10;
      if (l === level && sNorm === speedFrac) return;
      level = l;
      speedFrac = sNorm;
      applyMix();
    },
    // Pulso actual en negras (entero = golpe de bombo).
    beat() {
      return (ctx.currentTime - t0) / SECONDS_PER_BEAT;
    },
  };
}
