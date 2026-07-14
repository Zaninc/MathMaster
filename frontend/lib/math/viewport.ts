export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const DEFAULT_VIEWPORT: Viewport = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };

export function panViewport(viewport: Viewport, dxData: number, dyData: number): Viewport {
  return {
    xMin: viewport.xMin + dxData,
    xMax: viewport.xMax + dxData,
    yMin: viewport.yMin + dyData,
    yMax: viewport.yMax + dyData,
  };
}

/** `factor` < 1 aproxima (zoom in), `factor` > 1 afasta (zoom out) — sempre em torno do centro atual do viewport (V1 não ancora o zoom no ponteiro, decisão de escopo para reduzir risco de bug). */
export function zoomViewport(viewport: Viewport, factor: number): Viewport {
  const centerX = (viewport.xMin + viewport.xMax) / 2;
  const centerY = (viewport.yMin + viewport.yMax) / 2;
  const halfWidth = ((viewport.xMax - viewport.xMin) / 2) * factor;
  const halfHeight = ((viewport.yMax - viewport.yMin) / 2) * factor;
  return {
    xMin: centerX - halfWidth,
    xMax: centerX + halfWidth,
    yMin: centerY - halfHeight,
    yMax: centerY + halfHeight,
  };
}

export function dataToPixelX(x: number, viewport: Viewport, width: number): number {
  return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
}

export function dataToPixelY(y: number, viewport: Viewport, height: number): number {
  return height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * height;
}

export function pixelToDataX(px: number, viewport: Viewport, width: number): number {
  return viewport.xMin + (px / width) * (viewport.xMax - viewport.xMin);
}

export function pixelToDataY(py: number, viewport: Viewport, height: number): number {
  return viewport.yMax - (py / height) * (viewport.yMax - viewport.yMin);
}

/** Algoritmo padrão de "números redondos" para espaçamento de grade (passo em {1,2,5}×10ⁿ), visando ~`targetCount` linhas visíveis. */
export function niceStep(range: number, targetCount = 8): number {
  const safeRange = range > 0 ? range : 1;
  const rawStep = safeRange / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;

  return niceResidual * magnitude;
}

/**
 * Expande (nunca encolhe) o eixo de dados "que sobra" para que a proporção
 * dos dados (xRange/yRange) case com a proporção real em pixels do
 * container medido — permite o canvas preencher 100% do espaço disponível
 * sem letterboxing E sem distorcer círculos/proporções (mesma técnica de
 * Desmos/GeoGebra). Mantém o centro fixo. No-op se o container ainda não
 * foi medido (`pixelWidth`/`pixelHeight` <= 0).
 */
export function fitViewportToAspect(viewport: Viewport, pixelWidth: number, pixelHeight: number): Viewport {
  if (pixelWidth <= 0 || pixelHeight <= 0) return viewport;

  const dataWidth = viewport.xMax - viewport.xMin;
  const dataHeight = viewport.yMax - viewport.yMin;
  const dataAspect = dataWidth / dataHeight;
  const pixelAspect = pixelWidth / pixelHeight;

  if (Math.abs(dataAspect - pixelAspect) < 1e-9) return viewport;

  const centerX = (viewport.xMin + viewport.xMax) / 2;
  const centerY = (viewport.yMin + viewport.yMax) / 2;

  if (dataAspect < pixelAspect) {
    const newHalfWidth = (dataHeight * pixelAspect) / 2;
    return { ...viewport, xMin: centerX - newHalfWidth, xMax: centerX + newHalfWidth };
  }

  const newHalfHeight = dataWidth / pixelAspect / 2;
  return { ...viewport, yMin: centerY - newHalfHeight, yMax: centerY + newHalfHeight };
}

export function buildGridValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max; value += step) {
    values.push(Number(value.toFixed(6)));
  }
  return values;
}
