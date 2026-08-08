// Aviation physics: turn radius from bank angle and speed
// Standard formula: R = V^2 / (g * tan(bank))
const G = 9.81; // m/s^2
const KTS_TO_MS = 0.514444;
const M_TO_NM = 1 / 1852;
const M_TO_KM = 1 / 1000;

export function turnRadiusMeters(speedKts, bankDeg) {
  if (!speedKts || !bankDeg) return 0;
  const v = speedKts * KTS_TO_MS;
  const bankRad = (bankDeg * Math.PI) / 180;
  const t = Math.tan(bankRad);
  if (t <= 0) return 0;
  return (v * v) / (G * t);
}

export function turnRadiusInUnits(speedKts, bankDeg, unit) {
  const rMeters = turnRadiusMeters(speedKts, bankDeg);
  return unit === "km" ? rMeters * M_TO_KM : rMeters * M_TO_NM;
}

// Load factor n = 1/cos(bank) — useful G display
export function loadFactor(bankDeg) {
  const rad = (bankDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  return c === 0 ? Infinity : 1 / c;
}

// Rate of turn (deg/sec) — omega = g * tan(bank) / V
export function turnRateDegPerSec(speedKts, bankDeg) {
  const v = speedKts * KTS_TO_MS;
  if (!v) return 0;
  const rad = (bankDeg * Math.PI) / 180;
  return ((G * Math.tan(rad)) / v) * (180 / Math.PI);
}
