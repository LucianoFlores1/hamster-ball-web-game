// Colores por nivel de multiplicador (x1 … x8), compartidos por escena, efectos e interfaz.

import { Color } from 'three';

export const LEVEL_HEX = ['#3ff0ff', '#b06bff', '#ff2fd0', '#ff4f9a', '#ff7a59', '#ffc23d'];
export const LEVEL_COLORS = LEVEL_HEX.map((c) => new Color(c));
