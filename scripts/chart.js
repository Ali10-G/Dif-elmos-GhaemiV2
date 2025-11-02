const DEFAULT_SPAN = 4;

export function renderSolutionChart(canvas, derivativeFn, options = {}) {
  if (!canvas || typeof derivativeFn !== 'function') {
    if (canvas) clearChart(canvas);
    return { success: false, notice: 'ورودی نامعتبر برای نمودار.' };
  }
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const span = options.span || DEFAULT_SPAN;
  const x0 = options.x0 ?? 0;
  const y0 = options.y0 ?? 1;
  const forwardPoints = integrateDirection(derivativeFn, x0, y0, span, 160, 1);
  const backwardPoints = integrateDirection(derivativeFn, x0, y0, span, 160, -1);
  backwardPoints.reverse();
  const points = [...backwardPoints, { x: x0, y: y0 }, ...forwardPoints];
  const filtered = points.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (filtered.length < 2) {
    return { success: false, notice: 'اطلاعات کافی برای رسم نمودار در دسترس نبود.' };
  }
  const xValues = filtered.map((p) => p.x);
  const yValues = filtered.map((p) => p.y);
  let xMin = Math.min(...xValues);
  let xMax = Math.max(...xValues);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (xMax === xMin) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMax === yMin) {
    yMin -= 1;
    yMax += 1;
  }
  const padding = 45;
  const xScale = (width - 2 * padding) / (xMax - xMin);
  const yScale = (height - 2 * padding) / (yMax - yMin);
  ctx.save();
  ctx.translate(0.5, 0.5);
  drawBackground(ctx, width, height);
  const config = { padding, width, height, xScale, yScale, xMin, yMin, x0, y0 };
  drawAxes(ctx, { xMin, xMax, yMin, yMax }, config);
  drawCurve(ctx, filtered, config);
  ctx.restore();
  const notice = `نمودار با شرط اولیه (${formatNumber(x0)}, ${formatNumber(y0)}) رسم شد.`;
  return { success: true, notice };
}

export function clearChart(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function integrateDirection(f, x0, y0, span, steps, direction) {
  const h = (span / steps) * direction;
  let x = x0;
  let y = y0;
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const next = rungeKuttaStep(f, x, y, h);
    if (!Number.isFinite(next.y)) break;
    x = next.x;
    y = next.y;
    pts.push({ x, y });
  }
  return pts;
}

function rungeKuttaStep(f, x, y, h) {
  const k1 = safeEval(f, x, y);
  const k2 = safeEval(f, x + h / 2, y + (h * k1) / 2);
  const k3 = safeEval(f, x + h / 2, y + (h * k2) / 2);
  const k4 = safeEval(f, x + h, y + h * k3);
  const nextY = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  const nextX = x + h;
  if (!Number.isFinite(nextY)) {
    return { x: nextX, y: Number.NaN };
  }
  return { x: nextX, y: nextY };
}

function safeEval(f, x, y) {
  const value = f(x, y);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function drawBackground(ctx, width, height) {
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface') || '#fff';
  ctx.fillRect(0, 0, width, height);
}

function drawAxes(ctx, range, config) {
  const { padding, width, height, xScale, yScale, xMin, yMin } = {
    padding: config.padding,
    width: config.width,
    height: config.height,
    xScale: config.xScale,
    yScale: config.yScale,
    xMin: range.xMin,
    yMin: range.yMin
  };
  const accent = getComputedStyle(document.body).getPropertyValue('--accent') || '#4c6ef5';
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border') || 'rgba(0,0,0,0.2)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = Math.ceil(range.xMin); i <= Math.floor(range.xMax); i += 1) {
    const x = padding + (i - range.xMin) * xScale;
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
  }
  for (let j = Math.ceil(range.yMin); j <= Math.floor(range.yMax); j += 1) {
    const y = height - padding - (j - range.yMin) * yScale;
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
  }
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (range.yMin < 0 && range.yMax > 0) {
    const zeroY = height - padding - (0 - range.yMin) * yScale;
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(width - padding, zeroY);
  }
  if (range.xMin < 0 && range.xMax > 0) {
    const zeroX = padding + (0 - range.xMin) * xScale;
    ctx.moveTo(zeroX, padding);
    ctx.lineTo(zeroX, height - padding);
  }
  ctx.stroke();
}

function drawCurve(ctx, points, config) {
  const accent = getComputedStyle(document.body).getPropertyValue('--accent') || '#4c6ef5';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((pt, index) => {
    const canvasPoint = toCanvas(pt, config);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  ctx.stroke();
  ctx.fillStyle = accent;
  const origin = toCanvas({ x: config.x0, y: config.y0 }, config);
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function toCanvas(point, config) {
  const { padding, xMin, yMin, xScale, yScale } = config;
  const x = padding + (point.x - xMin) * xScale;
  const y = config.height - padding - (point.y - yMin) * yScale;
  return { x, y };
}

function formatNumber(value) {
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }
  return Number(value.toFixed(2));
}
