export type Point = { x: number; y: number };

export type RecognizedStroke =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; x: number; y: number; width: number; height: number };

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function bbox(points: Point[]): { x: number; y: number; width: number; height: number } {
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Distance from point to segment AB. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isClosed(points: Point[], perimeter: number): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  return gap <= Math.max(8, perimeter * 0.12);
}

/** Mean distance from samples to the nearest of the four bbox edges, as a fraction of the shorter side. */
function rectEdgeError(points: Point[], box: ReturnType<typeof bbox>): number {
  const short = Math.max(1, Math.min(box.width, box.height));
  const corners = {
    nw: { x: box.x, y: box.y },
    ne: { x: box.x + box.width, y: box.y },
    sw: { x: box.x, y: box.y + box.height },
    se: { x: box.x + box.width, y: box.y + box.height }
  };
  const edges: [Point, Point][] = [
    [corners.nw, corners.ne],
    [corners.ne, corners.se],
    [corners.se, corners.sw],
    [corners.sw, corners.nw]
  ];
  let sum = 0;
  for (const p of points) {
    let best = Infinity;
    for (const [a, b] of edges) best = Math.min(best, distToSegment(p, a, b));
    sum += best;
  }
  return sum / points.length / short;
}

/** Mean |radius error| for an ellipse inscribed in the bbox, as a fraction of the mean radius. */
function circleRadialError(points: Point[], box: ReturnType<typeof bbox>): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = Math.max(1, box.width / 2);
  const ry = Math.max(1, box.height / 2);
  let sum = 0;
  for (const p of points) {
    // Normalize to unit circle: (dx/rx)^2 + (dy/ry)^2 should be ~1.
    const nx = (p.x - cx) / rx;
    const ny = (p.y - cy) / ry;
    const r = Math.hypot(nx, ny);
    sum += Math.abs(r - 1);
  }
  return sum / points.length;
}

function tryRect(
  points: Point[],
  box: ReturnType<typeof bbox>,
  perimeter: number
): { shape: RecognizedStroke; err: number } | null {
  if (!isClosed(points, perimeter)) return null;
  if (box.width < 12 || box.height < 12) return null;
  const err = rectEdgeError(points, box);
  if (err > 0.14) return null;
  return {
    err,
    shape: {
      kind: 'rect',
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height)
    }
  };
}

function tryCircle(
  points: Point[],
  box: ReturnType<typeof bbox>,
  perimeter: number
): { shape: RecognizedStroke; err: number } | null {
  if (!isClosed(points, perimeter)) return null;
  if (box.width < 12 || box.height < 12) return null;
  const aspect = box.width / box.height;
  if (aspect < 0.7 || aspect > 1.4) return null;
  const err = circleRadialError(points, box);
  if (err > 0.18) return null;
  return {
    err,
    shape: {
      kind: 'circle',
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height)
    }
  };
}

function tryLine(points: Point[]): RecognizedStroke | null {
  const a = points[0];
  const b = points[points.length - 1];
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 16) return null;
  let maxDev = 0;
  for (const p of points) maxDev = Math.max(maxDev, distToSegment(p, a, b));
  if (maxDev > chord * 0.1) return null;
  return { kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

/**
 * Classify a freehand polyline as a line, axis-aligned rect, or ellipse.
 * Used by free-draw snap — converts to a shape annotation.
 * Only kinds with `allowed[kind] === true` are considered.
 * Closed shapes are scored; the lower error wins (so squares stay rects,
 * ovals stay circles even when both pass their absolute thresholds).
 */
export function recognizeStroke(
  points: Point[],
  allowed: { line?: boolean; rect?: boolean; circle?: boolean } = {
    line: true,
    rect: true,
    circle: true
  }
): RecognizedStroke | null {
  if (points.length < 3) return null;
  const len = pathLength(points);
  if (len < 16) return null;
  const box = bbox(points);

  const scored: { shape: RecognizedStroke; err: number }[] = [];
  if (allowed.circle) {
    const circ = tryCircle(points, box, len);
    if (circ) scored.push(circ);
  }
  if (allowed.rect) {
    const rect = tryRect(points, box, len);
    if (rect) scored.push(rect);
  }
  if (scored.length > 0) {
    scored.sort((a, b) => a.err - b.err);
    return scored[0].shape;
  }
  if (allowed.line) return tryLine(points);
  return null;
}

/**
 * If the stroke is roughly straight, return endpoints `[start, end]`.
 * Used by highlight snap — keeps kind:'highlight', no shape conversion.
 */
export function straightenStroke(points: Point[]): [Point, Point] | null {
  if (points.length < 2) return null;
  const line = tryLine(points);
  if (!line || line.kind !== 'line') return null;
  return [
    { x: line.x1, y: line.y1 },
    { x: line.x2, y: line.y2 }
  ];
}

/** Synthetic samples for the self-check below. */
function sampleRect(x: number, y: number, w: number, h: number, n = 40): Point[] {
  const peri = 2 * (w + h);
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * peri;
    if (t < w) pts.push({ x: x + t, y });
    else if (t < w + h) pts.push({ x: x + w, y: y + (t - w) });
    else if (t < 2 * w + h) pts.push({ x: x + w - (t - w - h), y: y + h });
    else pts.push({ x, y: y + h - (t - 2 * w - h) });
  }
  pts.push({ ...pts[0] });
  return pts;
}

function sampleCircle(cx: number, cy: number, r: number, n = 48): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  pts.push({ ...pts[0] });
  return pts;
}

function sampleLine(x1: number, y1: number, x2: number, y2: number, n = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/**
 * Runnable check: `RECOGNIZE_STROKE_CHECK=1 npx tsx src/renderer/tools/screen-capture/lib/recognize-stroke.ts`
 */
function assertRecognizeStrokeSelfCheck(): void {
  const line = recognizeStroke(sampleLine(10, 10, 200, 40));
  assert(line?.kind === 'line', `expected line, got ${JSON.stringify(line)}`);

  const rect = recognizeStroke(sampleRect(20, 30, 120, 80));
  assert(rect?.kind === 'rect', `expected rect, got ${JSON.stringify(rect)}`);

  const square = recognizeStroke(sampleRect(20, 30, 100, 100));
  assert(square?.kind === 'rect', `expected square→rect, got ${JSON.stringify(square)}`);

  const circ = recognizeStroke(sampleCircle(100, 100, 50));
  assert(circ?.kind === 'circle', `expected circle, got ${JSON.stringify(circ)}`);

  // Slightly oblong ellipse used to be stolen by tryRect (aspect outside the
  // old 0.85–1.15 veto window while still clearing edgeErr < 0.14).
  const ellipsePts: Point[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ellipsePts.push({ x: 100 + 60 * Math.cos(a), y: 100 + 50 * Math.sin(a) });
  }
  const ellipse = recognizeStroke(ellipsePts);
  assert(ellipse?.kind === 'circle', `expected ellipse→circle, got ${JSON.stringify(ellipse)}`);

  const rectOnly = recognizeStroke(ellipsePts, { line: false, rect: true, circle: false });
  assert(rectOnly?.kind === 'rect', `expected rect-only allow, got ${JSON.stringify(rectOnly)}`);

  const none = recognizeStroke(ellipsePts, { line: false, rect: false, circle: false });
  assert(none === null, `expected null when nothing allowed, got ${JSON.stringify(none)}`);

  const scribble = recognizeStroke([
    { x: 0, y: 0 },
    { x: 40, y: 80 },
    { x: 10, y: 30 },
    { x: 90, y: 20 },
    { x: 50, y: 100 }
  ]);
  assert(scribble === null, `expected null for scribble, got ${JSON.stringify(scribble)}`);

  const straightened = straightenStroke(sampleLine(10, 10, 200, 40));
  assert(straightened !== null, 'expected straightenStroke line');
  if (straightened) {
    assert(straightened[0].x === 10 && straightened[0].y === 10, 'bad straighten start');
    assert(straightened[1].x === 200 && straightened[1].y === 40, 'bad straighten end');
  }
}

if (typeof process !== 'undefined' && process.env.RECOGNIZE_STROKE_CHECK === '1') {
  assertRecognizeStrokeSelfCheck();
  console.log('recognize-stroke: ok');
}
