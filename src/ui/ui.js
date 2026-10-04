// HUD y pantallas (HTML/CSS sobre el canvas). Las animaciones viven en style.css;
// acá solo se disparan (reiniciando clases) y se actualizan variables por cuadro.

const $ = (id) => document.getElementById(id);

export function createUI() {
  const el = {
    app: $('app'),
    hud: $('hud'),
    score: $('score'),
    mult: $('mult'),
    multValue: $('mult-value'),
    multFill: $('mult-fill'),
    pop: $('graze-pop'),
    flash: $('flash'),
    vignette: $('vignette'),
    banner: $('banner'),
    menu: $('menu'),
    menuBest: $('menu-best'),
    paused: $('paused'),
    over: $('over'),
    overScore: $('over-score'),
    overBest: $('over-best'),
    overNew: $('over-new'),
    btnContinue: $('btn-continue'),
    btnReplay: $('btn-replay'),
    btnMute: $('btn-mute'),
    adWait: $('ad-wait'),
  };
  const screens = [el.menu, el.paused, el.over, el.adWait];
  let shownScore = -1;
  let shownLevel = -1;
  let warn = false;
  let countToken = 0;

  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reinicia la animación CSS
    node.classList.add(cls);
  }

  function only(screen) {
    for (const s of screens) {
      s.classList.toggle('hidden', s !== screen);
      if (s !== screen) s.classList.remove('enter');
    }
    if (screen) restart(screen, 'enter');
  }

  function flash(color, strength, cls = 'on') {
    el.flash.classList.remove('crash');
    el.flash.style.setProperty('--flash-color', color);
    el.flash.style.setProperty('--flash-strength', String(strength));
    restart(el.flash, 'on');
    if (cls !== 'on') el.flash.classList.add(cls);
  }

  return {
    el,
    showMenu(best) {
      el.menuBest.textContent = best;
      el.hud.classList.add('hidden');
      only(el.menu);
    },
    showPlaying({ fresh = false } = {}) {
      el.hud.classList.remove('hidden');
      if (fresh) {
        restart(el.hud, 'enter');
        shownScore = shownLevel = -1;
      }
      only(null);
    },
    showPaused() {
      only(el.paused);
    },
    showAdWait() {
      only(el.adWait);
    },

    // Fin: el puntaje cuenta desde 0; `onTick(progreso)` para el sonido, `onDone` al terminar.
    showGameOver({ score, best, isNewBest, canContinue }, { onTick, onDone } = {}) {
      el.hud.classList.add('hidden');
      el.overBest.textContent = best;
      el.overNew.classList.add('hidden');
      el.overNew.classList.remove('pop');
      el.btnContinue.classList.toggle('hidden', !canContinue);
      only(el.over);
      el.vignette.style.setProperty('--vig', '0');

      const token = ++countToken;
      const duration = Math.min(1.1, 0.35 + score / 4000);
      const t0 = performance.now();
      let lastTick = 0;
      const step = (now) => {
        if (token !== countToken) return;
        const t = Math.min(1, (now - t0) / 1000 / duration);
        const eased = 1 - (1 - t) ** 3;
        el.overScore.textContent = Math.round(score * eased);
        if (now - lastTick > 55 && t < 1) {
          lastTick = now;
          onTick?.(eased);
        }
        if (t < 1) requestAnimationFrame(step);
        else {
          restart(el.overScore, 'final');
          if (isNewBest) {
            el.overNew.classList.remove('hidden');
            restart(el.overNew, 'pop');
          }
          onDone?.();
        }
      };
      el.overScore.textContent = '0';
      requestAnimationFrame(step);
    },

    // Botón de continuar sin anuncio disponible: se vuelve a mostrar la pantalla sin animar el conteo.
    showGameOverStatic({ score, best }) {
      countToken++;
      el.overScore.textContent = score;
      el.overBest.textContent = best;
      el.btnContinue.classList.add('hidden');
      only(el.over);
    },

    updateHud(score, level, multValue, timeLeft, beatPulse, levelColor) {
      if (score !== shownScore) {
        el.score.textContent = score;
        shownScore = score;
      }
      if (level !== shownLevel) {
        for (let i = 0; i < 6; i++) el.mult.classList.remove(`level-${i}`);
        el.mult.classList.add(`level-${level}`);
        el.multValue.textContent = `x${multValue}`;
        shownLevel = level;
      }
      el.multFill.style.width = `${Math.round(timeLeft * 100)}%`;
      const w = level > 0 && timeLeft < 0.3;
      if (w !== warn) {
        el.mult.classList.toggle('warn', w);
        warn = w;
      }
      // viñeta: crece con el multiplicador y late con la música
      const vig = level === 0 ? 0 : 0.18 + level * 0.09 + beatPulse * 0.12;
      el.vignette.style.setProperty('--vig', vig.toFixed(3));
      el.vignette.style.setProperty('--vig-color', levelColor);
    },
    graze(level, bonus, color) {
      restart(el.mult, 'bump');
      restart(el.score, 'bump');
      el.pop.textContent = `+${bonus}`;
      el.pop.style.color = color;
      restart(el.pop, 'on');
      flash(color, 0.18 + level * 0.07);
    },
    // Cartel grande en el centro.
    banner(text, color, small = false) {
      el.banner.textContent = text;
      el.banner.style.setProperty('--banner-color', color);
      el.banner.classList.toggle('small', small);
      restart(el.banner, 'on');
    },
    multLost() {
      restart(el.mult, 'lost');
    },
    crash() {
      flash('#fff', 0.85, 'crash');
    },
    flash,
    setMuted(muted, animate = false) {
      el.btnMute.textContent = muted ? '🔇' : '🔊';
      el.btnMute.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
      if (animate) restart(el.btnMute, 'spin');
    },
  };
}
