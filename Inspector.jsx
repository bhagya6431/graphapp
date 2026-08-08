import { usePlotter } from "./store";
import { Trash2, ArrowUp, Circle, Ban } from "lucide-react";

export default function Inspector() {
  const { state, dispatch } = usePlotter();
  const { selectedItem, zones, aircraft, textBoxes } = state;

  if (!selectedItem) {
    return (
      <div className="inspector" data-testid="inspector">
        <div className="inspector-empty">
          <div style={{ fontSize: 11, color: "var(--hud-amber)", letterSpacing: "0.15em" }}>
            PROPERTIES
          </div>
          <div style={{ fontSize: 10, color: "var(--hud-text-dim)", marginTop: 8, lineHeight: 1.5 }}>
            Select an item on canvas or in the left tree to edit its properties.
          </div>
        </div>
      </div>
    );
  }

  if (selectedItem.kind === "zone") {
    const z = zones.find((x) => x.id === selectedItem.id);
    if (!z) return null;
    return (
      <div className="inspector" data-testid="inspector">
        <h3>Zone</h3>
        <Field label="Name">
          <input
            className="hud-input"
            value={z.name}
            onChange={(e) => dispatch({ type: "ZONE_UPDATE", id: z.id, patch: { name: e.target.value } })}
            data-testid="ins-zone-name"
          />
        </Field>
        <Field label="Line Color">
          <input
            type="color"
            value={z.style.color}
            onChange={(e) => dispatch({ type: "ZONE_STYLE", id: z.id, patch: { color: e.target.value } })}
            data-testid="ins-zone-color"
          />
        </Field>
        <Field label={`Stroke ${z.style.width}px`}>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={z.style.width}
            onChange={(e) =>
              dispatch({ type: "ZONE_STYLE", id: z.id, patch: { width: parseFloat(e.target.value) } })
            }
            data-testid="ins-zone-width"
          />
        </Field>
        <Field label={`Opacity ${Math.round(z.style.opacity * 100)}%`}>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={z.style.opacity}
            onChange={(e) =>
              dispatch({ type: "ZONE_STYLE", id: z.id, patch: { opacity: parseFloat(e.target.value) } })
            }
          />
        </Field>
        {z.kind === "circle" && (
          <Field label="Radius (px)">
            <input
              type="number"
              className="hud-input"
              value={Math.round(z.r)}
              onChange={(e) =>
                dispatch({ type: "ZONE_UPDATE", id: z.id, patch: { r: parseFloat(e.target.value) || 1 } })
              }
              data-testid="ins-zone-radius"
            />
          </Field>
        )}
        <button
          className="hud-btn danger"
          onClick={() => {
            dispatch({ type: "ZONE_DELETE", id: z.id });
            dispatch({ type: "SELECT_ITEM", item: null });
          }}
          data-testid="ins-zone-delete"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    );
  }

  if (selectedItem.kind === "segment") {
    const a = aircraft.find((x) => x.id === selectedItem.aircraftId);
    if (!a) return null;
    const cmd = a.commands[selectedItem.commandIndex];
    if (!cmd) return null;
    const isLine = cmd.type === "straight" || cmd.type === "start";
    const isTurn = cmd.type === "turn";
    return (
      <div className="inspector" data-testid="inspector">
        <h3 style={{ color: a.color }}>
          {a.callSign} · Leg #{selectedItem.commandIndex + 1}
        </h3>
        <div style={{ fontSize: 11, color: "var(--hud-text-dim)", marginBottom: 4 }}>
          Type: <b style={{ color: "var(--hud-text)" }}>{cmd.type}</b>
        </div>

        {cmd.type === "straight" && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={cmd.curly === true}
              onChange={() =>
                dispatch({
                  type: "AIRCRAFT_UPDATE_COMMAND",
                  id: a.id,
                  index: selectedItem.commandIndex,
                  patch: { curly: !cmd.curly },
                })
              }
              data-testid="ins-seg-curly"
            />
            Zig-zag this segment
          </label>
        )}

        {isTurn && (
          <div style={{ fontSize: 11, color: "var(--hud-text-dim)", lineHeight: 1.5 }}>
            {cmd.side} {cmd.degrees}° @ {cmd.speed} {cmd.speedUnit || "kts"} · bank {cmd.bank}°
          </div>
        )}

        <button
          className="hud-btn danger"
          onClick={() => {
            // Remove the command and any waypoints attached to it
            const newCommands = a.commands.filter((_, i) => i !== selectedItem.commandIndex);
            dispatch({ type: "AIRCRAFT_UPDATE", id: a.id, patch: { commands: newCommands } });
            dispatch({ type: "SELECT_ITEM", item: { kind: "aircraft", id: a.id } });
          }}
          data-testid="ins-seg-delete"
        >
          <Trash2 size={12} /> Delete Segment
        </button>
        <button
          className="hud-btn"
          onClick={() => dispatch({ type: "SELECT_ITEM", item: { kind: "aircraft", id: a.id } })}
        >
          ← Back to Aircraft
        </button>
      </div>
    );
  }

  if (selectedItem.kind === "aircraft") {
    const a = aircraft.find((x) => x.id === selectedItem.id);
    if (!a) return null;
    return (
      <div className="inspector" data-testid="inspector">
        <h3 style={{ color: a.color }}>{a.callSign}</h3>
        <Field label="Call Sign">
          <input
            className="hud-input"
            value={a.callSign}
            onChange={(e) =>
              dispatch({ type: "AIRCRAFT_UPDATE", id: a.id, patch: { callSign: e.target.value } })
            }
            data-testid="ins-ac-callsign"
          />
        </Field>
        <Field label="Type">
          <input
            className="hud-input"
            value={a.type}
            onChange={(e) => dispatch({ type: "AIRCRAFT_UPDATE", id: a.id, patch: { type: e.target.value } })}
          />
        </Field>
        <Field label="Path Color">
          <input
            type="color"
            value={a.color}
            onChange={(e) => dispatch({ type: "AIRCRAFT_UPDATE", id: a.id, patch: { color: e.target.value } })}
            data-testid="ins-ac-color"
          />
        </Field>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={a.showWaypoints !== false}
            onChange={() =>
              dispatch({
                type: "AIRCRAFT_UPDATE",
                id: a.id,
                patch: { showWaypoints: !(a.showWaypoints !== false) },
              })
            }
            data-testid="ins-ac-showwp"
          />
          Show waypoints
        </label>
        <Field label={`Commands (${a.commands.length})`}>
          <div style={{ fontSize: 10, color: "var(--hud-text-dim)", lineHeight: 1.4, maxHeight: 120, overflowY: "auto" }}>
            {a.commands.length === 0 && "None yet."}
            {a.commands.map((c, i) => (
              <div key={i}>
                {i + 1}. {c.type}
                {c.type === "turn" && (
                  <span>
                    {" "}
                    {c.side} {c.degrees}° @ {c.speed}
                    {c.speedUnit || "kts"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Field>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="hud-btn"
            style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
            onClick={() => dispatch({ type: "AIRCRAFT_CLEAR_PATH", id: a.id })}
          >
            Clear
          </button>
          <button
            className="hud-btn danger"
            style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
            onClick={() => {
              dispatch({ type: "AIRCRAFT_DELETE", id: a.id });
              dispatch({ type: "SELECT_ITEM", item: null });
            }}
            data-testid="ins-ac-delete"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>
    );
  }

  if (selectedItem.kind === "text") {
    const t = textBoxes.find((x) => x.id === selectedItem.id);
    if (!t) return null;
    return (
      <div className="inspector" data-testid="inspector">
        <h3>Text Note</h3>
        <Field label="Text">
          <textarea
            className="hud-input"
            rows={3}
            value={t.text}
            onChange={(e) => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { text: e.target.value } })}
            data-testid="ins-text-content"
            style={{ width: "100%", fontFamily: "Arial, sans-serif", fontSize: 12 }}
          />
        </Field>
        <Field label={`Font ${t.fontSize}pt`}>
          <input
            type="range"
            min={8}
            max={32}
            step={1}
            value={t.fontSize}
            onChange={(e) =>
              dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { fontSize: parseFloat(e.target.value) || 12 } })
            }
            data-testid="ins-text-fontsize"
          />
        </Field>
        <Field label="Text Color">
          <input
            type="color"
            value={t.textColor}
            onChange={(e) => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { textColor: e.target.value } })}
            data-testid="ins-text-color"
          />
        </Field>
        <Field label="Border">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={t.borderColor && t.borderColor !== "transparent"}
              onChange={(e) =>
                dispatch({
                  type: "TEXT_UPDATE",
                  id: t.id,
                  patch: {
                    borderColor: e.target.checked ? "#0F172A" : "transparent",
                    borderWidth: e.target.checked ? 1 : 0,
                  },
                })
              }
              data-testid="ins-text-border-toggle"
            />
            Show border
          </label>
          {t.borderColor && t.borderColor !== "transparent" && (
            <input
              type="color"
              value={t.borderColor}
              onChange={(e) => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { borderColor: e.target.value } })}
              data-testid="ins-text-border-color"
            />
          )}
        </Field>
        <Field label="Background">
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="color"
              value={t.bgColor && t.bgColor !== "transparent" ? t.bgColor : "#FBFAF4"}
              onChange={(e) => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { bgColor: e.target.value } })}
              data-testid="ins-text-bg-color"
              disabled={t.bgColor === "transparent"}
            />
            <label className="checkbox-row" style={{ fontSize: 10 }}>
              <input
                type="checkbox"
                checked={t.bgColor === "transparent"}
                onChange={(e) =>
                  dispatch({
                    type: "TEXT_UPDATE",
                    id: t.id,
                    patch: { bgColor: e.target.checked ? "transparent" : "#FBFAF4" },
                  })
                }
                data-testid="ins-text-bg-trans"
              />
              Transparent
            </label>
          </div>
        </Field>
        <Field label="Insert Shape">
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`hud-btn ${!t.shape || t.shape === "none" ? "active" : ""}`}
              style={{ flex: 1, justifyContent: "center", padding: "4px 6px" }}
              onClick={() => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { shape: "none" } })}
              data-testid="ins-text-shape-none"
              title="None"
            >
              <Ban size={11} />
            </button>
            <button
              type="button"
              className={`hud-btn ${t.shape === "arrow-up" ? "active" : ""}`}
              style={{ flex: 1, justifyContent: "center", padding: "4px 6px" }}
              onClick={() => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { shape: "arrow-up" } })}
              data-testid="ins-text-shape-arrow"
              title="Arrow up"
            >
              <ArrowUp size={11} />
            </button>
            <button
              type="button"
              className={`hud-btn ${t.shape === "circle" ? "active" : ""}`}
              style={{ flex: 1, justifyContent: "center", padding: "4px 6px" }}
              onClick={() => dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { shape: "circle" } })}
              data-testid="ins-text-shape-circle"
              title="Circle"
            >
              <Circle size={11} />
            </button>
          </div>
          {t.shape && t.shape !== "none" && (
            <input
              type="color"
              value={t.shapeColor || "#0F172A"}
              onChange={(e) =>
                dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { shapeColor: e.target.value } })
              }
              data-testid="ins-text-shape-color"
              style={{ marginTop: 4 }}
            />
          )}
        </Field>
        <Field label={`Rotation ${t.rotation || 0}°`}>
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            value={t.rotation || 0}
            onChange={(e) =>
              dispatch({ type: "TEXT_UPDATE", id: t.id, patch: { rotation: parseFloat(e.target.value) } })
            }
            data-testid="ins-text-rotation"
          />
        </Field>
        <button
          className="hud-btn danger"
          onClick={() => {
            dispatch({ type: "TEXT_DELETE", id: t.id });
            dispatch({ type: "SELECT_ITEM", item: null });
          }}
          data-testid="ins-text-delete"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    );
  }

  return null;
}

function Field({ label, children }) {
  return (
    <div className="inspector-field">
      <span className="hud-label">{label}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
