import { useState, useEffect } from "react";
import { usePlotter } from "./store";

const TEAM_COLORS = { 1: "#1D4ED8", 2: "#DC2626" };
const AC_TYPES = ["Su-30", "F-16", "F/A-18", "Rafale", "MiG-29", "Tejas", "F-22", "Eurofighter"];

export default function AircraftModal({ open, initialTeam, onClose }) {
  const { dispatch } = usePlotter();
  const [team, setTeam] = useState(initialTeam || 1);
  const [callSign, setCallSign] = useState("");
  const [type, setType] = useState(AC_TYPES[0]);
  const [color, setColor] = useState(TEAM_COLORS[initialTeam || 1]);
  const [showWaypoints, setShowWaypoints] = useState(true);

  // Reset defaults each time modal opens
  useEffect(() => {
    if (open) {
      setTeam(initialTeam || 1);
      setColor(TEAM_COLORS[initialTeam || 1]);
      setCallSign("");
      setType(AC_TYPES[0]);
      setShowWaypoints(true);
    }
  }, [open, initialTeam]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!callSign.trim()) return;
    dispatch({
      type: "AIRCRAFT_ADD",
      aircraft: {
        team: Number(team),
        callSign: callSign.trim().toUpperCase(),
        type,
        color,
        showWaypoints,
      },
    });
    setCallSign("");
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        data-testid="aircraft-modal"
      >
        <h2>New Aircraft</h2>

        <div className="row">
          <div className="field">
            <span className="hud-label">Team / Side</span>
            <select
              className="hud-select"
              value={team}
              onChange={(e) => {
                setTeam(Number(e.target.value));
                setColor(TEAM_COLORS[e.target.value]);
              }}
              data-testid="ac-team"
            >
              <option value={1}>Side 1 · Blue Force</option>
              <option value={2}>Side 2 · Red Force</option>
            </select>
          </div>
          <div className="field">
            <span className="hud-label">Path Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ height: 30 }}
              data-testid="ac-color"
            />
          </div>
        </div>

        <div className="field">
          <span className="hud-label">Call Sign (C/S)</span>
          <input
            className="hud-input"
            value={callSign}
            onChange={(e) => setCallSign(e.target.value)}
            placeholder="e.g., FALCON-1"
            required
            autoFocus
            data-testid="ac-callsign"
          />
        </div>

        <div className="field">
          <span className="hud-label">Aircraft Type</span>
          <select
            className="hud-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            data-testid="ac-type"
          >
            {AC_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showWaypoints}
              onChange={(e) => setShowWaypoints(e.target.checked)}
              data-testid="ac-show-waypoints"
            />
            Show tactical waypoints on path ({team === 1 ? "A, B, C…" : "A', B', C'…"})
          </label>
        </div>

        <div className="actions">
          <button type="button" className="hud-btn" onClick={onClose} data-testid="ac-cancel">
            Cancel
          </button>
          <button type="submit" className="hud-btn emerald" data-testid="ac-submit">
            Add Aircraft
          </button>
        </div>
      </form>
    </div>
  );
}
