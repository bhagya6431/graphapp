import { useMemo, useState, useEffect } from "react";
import { usePlotter } from "./store";
import { turnRadiusMeters, turnRateDegPerSec, loadFactor } from "@/lib/physics";

const M_TO_NM = 1 / 1852;
const M_TO_KM = 1 / 1000;
const KMPH_TO_KTS = 0.539957;

// bank angle for a given load factor n: cos(bank) = 1/n → bank = acos(1/n)
const bankFromG = (g) => (Math.acos(1 / g) * 180) / Math.PI;
const G_PRESETS = [
  { g: 3, label: "3 G" },
  { g: 4, label: "4 G" },
  { g: 4.5, label: "4.5 G" },
];

export default function TurnModal({ open, ctx, onClose }) {
  const { state, dispatch } = usePlotter();

  const [side, setSide] = useState("right");
  const [degrees, setDegrees] = useState(90);
  const [speed, setSpeed] = useState(600);
  const [speedUnit, setSpeedUnit] = useState("kmph"); // kmph default
  const [bank, setBank] = useState(45); // 45° default for a visible arc at typical scales
  const [entryBearing, setEntryBearing] = useState(90); // for independent starting turn: 0=N, 90=E

  useEffect(() => {
    if (open) {
      // reset defaults on open
      setSide("right");
      setDegrees(90);
      setSpeed(600);
      setSpeedUnit("kmph");
      setBank(45);
      setEntryBearing(90);
    }
  }, [open]);

  const aircraft = state.aircraft.find((a) => a.id === ctx?.aircraftId);
  const { gridScale, pxPerSquare } = state;

  const speedKts = useMemo(
    () => (speedUnit === "kmph" ? Number(speed) * KMPH_TO_KTS : Number(speed)),
    [speed, speedUnit]
  );

  const { rMeters, rUnits, rPx, rate, gLoad } = useMemo(() => {
    const rM = turnRadiusMeters(speedKts, bank);
    const rU = gridScale.unit === "km" ? rM * M_TO_KM : rM * M_TO_NM;
    const rP = (rU / gridScale.unitsPerSquare) * pxPerSquare;
    return {
      rMeters: rM,
      rUnits: rU,
      rPx: rP,
      rate: turnRateDegPerSec(speedKts, bank),
      gLoad: loadFactor(bank),
    };
  }, [speedKts, bank, gridScale, pxPerSquare]);

  if (!open || !aircraft) return null;

  const isIndependent = !!ctx?.independent;

  const submit = (e) => {
    e.preventDefault();
    const cmd = {
      type: "turn",
      side,
      degrees: Number(degrees),
      speed: Number(speed),
      speedUnit,
      bank: Number(bank.toFixed(2)),
      radiusPx: rPx,
      radiusMeters: rMeters,
    };
    if (isIndependent) {
      // Convert compass bearing (0=N, 90=E) to canvas heading (0=+X east, +Y south).
      // bearing 0 = -Y direction ⇒ canvas heading = -π/2
      // canvas heading = (bearing - 90) in degrees, converted to rad, so 0(N)=-90°, 90(E)=0°, 180(S)=90°, 270(W)=180°
      const rad = ((Number(entryBearing) - 90) * Math.PI) / 180;
      cmd.entry = { x: ctx.entryPoint.x, y: ctx.entryPoint.y };
      cmd.entryHeading = rad;
    }
    dispatch({ type: "AIRCRAFT_ADD_COMMAND", id: aircraft.id, cmd });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        style={{ width: 520, minHeight: 560, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        data-testid="turn-modal"
      >
        <h2>
          Add Turn · <span style={{ color: aircraft.color }}>{aircraft.callSign}</span>
          {isIndependent && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                color: "var(--hud-emerald)",
                letterSpacing: "0.1em",
              }}
            >
              [INDEPENDENT START]
            </span>
          )}
        </h2>

        <div className="row">
          <div className="field">
            <span className="hud-label">Turn Side</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`hud-btn ${side === "left" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setSide("left")}
                data-testid="turn-left"
              >
                ◀ Left
              </button>
              <button
                type="button"
                className={`hud-btn ${side === "right" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setSide("right")}
                data-testid="turn-right"
              >
                Right ▶
              </button>
            </div>
          </div>
          <div className="field">
            <span className="hud-label">Degrees</span>
            <input
              type="number"
              className="hud-input"
              value={degrees}
              min={5}
              max={359}
              step={5}
              onChange={(e) => setDegrees(e.target.value)}
              data-testid="turn-degrees"
            />
          </div>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <span className="hud-label">Speed</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                className="hud-input"
                value={speed}
                min={80}
                max={3000}
                step={10}
                onChange={(e) => setSpeed(e.target.value)}
                data-testid="turn-speed"
                style={{ flex: 1 }}
              />
              <select
                className="hud-select"
                value={speedUnit}
                onChange={(e) => setSpeedUnit(e.target.value)}
                data-testid="turn-speed-unit"
              >
                <option value="kmph">Km/h</option>
                <option value="kts">Knots</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <span className="hud-label">Bank (°)</span>
            <input
              type="number"
              className="hud-input"
              value={Number(bank.toFixed(1))}
              min={5}
              max={85}
              step={0.1}
              onChange={(e) => setBank(parseFloat(e.target.value) || 0)}
              data-testid="turn-bank"
            />
          </div>
        </div>

        <div className="field">
          <span className="hud-label">G-Load Presets</span>
          <div style={{ display: "flex", gap: 6 }}>
            {G_PRESETS.map((p) => {
              const b = bankFromG(p.g);
              const isActive = Math.abs(bank - b) < 0.5;
              return (
                <button
                  key={p.g}
                  type="button"
                  className={`hud-btn ${isActive ? "active" : ""}`}
                  onClick={() => setBank(b)}
                  data-testid={`turn-g-${p.g}`}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {p.label} <span style={{ color: "var(--hud-text-dim)", marginLeft: 6, fontSize: 10 }}>≈ {b.toFixed(1)}°</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reserved slot for entry bearing (always present to keep modal height stable) */}
        <div className="field" style={{ visibility: isIndependent ? "visible" : "hidden", minHeight: 62 }}>
          <span className="hud-label">Entry Bearing (° from North)</span>
          <input
            type="number"
            className="hud-input"
            value={entryBearing}
            min={0}
            max={359}
            step={5}
            onChange={(e) => setEntryBearing(e.target.value)}
            data-testid="turn-entry-bearing"
            disabled={!isIndependent}
          />
          <span style={{ fontSize: 10, color: "var(--hud-text-dim)", marginTop: 2 }}>
            0=N, 90=E, 180=S, 270=W — direction of incoming heading.
          </span>
        </div>

        <div
          style={{
            background: "#0b1425",
            border: "1px solid var(--hud-border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 4,
          }}
        >
          <span style={{ color: "var(--hud-text-dim)" }}>Turn Radius:</span>
          <span style={{ color: "var(--hud-cyan)" }} data-testid="turn-preview-radius">
            {rUnits.toFixed(2)} {gridScale.unit} ({rMeters.toFixed(0)} m)
          </span>
          <span style={{ color: "var(--hud-text-dim)" }}>Turn Rate:</span>
          <span style={{ color: "var(--hud-cyan)" }}>{rate.toFixed(2)} °/s</span>
          <span style={{ color: "var(--hud-text-dim)" }}>G-Load (n):</span>
          <span
            style={{
              color: gLoad > 9 ? "var(--hud-crimson)" : gLoad > 6 ? "var(--hud-amber)" : "var(--hud-emerald)",
            }}
          >
            {gLoad.toFixed(2)} G
          </span>
          <span style={{ color: "var(--hud-text-dim)" }}>Time for {degrees}°:</span>
          <span style={{ color: "var(--hud-cyan)" }}>
            {rate > 0 ? (Number(degrees) / rate).toFixed(1) : "—"} s
          </span>
        </div>

        {/* Reserved slot for scale-warning (fixed height so modal doesn't resize) */}
        <div
          style={{
            minHeight: 52,
            marginTop: 6,
            visibility: rPx < 8 ? "visible" : "hidden",
          }}
        >
          <div
            style={{
              padding: 8,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid var(--hud-amber)",
              borderRadius: 3,
              fontSize: 11,
              color: "var(--hud-amber)",
            }}
            data-testid="turn-scale-warning"
          >
            ⚠ Turn radius is only ~{rPx.toFixed(1)} px at the current grid scale.
            Reduce speed, decrease bank, or increase grid units.
          </div>
        </div>

        <div className="actions">
          <button type="button" className="hud-btn" onClick={onClose} data-testid="turn-cancel">
            Cancel
          </button>
          <button type="submit" className="hud-btn emerald" data-testid="turn-submit">
            Add Turn
          </button>
        </div>
      </form>
    </div>
  );
}
