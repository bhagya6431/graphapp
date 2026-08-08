import { useState } from "react";
import { usePlotter } from "./store";
import { Plus, Trash2, Palette, Edit2, RotateCw } from "lucide-react";

const TEAM_DEFAULT = {
  1: { name: "Blue Force", color: "#1D4ED8" },
  2: { name: "Red Force", color: "#DC2626" },
};

export default function LeftSidebar({ onOpenAircraftModal, onOpenTurnModal }) {
  const { state, dispatch } = usePlotter();
  const { aircraft, activeAircraftId, selectedAircraftId, exerciseBox, waypoints } = state;

  const t1 = aircraft.filter((a) => a.team === 1);
  const t2 = aircraft.filter((a) => a.team === 2);

  return (
    <div className="side-panel" style={{ width: 280, minWidth: 280 }} data-testid="left-sidebar">
      <div className="card">
        <h3>Exercise Area</h3>
        <div style={{ fontSize: 12, color: "var(--hud-text-dim)", marginBottom: 8 }}>
          Status:{" "}
          <span
            style={{
              color: exerciseBox.locked
                ? "var(--hud-emerald)"
                : exerciseBox.points.length
                ? "var(--hud-amber)"
                : "var(--hud-text-dim)",
              fontWeight: 600,
            }}
          >
            {exerciseBox.locked
              ? "● LOCKED"
              : exerciseBox.points.length
              ? "○ DRAFT"
              : "— EMPTY"}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--hud-text-dim)" }}>
          Vertices: <span style={{ color: "var(--hud-cyan)" }}>{exerciseBox.points.length}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
          <span className="hud-label">Color</span>
          <input
            type="color"
            value={exerciseBox.style.color}
            onChange={(e) => dispatch({ type: "BOX_STYLE", patch: { color: e.target.value } })}
            data-testid="box-color"
          />
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={exerciseBox.style.width}
            onChange={(e) =>
              dispatch({ type: "BOX_STYLE", patch: { width: parseFloat(e.target.value) } })
            }
            data-testid="box-width"
          />
        </div>
        <div style={{ fontSize: 10, color: "var(--hud-text-dim)", marginTop: 6, lineHeight: 1.5 }}>
          Tip: Use <b style={{ color: "var(--hud-amber)" }}>Exercise Box</b> tool. Click to add
          vertices. Double-click or press Save to lock.
        </div>
      </div>

      <TeamCard
        team={1}
        list={t1}
        activeId={activeAircraftId}
        selectedId={selectedAircraftId}
        onAdd={() => onOpenAircraftModal(1)}
        onSelect={(id) => dispatch({ type: "AIRCRAFT_SELECT", id })}
        onDelete={(id) => dispatch({ type: "AIRCRAFT_DELETE", id })}
        onClearPath={(id) => dispatch({ type: "AIRCRAFT_CLEAR_PATH", id })}
        onEditColor={(id, color) => dispatch({ type: "AIRCRAFT_UPDATE", id, patch: { color } })}
        onOpenTurn={onOpenTurnModal}
      />
      <TeamCard
        team={2}
        list={t2}
        activeId={activeAircraftId}
        selectedId={selectedAircraftId}
        onAdd={() => onOpenAircraftModal(2)}
        onSelect={(id) => dispatch({ type: "AIRCRAFT_SELECT", id })}
        onDelete={(id) => dispatch({ type: "AIRCRAFT_DELETE", id })}
        onClearPath={(id) => dispatch({ type: "AIRCRAFT_CLEAR_PATH", id })}
        onEditColor={(id, color) => dispatch({ type: "AIRCRAFT_UPDATE", id, patch: { color } })}
        onOpenTurn={onOpenTurnModal}
      />

      <div className="card">
        <h3>Waypoints</h3>
        {waypoints.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--hud-text-dim)" }}>
            None. Use the <b>Waypoint</b> tool to drop tactical points on a path.
          </div>
        )}
        {waypoints.map((wp) => {
          const ac = aircraft.find((a) => a.id === wp.aircraftId);
          return (
            <div
              key={wp.id}
              style={{
                fontSize: 11,
                color: "var(--hud-text)",
                padding: "4px 6px",
                background: "#0b1425",
                border: "1px solid var(--hud-border)",
                borderRadius: 3,
                marginBottom: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              data-testid={`wp-list-${wp.name}`}
            >
              <span>
                <b style={{ color: ac?.color }}>{wp.name}</b>{" "}
                <span style={{ color: "var(--hud-text-dim)" }}>· {ac?.callSign}</span>
              </span>
              <button
                className="hud-btn danger"
                style={{ padding: "2px 6px" }}
                onClick={() => dispatch({ type: "WAYPOINT_DELETE", id: wp.id })}
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Reset</h3>
        <button
          data-testid="reset-all-btn"
          className="hud-btn danger"
          style={{ width: "100%" }}
          onClick={() => {
            if (window.confirm("Reset entire exercise? This clears everything.")) {
              dispatch({ type: "RESET" });
              localStorage.removeItem("acp_plotter_state_v1");
            }
          }}
        >
          <Trash2 size={13} /> Reset All
        </button>
      </div>
    </div>
  );
}

function TeamCard({ team, list, activeId, selectedId, onAdd, onSelect, onDelete, onClearPath, onEditColor, onOpenTurn }) {
  const cfg = TEAM_DEFAULT[team];
  return (
    <div className="card" data-testid={`team-card-${team}`}>
      <h3 style={{ color: cfg.color }}>
        {cfg.name} · SIDE {team}
      </h3>
      {list.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--hud-text-dim)", marginBottom: 8 }}>
          No aircraft yet.
        </div>
      )}
      {list.map((a) => (
        <div
          key={a.id}
          className={`aircraft-item ${selectedId === a.id ? "selected" : ""}`}
          style={{ borderLeftColor: a.color }}
          onClick={() => onSelect(a.id)}
          data-testid={`aircraft-${a.callSign}`}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="cs">{a.callSign}</span>
              <div className="type">{a.type} · {a.commands.length} cmd</div>
            </div>
            <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
              <input
                type="color"
                value={a.color}
                onChange={(e) => onEditColor(a.id, e.target.value)}
                title="Path color"
                style={{ width: 22, height: 22 }}
                data-testid={`aircraft-color-${a.callSign}`}
              />
              <button
                className="hud-btn"
                style={{ padding: "2px 6px" }}
                title="Add Turn"
                onClick={() => {
                  onSelect(a.id);
                  onOpenTurn(a.id);
                }}
                data-testid={`aircraft-add-turn-${a.callSign}`}
              >
                <RotateCw size={11} />
              </button>
              <button
                className="hud-btn"
                style={{ padding: "2px 6px" }}
                title="Clear Path"
                onClick={() => onClearPath(a.id)}
              >
                <Palette size={11} />
              </button>
              <button
                className="hud-btn danger"
                style={{ padding: "2px 6px" }}
                title="Delete"
                onClick={() => onDelete(a.id)}
                data-testid={`aircraft-delete-${a.callSign}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        className="hud-btn"
        style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
        onClick={onAdd}
        data-testid={`add-aircraft-team-${team}`}
      >
        <Plus size={13} /> New Aircraft
      </button>
    </div>
  );
}
