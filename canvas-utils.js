/* ─────────────────────────────────────────────────────────────
   canvas-utils.js — shared canvas drawing utilities
   used by all math-demo pages
   ───────────────────────────────────────────────────────────── */

const DPR = window.devicePixelRatio || 1;

/** Returns true when the OS is in dark mode. */
function isDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Returns a colour palette object that matches the current light/dark mode.
 * Files may override individual colours via their own CSS tokens; this object
 * is used directly in canvas draw calls.
 */
function colors() {
  const d = isDark();
  return {
    bg:      d ? '#161412' : '#fafaf7',
    grid:    d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    axis:    d ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)',
    text:    d ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    axtext:  d ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
    curve:   d ? '#e06040' : '#b84020',
    deriv:   d ? '#5ba3e8' : '#1a5696',
    tangent: d ? '#4ec27a' : '#1e6e3a',
    point:   d ? '#b07ae0' : '#6b3a9e',
    green:   d ? '#4ec27a' : '#1e6e3a',
    purple:  d ? '#b07ae0' : '#6b3a9e',
    amber:   d ? '#f0b040' : '#8a5a00',
    teal:    d ? '#3ecece' : '#0e6e6e',
    aFill:   d ? 'rgba(91,163,232,0.16)'  : 'rgba(26,94,158,0.11)',
    aStroke: d ? '#5ba3e8' : '#1a5696',
    warn:    d ? '#f59e0b' : '#b45309',
  };
}

/**
 * Set up a canvas element for high-DPI rendering.
 * @param {string|HTMLCanvasElement} idOrEl  – element id string or the element itself
 * @param {number} aspectRatio               – height / width ratio (default 0.52)
 * @returns {{ cv, ctx, w, h }} or null if element not found
 */
function setupCanvas(idOrEl, aspectRatio = 0.52) {
  const cv = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!cv) return null;
  const w = cv.offsetWidth;
  const h = Math.round(w * aspectRatio);
  cv.width  = w * DPR;
  cv.height = h * DPR;
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(DPR, DPR);
  return { cv, ctx, w, h };
}

/**
 * Build a coordinate-transform function for a given axis range and canvas size.
 * @returns {function(x, y): [px, py]}
 */
function makeCoords(xRange, yRange, W, H) {
  return function sc(x, y) {
    return [
      (x - xRange[0]) / (xRange[1] - xRange[0]) * W,
      H - (y - yRange[0]) / (yRange[1] - yRange[0]) * H
    ];
  };
}

/**
 * Draw background fill, grid lines, axes, and axis tick labels.
 * Clears the canvas before drawing.
 * @returns the sc() coordinate function so callers can reuse it
 */
function drawGrid(ctx, W, H, xRange, yRange, C, sc) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = C.grid;
  for (let gx = Math.ceil(xRange[0]); gx <= Math.floor(xRange[1]); gx++) {
    const [sx] = sc(gx, 0);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let gy = Math.ceil(yRange[0]); gy <= Math.floor(yRange[1]); gy++) {
    const [, sy] = sc(0, gy);
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }

  const [, ay] = sc(0, 0);
  const [ax]   = sc(0, 0);
  ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();

  ctx.fillStyle = C.text || C.axtext;
  ctx.font = "11px 'DM Mono', monospace";
  ctx.textAlign = 'center';
  for (let gx = Math.ceil(xRange[0]); gx <= Math.floor(xRange[1]); gx++) {
    if (gx === 0) continue;
    const [sx] = sc(gx, 0);
    ctx.fillText(gx, sx, ay + 14);
  }
  ctx.textAlign = 'right';
  for (let gy = Math.ceil(yRange[0]); gy <= Math.floor(yRange[1]); gy++) {
    if (gy === 0) continue;
    const [, sy] = sc(0, gy);
    ctx.fillText(gy, ax - 5, sy + 4);
  }
}

/**
 * Draw a smooth curve by sampling pixel-by-pixel across the canvas width.
 */
function drawCurve(ctx, W, xRange, yRange, fn, color, lw, sc) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let px = 0; px <= W; px++) {
    const x = xRange[0] + (px / W) * (xRange[1] - xRange[0]);
    let y;
    try { y = fn(x); } catch (e) { started = false; continue; }
    if (!isFinite(y) || y < yRange[0] - 3 || y > yRange[1] + 3) { started = false; continue; }
    const [sx, sy] = sc(x, y);
    if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

/**
 * Draw a filled dot with a background-coloured ring (so it pops off the canvas).
 */
function drawPoint(ctx, px, py, color, bg, r = 5.5) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = bg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI); ctx.stroke();
}

/**
 * Draw a dashed tangent line segment.
 */
function drawTangent(ctx, _px0, _py0, tx1, ty1, tx2, ty2, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(tx2, ty2); ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draw a filled angle arc between the horizontal axis and a tangent line,
 * with an "α" label at the midpoint angle.
 *
 * The arc is computed in screen-pixel space so it matches the visible tangent
 * slope regardless of any axis scale difference.
 */
function drawAngleArc(ctx, px0, py0, tx1, ty1, tx2, ty2, C, W) {
  const screenAngle = Math.atan2(ty2 - ty1, tx2 - tx1);
  const arcR = Math.min(W * 0.065, 40);

  if (Math.abs(screenAngle) < 0.04 || Math.abs(screenAngle) > 1.52) return;

  // Horizontal reference line
  ctx.strokeStyle = C.aStroke; ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 2]);
  ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0 + arcR + 14, py0); ctx.stroke();
  ctx.setLineDash([]);

  const ccw = screenAngle < 0;
  ctx.fillStyle = C.aFill;
  ctx.beginPath();
  ctx.moveTo(px0, py0);
  ctx.arc(px0, py0, arcR, 0, screenAngle, ccw);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = C.aStroke; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px0, py0, arcR, 0, screenAngle, ccw);
  ctx.stroke();

  const midA = screenAngle / 2;
  ctx.fillStyle = C.aStroke;
  ctx.font = "500 12px 'DM Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('α', px0 + (arcR + 16) * Math.cos(midA), py0 + (arcR + 16) * Math.sin(midA) + 4);
}
