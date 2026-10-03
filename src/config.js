// Todos los valores ajustables del juego. Tiempos en segundos, distancias en unidades del mundo.

export const CONFIG = {
  // Carriles y cambio de carril
  lanes: {
    width: 2.4, // distancia entre centros de carril
    switchDuration: 0.15, // animación completa del cambio
    logicalSwitchAt: 0.5, // fracción de la animación en la que cambia el carril lógico
  },

  // Roce al ras
  graze: {
    window: 0.25, // tiempo hasta el impacto máximo para contar como roce
    bonus: 50, // puntos por roce (se multiplican por el multiplicador nuevo)
  },

  // Multiplicador
  multiplier: {
    levels: [1, 2, 3, 4, 6, 8],
    resetAfter: 3, // segundos sin roces hasta volver a x1
  },

  // Puntaje por distancia
  scoring: {
    pointsPerUnit: 0.5,
  },

  // Dificultad (en función del tiempo de partida)
  difficulty: {
    startSpeed: 22,
    maxSpeed: 46,
    speedRampTime: 90, // segundos hasta llegar a la velocidad máxima
    startGap: 1.2, // separación inicial entre bloques (s)
    minGap: 0.55, // separación mínima a la que llega la curva (s)
    gapRampTime: 100,
    zigzagStartTime: 12, // desde cuándo pueden aparecer zigzags
    zigzagChanceStart: 0.08,
    zigzagChanceMax: 0.3,
    zigzagLength: [4, 7], // cantidad de bloques (mín, máx)
    zigzagGap: 0.42, // separación dentro del zigzag (s), se respeta el mínimo de abajo
  },

  // Regla 4: separación mínima entre bloques consecutivos de carriles distintos,
  // medida a la velocidad máxima.
  minSwitchGap: 0.4,
  // Separación mínima entre bloques consecutivos del mismo carril (s, a velocidad máxima).
  minSameLaneGap: 0.2,

  // Generación
  spawnDistance: 140, // a qué distancia delante de la pelota aparecen los bloques
  firstBlockDelay: 1.6, // segundos hasta el primer bloque

  // Continuar con anuncio
  revive: {
    clearAhead: 2.0, // se eliminan los bloques que llegan en menos de esto (s)
    invulnerability: 1.5,
  },

  // Sensación
  fx: {
    slowMoScale: 0.2,
    slowMoDuration: 0.4, // segundos reales
    baseFov: 62,
    fovBoost: 12, // grados extra a velocidad máxima
    shakeOnGraze: 0.18,
    sparksPerGraze: 26,
    replayLockout: 0.5, // segundos tras el fin en que se ignoran toques (evita reinicios accidentales)
  },

  // Bucle
  maxFrameDt: 0.05,
  simStep: 1 / 120,

  // Anuncios
  ads: {
    interstitialEveryDeaths: 3,
  },

  saveVersion: 1,
};
