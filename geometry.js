// Geometry helpers for plotter — screen coordinates (Y down)
// All headings in radians; 0 = +X (east/right), +Y = "south" (down on screen)

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export const headingBetween = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

export const rad = (deg) => (deg * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

// Convert a canvas heading (radians, 0 = +X) to compass bearing (0 = North/up)
export const canvasHeadingToBearing = (r) => {
  // North is -Y in canvas. Bearing = clockwise from north.
  let b = deg(Math.atan2(1, 0)) - deg(r); // 90 - r_deg
  b = 90 + deg(r); // shift so 0=east becomes 90 bearing
  // Simpler: bearing = (90 + deg(r)) mod 360 where r is measured from +X, CCW positive?
  // We use Math.atan2 which returns angle CCW from +X in math (but with y-down screen it's CW from +X visually).
  // Compass: 0=N(up, -Y), 90=E(+X), 180=S(+Y), 270=W(-X).
  // If heading r (from atan2 with screen y): r=0 => +X = East => bearing 90.
  // r = PI/2 => (dx=0,dy=+1) = South = bearing 180.
  // So bearing = (deg(r) + 90) mod 360
  b = (deg(r) + 90 + 360) % 360;
  return b;
};

// Given incoming heading and a "left"/"right" turn by deg degrees, compute:
// - turn arc center C
// - arc entry/exit angles from C
// - exit position and exit heading
// Convention: turn side = 'left' curves to pilot's left; 'right' curves to right.
// In screen coords (Y down): if heading vector d = (cos r, sin r),
//   right-perpendicular (pilot's right) = (-sin r, cos r)  (visually clockwise from d in screen)
//   left-perpendicular  (pilot's left)  = ( sin r, -cos r) (visually CCW from d in screen)
// Right turn: heading rotates CW (in screen), delta = +degTurn (atan2 convention increases CW here).
// Left turn: heading rotates CCW, delta = -degTurn.
export function computeTurn(entryPt, headingRad, side, degTurn, radius) {
  const rEntry = headingRad;
  const rightPerp = { x: -Math.sin(rEntry), y: Math.cos(rEntry) };
  const leftPerp = { x: Math.sin(rEntry), y: -Math.cos(rEntry) };
  const perp = side === "left" ? leftPerp : rightPerp;
  const cx = entryPt.x + perp.x * radius;
  const cy = entryPt.y + perp.y * radius;
  const center = { x: cx, y: cy };

  // Angle from center to entry point
  const entryAngle = Math.atan2(entryPt.y - cy, entryPt.x - cx);
  const sweep = rad(degTurn) * (side === "left" ? -1 : 1);
  const exitAngle = entryAngle + sweep;
  const exit = {
    x: cx + radius * Math.cos(exitAngle),
    y: cy + radius * Math.sin(exitAngle),
  };
  const exitHeading = headingRad + sweep;
  return {
    center,
    radius,
    entryAngle,
    exitAngle,
    sweepDeg: degTurn,
    side,
    exit,
    exitHeading,
    largeArc: degTurn > 180 ? 1 : 0,
    sweepFlag: side === "left" ? 0 : 1, // SVG sweep: 1 = CW (screen)
  };
}

// Build SVG arc path segment from turn data
export function arcPathD(entryPt, turn) {
  const { exit, radius, largeArc, sweepFlag } = turn;
  return `M ${entryPt.x} ${entryPt.y} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${exit.x} ${exit.y}`;
}

// Point on an SVG arc at parameter t in [0,1]
export function pointOnArc(turn, t) {
  const { center, radius, entryAngle, exitAngle } = turn;
  const a = entryAngle + (exitAngle - entryAngle) * t;
  return { x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) };
}

export const pointOnSegment = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Convert canvas px distance to units based on grid scale
// pxPerSquare = pixel size of one major grid square; unitsPerSquare = user-defined
export function pxToUnits(px, pxPerSquare, unitsPerSquare) {
  return (px / pxPerSquare) * unitsPerSquare;
}

// Auto-label helper for team waypoints (A, B, ..., Z, AA, AB, ...)
export function alphaLabel(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
