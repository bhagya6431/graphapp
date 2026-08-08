import { useState } from "react";
import { usePlotter } from "./store";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  RotateCw,
  Eraser,
  Eye,
  EyeOff,
  Pentagon,
  Circle as CircleIcon,
  Plane,
  Type,
} from "lucide-react";

const TEAM = {
  1: { name: "Team Blue", color: "#1D4ED8" },
  2: { name: "Team Red", color: "#DC2626" },
};

function FolderNode({ label, count, color, open, onToggle, action, children, testid }) {
  return (
    <div className="folder-node" data-testid={testid}>
      <div className="folder-header" onClick={onToggle}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? (
          <FolderOpen size={13} style={{ color: color || "var(--hud-amber)" }} />
        ) : (
          <Folder size={13} style={{ color: color || "var(--hud-amber)" }} />
        )}
        <span style={{ color: color || "var(--hud-text)", fontWeight: 600, letterSpacing: "0.05em" }}>
          {label}
        </span>
        <span style={{ color: "var(--hud-text-dim)", fontSize: 10, marginLeft: 4 }}>({count})</span>
        {action && (
          <div style={{ marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>
      {open && <div className="folder-body">{children}</div>}
    </div>
  );
}

function ItemRow({ selected, onSelect, color, testid, children, extra }) {
  return (
    <div
      className={`tree-item ${selected ? "selected" : ""}`}
      style={{ borderLeftColor: color || "transparent" }}
      onClick={onSelect}
      data-testid={testid}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {children}
        </div>
        {extra && (
          <div style={{ display: "flex", gap: 3 }} onClick={(e) => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShapeManager({ onOpenAircraftModal, onOpenTurnModal }) {
  const { state, dispatch } = usePlotter();
  const { zones, aircraft, textBoxes, waypoints, selectedItem } = state;

  const [openZones, setOpenZones] = useState(true);
  const [openBlue, setOpenBlue] = useState(true);
  const [openRed, setOpenRed] = useState(true);
  const [openText, setOpenText] = useState(true);

  const t1 = aircraft.filter((a) => a.team === 1);
  const t2 = aircraft.filter((a) => a.team === 2);

  const selectItem = (item) => dispatch({ type: "SELECT_ITEM", item });

  return (
    <div className="side-panel" style={{ width: 300, minWidth: 300 }} data-testid="shape-manager">
      {/* Zones */}
      <FolderNode
        label="Exercise Zones & Boundaries"
        count={zones.length}
        color="var(--hud-amber)"
        open={openZones}
        onToggle={() => setOpenZones(!openZones)}
        testid="folder-zones"
      >
        {zones.length === 0 && <div className="tree-empty">No zones. Use Zone (RBL) or Circle Zone tool.</div>}
        {zones.map((z) => (
          <ItemRow
            key={z.id}
            selected={selectedItem?.kind === "zone" && selectedItem.id === z.id}
            onSelect={() => selectItem({ kind: "zone", id: z.id })}
            color={z.style.color}
            testid={`zone-item-${z.id}`}
            extra={
              <>
                <button
                  className="ico-btn"
                  title={z.visible === false ? "Show" : "Hide"}
                  onClick={() =>
                    dispatch({
                      type: "ZONE_UPDATE",
                      id: z.id,
                      patch: { visible: z.visible === false },
                    })
                  }
                >
                  {z.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
                <button
                  className="ico-btn danger"
                  title="Delete"
                  onClick={() => dispatch({ type: "ZONE_DELETE", id: z.id })}
                >
                  <Trash2 size={11} />
                </button>
              </>
            }
          >
            {z.kind === "circle" ? <CircleIcon size={10} /> : <Pentagon size={10} />}{" "}
            <span style={{ marginLeft: 4 }}>
              {z.name}{" "}
              <span style={{ color: "var(--hud-text-dim)" }}>
                · {z.kind === "circle" ? "circle" : "polyline"}
              </span>
            </span>
          </ItemRow>
        ))}
      </FolderNode>

      {/* Team Blue */}
      <FolderNode
        label="Team Blue Paths"
        count={t1.length}
        color="var(--team1-c)"
        open={openBlue}
        onToggle={() => setOpenBlue(!openBlue)}
        testid="folder-blue"
        action={
          <button
            className="ico-btn"
            title="New Aircraft"
            onClick={() => onOpenAircraftModal(1)}
            data-testid="add-aircraft-team-1"
          >
            <Plus size={12} />
          </button>
        }
      >
        {t1.map((a) => (
          <AircraftRow
            key={a.id}
            a={a}
            selected={selectedItem?.kind === "aircraft" && selectedItem.id === a.id}
            onSelect={() => {
              selectItem({ kind: "aircraft", id: a.id });
              dispatch({ type: "AIRCRAFT_SELECT", id: a.id });
            }}
            onOpenTurn={onOpenTurnModal}
            dispatch={dispatch}
          />
        ))}
      </FolderNode>

      {/* Team Red */}
      <FolderNode
        label="Team Red Paths"
        count={t2.length}
        color="var(--team2-c)"
        open={openRed}
        onToggle={() => setOpenRed(!openRed)}
        testid="folder-red"
        action={
          <button
            className="ico-btn"
            title="New Aircraft"
            onClick={() => onOpenAircraftModal(2)}
            data-testid="add-aircraft-team-2"
          >
            <Plus size={12} />
          </button>
        }
      >
        {t2.map((a) => (
          <AircraftRow
            key={a.id}
            a={a}
            selected={selectedItem?.kind === "aircraft" && selectedItem.id === a.id}
            onSelect={() => {
              selectItem({ kind: "aircraft", id: a.id });
              dispatch({ type: "AIRCRAFT_SELECT", id: a.id });
            }}
            onOpenTurn={onOpenTurnModal}
            dispatch={dispatch}
          />
        ))}
      </FolderNode>

      {/* Text notes */}
      <FolderNode
        label="Text Notes & Annotations"
        count={textBoxes.length}
        color="var(--hud-emerald)"
        open={openText}
        onToggle={() => setOpenText(!openText)}
        testid="folder-text"
      >
        {textBoxes.length === 0 && <div className="tree-empty">Use Text Box tool.</div>}
        {textBoxes.map((t) => (
          <ItemRow
            key={t.id}
            selected={selectedItem?.kind === "text" && selectedItem.id === t.id}
            onSelect={() => selectItem({ kind: "text", id: t.id })}
            color={t.textColor}
            testid={`text-item-${t.id}`}
            extra={
              <button
                className="ico-btn danger"
                onClick={() => dispatch({ type: "TEXT_DELETE", id: t.id })}
              >
                <Trash2 size={11} />
              </button>
            }
          >
            <Type size={10} /> <span style={{ marginLeft: 4 }}>{t.text.slice(0, 24)}</span>
          </ItemRow>
        ))}
      </FolderNode>

      {/* Reset */}
      <button
        className="hud-btn danger"
        style={{ marginTop: 6 }}
        data-testid="reset-all-btn"
        onClick={() => {
          if (window.confirm("Reset entire exercise? This clears everything.")) {
            dispatch({ type: "RESET" });
            localStorage.removeItem("acp_plotter_state_v3");
          }
        }}
      >
        <Trash2 size={12} /> Reset All
      </button>
    </div>
  );
}

function AircraftRow({ a, selected, onSelect, onOpenTurn, dispatch }) {
  return (
    <ItemRow
      selected={selected}
      onSelect={onSelect}
      color={a.color}
      testid={`aircraft-${a.callSign}`}
      extra={
        <>
          <input
            type="color"
            value={a.color}
            onChange={(e) =>
              dispatch({ type: "AIRCRAFT_UPDATE", id: a.id, patch: { color: e.target.value } })
            }
            className="ico-color"
            title="Color"
            data-testid={`aircraft-color-${a.callSign}`}
          />
          <button
            className="ico-btn"
            title={a.showWaypoints === false ? "Show WPs" : "Hide WPs"}
            onClick={() =>
              dispatch({
                type: "AIRCRAFT_UPDATE",
                id: a.id,
                patch: { showWaypoints: !(a.showWaypoints !== false) },
              })
            }
            data-testid={`aircraft-toggle-wp-${a.callSign}`}
          >
            {a.showWaypoints === false ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button
            className="ico-btn"
            title="Add Turn"
            onClick={() => {
              onSelect();
              onOpenTurn(a.id);
            }}
            data-testid={`aircraft-add-turn-${a.callSign}`}
          >
            <RotateCw size={11} />
          </button>
          <button
            className="ico-btn"
            title="Clear Path"
            onClick={() => dispatch({ type: "AIRCRAFT_CLEAR_PATH", id: a.id })}
          >
            <Eraser size={11} />
          </button>
          <button
            className="ico-btn danger"
            title="Delete"
            onClick={() => dispatch({ type: "AIRCRAFT_DELETE", id: a.id })}
            data-testid={`aircraft-delete-${a.callSign}`}
          >
            <Trash2 size={11} />
          </button>
        </>
      }
    >
      <Plane size={10} />{" "}
      <span style={{ marginLeft: 4 }}>
        <b>{a.callSign}</b>{" "}
        <span style={{ color: "var(--hud-text-dim)", fontSize: 10 }}>· {a.type} · {a.commands.length}</span>
      </span>
    </ItemRow>
  );
}
