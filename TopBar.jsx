import { usePlotter } from "./store";
import {
  MousePointer,
  Move,
  Crosshair,
  Dot,
  Pentagon,
  Circle as CircleIcon,
  Plane,
  RotateCw,
  MapPin,
  Type,
  Ruler,
  Hexagon,
  XCircle,
} from "lucide-react";

const CURSOR_TOOLS = [
  { id: "select", label: "Select", icon: MousePointer },
  { id: "adjuster", label: "Adjust", icon: Move },
  { id: "rblcursor", label: "RBL Cursor", icon: Crosshair },
];

const EXERCISE_TOOLS = [
  { id: "zone", label: "Zone (RBL)", icon: Pentagon },
  { id: "circle", label: "Circle Zone", icon: CircleIcon },
  { id: "point", label: "Point", icon: Dot },
];

const ANNOTATE_TOOLS = [{ id: "textbox", label: "Text Box", icon: Type }];

const FLIGHT_TOOLS = [
  { id: "flight", label: "Flight Path", icon: Plane },
  { id: "turn", label: "Add Turn", icon: RotateCw },
  { id: "waypoint", label: "Waypoint", icon: MapPin },
];

export default function TopBar() {
  const { state, dispatch } = usePlotter();
  const { tool, style, gridScale, pxPerSquare, showLegLabels, showNodes, rblRef, activeZoneId } = state;

  const setTool = (id) => {
    // Do NOT auto-cancel active zone drawing on tool switch (user may want to keep it)
    dispatch({ type: "SET_TOOL", tool: id });
  };

  return (
    <div className="hud-chrome border-b flex flex-col" data-testid="topbar">
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: "var(--hud-border)" }}
      >
        <span className="hud-label">AIRCOMBAT · PLOTTER</span>
        <span style={{ color: "var(--hud-amber)", fontSize: 10, letterSpacing: "0.2em" }}>
          ▲ TAC-01
        </span>

        <div className="hud-divider" />

        <div className="flex items-center gap-2">
          <span className="hud-label">1 SQ =</span>
          <input
            data-testid="grid-units-input"
            type="number"
            className="hud-input"
            style={{ width: 60 }}
            value={gridScale.unitsPerSquare}
            min={0.1}
            step={0.5}
            onChange={(e) =>
              dispatch({
                type: "SET_GRID",
                patch: { unitsPerSquare: parseFloat(e.target.value) || 1 },
              })
            }
          />
          <select
            data-testid="grid-unit-select"
            className="hud-select"
            value={gridScale.unit}
            onChange={(e) => dispatch({ type: "SET_GRID", patch: { unit: e.target.value } })}
          >
            <option value="NM">Nautical Miles</option>
            <option value="km">Kilometers</option>
          </select>
        </div>

        <div className="hud-divider" />

        <div className="flex items-center gap-2">
          <span className="hud-label">PX/SQ</span>
          <input
            type="range"
            min={24}
            max={96}
            step={4}
            value={pxPerSquare}
            onChange={(e) =>
              dispatch({ type: "SET_PX_PER_SQUARE", value: parseInt(e.target.value) })
            }
            data-testid="grid-zoom-slider"
          />
          <span style={{ fontSize: 11, color: "var(--hud-cyan)", minWidth: 32 }}>{pxPerSquare}px</span>
        </div>

        <div className="hud-divider" />

        <label className="checkbox-row" data-testid="toggle-legs">
          <input
            type="checkbox"
            checked={showLegLabels}
            onChange={() => dispatch({ type: "TOGGLE", key: "showLegLabels" })}
          />
          <Ruler size={11} /> Turn Labels
        </label>
        <label className="checkbox-row" data-testid="toggle-nodes">
          <input
            type="checkbox"
            checked={showNodes}
            onChange={() => dispatch({ type: "TOGGLE", key: "showNodes" })}
          />
          <Hexagon size={11} /> Nodes
        </label>

        <div className="flex-1" />

        {/* Contextual clear buttons */}
        {tool === "rblcursor" && rblRef && (
          <button
            className="hud-btn"
            data-testid="clear-rbl-ref"
            onClick={() => dispatch({ type: "SET_RBL_REF", pos: null })}
            title="Clear RBL Reference (right-click also works)"
          >
            <XCircle size={12} /> Clear RBL Ref
          </button>
        )}
        {activeZoneId && (
          <button
            className="hud-btn"
            data-testid="finish-zone"
            onClick={() => dispatch({ type: "ZONE_FINISH", closed: false })}
            title="Finish current zone"
          >
            Finish Zone
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
        <ToolGroup label="CURSOR" tools={CURSOR_TOOLS} tool={tool} setTool={setTool} />
        <div className="hud-divider" />
        <ToolGroup
          label="EXERCISE AREA"
          tools={EXERCISE_TOOLS}
          tool={tool}
          setTool={setTool}
          accent="amber"
        />
        <div className="hud-divider" />
        <ToolGroup label="ANNOTATE" tools={ANNOTATE_TOOLS} tool={tool} setTool={setTool} accent="emerald" />
        <div className="hud-divider" />
        <ToolGroup label="FLIGHT" tools={FLIGHT_TOOLS} tool={tool} setTool={setTool} accent="cyan" />

        <div className="hud-divider" />

        <span className="hud-label">STROKE</span>
        <input
          type="color"
          value={style.color}
          onChange={(e) => dispatch({ type: "SET_STYLE", patch: { color: e.target.value } })}
          data-testid="stroke-color"
        />
        <input
          type="range"
          min={1}
          max={8}
          step={0.5}
          value={style.width}
          onChange={(e) => dispatch({ type: "SET_STYLE", patch: { width: parseFloat(e.target.value) } })}
          data-testid="stroke-width"
        />
        <span style={{ fontSize: 11, color: "var(--hud-cyan)", minWidth: 24 }}>{style.width}px</span>
      </div>
    </div>
  );
}

function ToolGroup({ label, tools, tool, setTool, accent }) {
  return (
    <>
      <span className="hud-label" style={{ color: accent ? `var(--hud-${accent})` : undefined }}>
        {label}
      </span>
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            data-testid={`tool-${t.id}`}
            className={`hud-btn ${tool === t.id ? "active" : ""}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <Icon size={13} /> {t.label}
          </button>
        );
      })}
    </>
  );
}
