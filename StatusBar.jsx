import { usePlotter } from "./store";
import { pxToUnits } from "@/lib/geometry";

export default function StatusBar() {
  const { state } = usePlotter();
  const { cursor, tool, gridScale, pxPerSquare, aircraft, activeAircraftId, zones, origin } = state;

  const active = aircraft.find((a) => a.id === activeAircraftId);
  const xU = pxToUnits(cursor.x, pxPerSquare, gridScale.unitsPerSquare).toFixed(2);
  const yU = pxToUnits(cursor.y, pxPerSquare, gridScale.unitsPerSquare).toFixed(2);

  // Range & bearing from origin
  const dx = cursor.x - (origin?.x || 0);
  const dy = cursor.y - (origin?.y || 0);
  const rangePx = Math.hypot(dx, dy);
  const rangeU = pxToUnits(rangePx, pxPerSquare, gridScale.unitsPerSquare).toFixed(2);
  const bearing = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;

  return (
    <div className="hud-status" data-testid="statusbar">
      <span>
        MODE <span className="val amber">{tool.toUpperCase()}</span>
      </span>
      <span>
        CURSOR{" "}
        <span className="val">
          X {xU} / Y {yU} {gridScale.unit}
        </span>
      </span>
      <span>
        RBL{" "}
        <span className="val amber">
          R {rangeU} {gridScale.unit} · B {bearing.toFixed(0)}°
        </span>
      </span>
      <span>
        PX <span className="val">({Math.round(cursor.x)}, {Math.round(cursor.y)})</span>
      </span>
      <span>
        GRID <span className="val">{gridScale.unitsPerSquare} {gridScale.unit}/sq</span>
      </span>
      <span>
        ZONES <span className="val emerald">{zones.length}</span>
      </span>
      {active && (
        <span>
          ACTIVE{" "}
          <span className="val" style={{ color: active.color }}>
            {active.callSign} ({active.commands.length})
          </span>
        </span>
      )}
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--hud-text-dim)" }}>
        ▲ Shift = no snap · Dbl-click zone = close · Right-click cancels drawing
      </span>
    </div>
  );
}
