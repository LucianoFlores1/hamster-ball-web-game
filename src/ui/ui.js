// HUD y pantallas (HTML/CSS sobre el canvas).

const $ = (id) => document.getElementById(id);

export function createUI() {
  const el = {
    hud: $('hud'),
    score: $('score'),
    mult: $('mult'),
    multValue: $('mult-value'),
    multFill: $('mult-fill'),
    pop: $('graze-pop'),
    flash: $('flash'),
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

  function only(screen) {
    for (const s of screens) s.classList.toggle('hidden', s !== screen);
  }

  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reinicia la animación CSS
    node.classList.add(cls);
  }

  return {
    el,
    showMenu(best) {
      el.menuBest.textContent = best;
      el.hud.classList.add('hidden');
      only(el.menu);
    },
    showPlaying() {
      el.hud.classList.remove('hidden');
      only(null);
    },
    showPaused() {
      only(el.paused);
    },
    showAdWait() {
      only(el.adWait);
    },
    showGameOver({ score, best, isNewBest, canContinue }) {
      el.hud.classList.add('hidden');
      el.overScore.textContent = score;
      el.overBest.textContent = best;
      el.overNew.classList.toggle('hidden', !isNewBest);
      el.btnContinue.classList.toggle('hidden', !canContinue);
      only(el.over);
    },
    updateHud(score, level, multValue, timeLeft) {
      if (score !== shownScore) {
        el.score.textContent = score;
        shownScore = score;
      }
      if (level !== shownLevel) {
        el.mult.className = `level-${level}`;
        el.multValue.textContent = `x${multValue}`;
        shownLevel = level;
      }
      el.multFill.style.width = `${Math.round(timeLeft * 100)}%`;
    },
    graze(level, bonus, color) {
      restart(el.mult, 'bump');
      el.pop.textContent = `+${bonus}`;
      el.pop.style.color = color;
      restart(el.pop, 'on');
      el.flash.style.setProperty('--flash-color', color);
      el.flash.style.setProperty('--flash-strength', String(0.18 + level * 0.07));
      restart(el.flash, 'on');
    },
    setMuted(muted) {
      el.btnMute.textContent = muted ? '🔇' : '🔊';
      el.btnMute.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
    },
  };
}
