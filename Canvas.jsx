import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePlotter } from "./store";
import {
  uid,
  dist,
  headingBetween,
  computeTurn,
  pointOnArc,
  pointOnSegment,
  pxToUnits,
  alphaLabel,
} from "@/lib/geometry";

const MINOR_PER_MAJOR = 5;
const HANDLE = 6;
const BORDER_PAD = 16;

function GridPattern({ pxPerSquare }) {
  const minor = pxPerSquare / MINOR_PER_MAJOR;
  return (
    <defs>
      <pattern id="minorGrid" width={minor} height={minor} patternUnits="userSpaceOnUse">
        <path d={`M ${minor} 0 L 0 0 0 ${minor}`} fill="none" stroke="#d3dde2" strokeWidth="0.5" />
      </pattern>
      <pattern id="majorGrid" width={pxPerSquare} height={pxPerSquare} patternUnits="userSpaceOnUse">
        <rect width={pxPerSquare} height={pxPerSquare} fill="url(#minorGrid)" />
        <path
          d={`M ${pxPerSquare} 0 L 0 0 0 ${pxPerSquare}`}
          fill="none"
          stroke="#8ea3b0"
          strokeWidth="1"
        />
      </pattern>
    </defs>
  );
}

export function buildPathSegments(commands) {
  const segs = [];
  if (!commands.length) return segs;
  let cur = null;
  let heading = null;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (c.type === "start") {
      cur = { x: c.x, y: c.y };
    } else if (c.type === "straight") {
      if (!cur) cur = { x: c.x, y: c.y };
      const b = { x: c.x, y: c.y };
      segs.push({ type: "line", a: cur, b, index: i });
      heading = headingBetween(cur, b);
      cur = b;
    } else if (c.type === "turn") {
      let entryPt = cur;
      let entryHeading = heading;
      if (entryPt == null && c.entry) entryPt = c.entry;
      if (entryHeading == null && typeof c.entryHeading === "number") entryHeading = c.entryHeading;
      if (entryPt == null || entryHeading == null) continue;
      const t = computeTurn(entryPt, entryHeading, c.side, c.degrees, c.radiusPx);
      segs.push({ type: "arc", turn: t, index: i, meta: c });
      cur = t.exit;
      heading = t.exitHeading;
    }
  }
  return segs;
}

export function pathEndState(commands) {
  const segs = buildPathSegments(commands);
  if (!segs.length) {
    const start = commands.find((c) => c.type === "start");
    return start ? { pos: { x: start.x, y: start.y }, heading: null } : { pos: null, heading: null };
  }
  const last = segs[segs.length - 1];
  if (last.type === "line") return { pos: last.b, heading: headingBetween(last.a, last.b) };
  return { pos: last.turn.exit, heading: last.turn.exitHeading };
}

// Zig-zag path between two nodes (sawtooth/wave pattern)
function zigzagPathD(a, b, opts = {}) {
  const amp = opts.amp ?? 6;
  const stepPx = opts.step ?? 14;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const ux = dx / len;
  const uy = dy / len;
  // perpendicular unit
  const px = -uy;
  const py = ux;
  const n = Math.max(3, Math.floor(len / stepPx));
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const bx = a.x + dx * t;
    const by = a.y + dy * t;
    const sign = i % 2 === 1 ? 1 : -1;
    const zx = bx + px * amp * sign;
    const zy = by + py * amp * sign;
    d += ` L ${zx} ${zy}`;
  }
  d += ` L ${b.x} ${b.y}`;
  return d;
}

// Bearing/range utility (compass, 0=N up, CW)
function bearingRange(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const r = Math.hypot(dx, dy);
  const b = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return { r, b };
}

export default function Canvas() {
  const { state, dispatch } = usePlotter();
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dragging, setDragging] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current.parentElement;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    dispatch({ type: "SET_ORIGIN", pos: { x: r.width / 2, y: r.height / 2 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSvgPos = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const {
    tool,
    zones,
    freePoints,
    aircraft,
    waypoints,
    textBoxes,
    style,
    pxPerSquare,
    gridScale,
    activeAircraftId,
    activeZoneId,
    origin,
    rblRef,
    showLegLabels,
    showNodes,
    selectedItem,
  } = state;

  const activeAircraft = aircraft.find((a) => a.id === activeAircraftId) || null;

  const snapPt = useCallback(
    (p, snap = true) => {
      if (!snap) return p;
      const minor = pxPerSquare / MINOR_PER_MAJOR;
      return { x: Math.round(p.x / minor) * minor, y: Math.round(p.y / minor) * minor };
    },
    [pxPerSquare]
  );

  const pxToUnitStr = useCallback(
    (px, digits = 2) =>
      `${pxToUnits(px, pxPerSquare, gridScale.unitsPerSquare).toFixed(digits)} ${gridScale.unit}`,
    [pxPerSquare, gridScale]
  );

  const handleMouseMove = (e) => {
    const p = getSvgPos(e);
    setHoverPos(p);
    dispatch({ type: "SET_CURSOR", pos: p });

    if (!dragging) return;
    const snapped = snapPt(p, !e.shiftKey);
    if (dragging.kind === "zonept") {
      dispatch({ type: "ZONE_POINT_UPDATE", id: dragging.id, index: dragging.index, pt: snapped });
    } else if (dragging.kind === "acpt") {
      dispatch({
        type: "AIRCRAFT_UPDATE_COMMAND",
        id: dragging.aircraftId,
        index: dragging.index,
        patch: { x: snapped.x, y: snapped.y },
      });
    } else if (dragging.kind === "waypoint") {
      const wp = waypoints.find((w) => w.id === dragging.id);
      if (wp) {
        const ac = aircraft.find((a) => a.id === wp.aircraftId);
        if (ac) {
          const segs = buildPathSegments(ac.commands);
          const proj = projectPointOntoSegments(p, segs);
          if (proj) {
            dispatch({
              type: "WAYPOINT_UPDATE",
              id: wp.id,
              patch: { segmentIndex: proj.segIdx, t: proj.t },
            });
          }
        }
      }
    } else if (dragging.kind === "text") {
      dispatch({ type: "TEXT_UPDATE", id: dragging.id, patch: { x: snapped.x, y: snapped.y } });
    } else if (dragging.kind === "circle") {
      dispatch({
        type: "ZONE_UPDATE",
        id: dragging.id,
        patch: { cx: snapped.x, cy: snapped.y },
      });
    }
  };

  const handleMouseUp = () => setDragging(null);

  const promptCircleRadius = (pt) => {
    const raw = window.prompt(`Enter circle radius in ${gridScale.unit}:`, "5");
    if (!raw) return;
    const rUnits = parseFloat(raw);
    if (!rUnits || rUnits <= 0) return;
    const rPx = (rUnits / gridScale.unitsPerSquare) * pxPerSquare;
    dispatch({ type: "CIRCLE_ZONE_ADD", cx: pt.x, cy: pt.y, r: rPx });
  };

  const handleClick = (e) => {
    if (e.button !== 0) return;
    const p = snapPt(getSvgPos(e), !e.shiftKey);

    switch (tool) {
      case "select":
      case "adjuster":
        if (selectedItem) dispatch({ type: "SELECT_ITEM", item: null });
        break;

      case "rblcursor":
        // Click to set/replace RBL reference node
        dispatch({ type: "SET_RBL_REF", pos: p });
        break;

      case "zone": {
        if (!activeZoneId) dispatch({ type: "ZONE_START" });
        setTimeout(() => dispatch({ type: "ZONE_ADD_POINT", pt: p }), 0);
        break;
      }
      case "point":
        dispatch({ type: "POINT_ADD", pt: p });
        break;
      case "circle":
        promptCircleRadius(p);
        break;
      case "textbox": {
        const t = window.prompt("Enter text (use \\n for new line):", "Note");
        if (t) {
          const text = t.replace(/\\n/g, "\n");
          dispatch({ type: "TEXT_ADD", pt: p, text });
        }
        break;
      }
      case "flight":
        if (!activeAircraft) {
          alert("Add an aircraft first (Team panel → + New Aircraft).");
          return;
        }
        if (activeAircraft.commands.length === 0) {
          dispatch({
            type: "AIRCRAFT_ADD_COMMAND",
            id: activeAircraft.id,
            cmd: { type: "start", x: p.x, y: p.y },
          });
        } else {
          dispatch({
            type: "AIRCRAFT_ADD_COMMAND",
            id: activeAircraft.id,
            cmd: { type: "straight", x: p.x, y: p.y },
          });
        }
        break;
      case "turn": {
        if (!activeAircraft) {
          alert("Select an aircraft first.");
          return;
        }
        const { pos, heading } = pathEndState(activeAircraft.commands);
        dispatch({
          type: "SET_MODAL",
          modal: "turn",
          ctx: {
            aircraftId: activeAircraft.id,
            independent: heading == null,
            entryPoint: heading == null ? p : pos,
          },
        });
        break;
      }
      case "waypoint": {
        let best = null;
        aircraft.forEach((ac) => {
          if (!ac.showWaypoints) return;
          const segs = buildPathSegments(ac.commands);
          const proj = projectPointOntoSegments(p, segs);
          if (proj && (!best || proj.dist < best.dist)) best = { ...proj, aircraft: ac };
        });
        if (!best || best.dist > 24) return;
        const teamCount = waypoints.filter((w) => w.team === best.aircraft.team).length;
        dispatch({
          type: "WAYPOINT_ADD",
          wp: {
            id: uid(),
            aircraftId: best.aircraft.id,
            team: best.aircraft.team,
            name: alphaLabel(teamCount) + (best.aircraft.team === 2 ? "'" : ""),
            segmentIndex: best.segIdx,
            t: best.t,
          },
        });
        break;
      }
      default:
        break;
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    // RBL Cursor mode: right-click clears reference
    if (tool === "rblcursor" && rblRef) {
      dispatch({ type: "SET_RBL_REF", pos: null });
      return;
    }
    // Zone drawing: erase last point/line
    if (activeZoneId) {
      dispatch({ type: "ZONE_REMOVE_LAST_POINT" });
      return;
    }
    // Flight path drawing: remove last command
    if (tool === "flight" && activeAircraft && activeAircraft.commands.length > 0) {
      dispatch({ type: "AIRCRAFT_REMOVE_LAST", id: activeAircraft.id });
      return;
    }
    // Close any open context menu
    if (state.ctxMenu) {
      dispatch({ type: "SET_CTX_MENU", menu: null });
    }
  };

  const handleDoubleClick = () => {
    // Finish an active zone if being drawn — kept OPEN (no auto-close)
    if (tool === "zone" && activeZoneId) {
      dispatch({ type: "ZONE_FINISH", id: activeZoneId, closed: false });
      dispatch({ type: "SET_TOOL", tool: "select" });
      return;
    }
    // Any drawing tool: switch back to select
    if (["zone", "circle", "point", "textbox", "flight", "turn", "waypoint", "rblcursor"].includes(tool)) {
      dispatch({ type: "SET_TOOL", tool: "select" });
    }
  };

  // Live preview + R/B tooltip near cursor
  const previewInfo = useMemo(() => {
    if (!hoverPos) return null;
    let from = null;
    let color = "#0f172a";
    if (tool === "zone" && activeZoneId) {
      const z = zones.find((x) => x.id === activeZoneId);
      if (z && z.points.length > 0) {
        from = z.points[z.points.length - 1];
        color = z.style.color;
      }
    } else if (tool === "flight" && activeAircraft) {
      const { pos } = pathEndState(activeAircraft.commands);
      if (pos) {
        from = pos;
        color = activeAircraft.color;
      }
    }
    if (!from) return null;
    const { r, b } = bearingRange(from, hoverPos);
    const rU = pxToUnits(r, pxPerSquare, gridScale.unitsPerSquare);
    return {
      from,
      to: hoverPos,
      color,
      rangeText: `${rU.toFixed(2)} ${gridScale.unit}`,
      bearingText: `${b.toFixed(0)}°`,
    };
  }, [hoverPos, tool, zones, activeZoneId, activeAircraft, pxPerSquare, gridScale]);

  // RBL Cursor readout — from user-set reference, else from origin
  const rblReadout = useMemo(() => {
    if (tool !== "rblcursor" || !hoverPos) return null;
    const ref = rblRef || origin;
    const { r, b } = bearingRange(ref, hoverPos);
    const rU = pxToUnits(r, pxPerSquare, gridScale.unitsPerSquare);
    return {
      ref,
      range: `${rU.toFixed(2)} ${gridScale.unit}`,
      bearing: `${b.toFixed(0)}°`,
      hasCustomRef: !!rblRef,
    };
  }, [tool, hoverPos, rblRef, origin, pxPerSquare, gridScale]);

  return (
    <div className="paper-canvas flex-1 relative" data-testid="plotter-canvas-container">
      <svg
        ref={svgRef}
        className="draw-svg"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDragging(null)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ cursor: dragging ? "grabbing" : "crosshair", background: "var(--paper-bg)" }}
        data-testid="plotter-svg"
      >
        <GridPattern pxPerSquare={pxPerSquare} />
        <rect x={0} y={0} width={size.w} height={size.h} fill="url(#majorGrid)" />

        {/* Origin cross */}
        <g pointerEvents="none" opacity={0.35}>
          <line x1={origin.x - 10} y1={origin.y} x2={origin.x + 10} y2={origin.y} stroke="#0f172a" />
          <line x1={origin.x} y1={origin.y - 10} x2={origin.x} y2={origin.y + 10} stroke="#0f172a" />
          <text x={origin.x + 6} y={origin.y - 4} fontSize="9" fill="#475569">
            0,0
          </text>
        </g>

        {/* Zones */}
        {zones
          .filter((z) => z.visible !== false)
          .map((z) => (
            <ZoneRender
              key={z.id}
              z={z}
              active={z.id === activeZoneId}
              selected={selectedItem?.kind === "zone" && selectedItem.id === z.id}
              tool={tool}
              onSelect={() => dispatch({ type: "SELECT_ITEM", item: { kind: "zone", id: z.id } })}
              onPtDown={(idx) => setDragging({ kind: "zonept", id: z.id, index: idx })}
              onCircleDown={() => setDragging({ kind: "circle", id: z.id })}
              onCtx={(e, index) => {
                e.preventDefault();
                e.stopPropagation();
                dispatch({
                  type: "SET_CTX_MENU",
                  menu: { x: e.clientX, y: e.clientY, type: "zonept", id: z.id, index },
                });
              }}
            />
          ))}

        {/* Free points */}
        {freePoints.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={p.style.color}
            stroke="#fff"
            strokeWidth={1}
            opacity={p.style.opacity}
          />
        ))}

        {/* Aircraft paths */}
        {aircraft
          .filter((a) => a.visible !== false)
          .map((ac) => (
            <AircraftPath
              key={ac.id}
              ac={ac}
              selected={ac.id === state.selectedAircraftId}
              selectedItem={selectedItem}
              waypoints={waypoints.filter((w) => w.aircraftId === ac.id)}
              tool={tool}
              pxToUnitStr={pxToUnitStr}
              showLegLabels={showLegLabels}
              showNodes={showNodes}
              onNodeDrag={(idx) => setDragging({ kind: "acpt", aircraftId: ac.id, index: idx })}
              onWpDrag={(id) => setDragging({ kind: "waypoint", id })}
              onSelectAircraft={() =>
                dispatch({ type: "SELECT_ITEM", item: { kind: "aircraft", id: ac.id } })
              }
              onSelectSegment={(cmdIndex) =>
                dispatch({
                  type: "SELECT_ITEM",
                  item: { kind: "segment", aircraftId: ac.id, commandIndex: cmdIndex },
                })
              }
              onWpContext={(e, wp) => {
                e.preventDefault();
                e.stopPropagation();
                dispatch({
                  type: "SET_CTX_MENU",
                  menu: {
                    x: e.clientX,
                    y: e.clientY,
                    type: "waypoint",
                    id: wp.id,
                    aircraftId: ac.id,
                  },
                });
              }}
            />
          ))}

        {/* Text boxes (dialog style) */}
        {textBoxes.map((t) => (
          <TextBoxRender
            key={t.id}
            t={t}
            selected={selectedItem?.kind === "text" && selectedItem.id === t.id}
            tool={tool}
            onSelect={() => dispatch({ type: "SELECT_ITEM", item: { kind: "text", id: t.id } })}
            onDrag={() => setDragging({ kind: "text", id: t.id })}
          />
        ))}

        {/* Preview line (with R/B tip near cursor) */}
        {previewInfo && (
          <g pointerEvents="none">
            <line
              x1={previewInfo.from.x}
              y1={previewInfo.from.y}
              x2={previewInfo.to.x}
              y2={previewInfo.to.y}
              stroke={previewInfo.color}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <TooltipBadge
              x={previewInfo.to.x + 14}
              y={previewInfo.to.y - 26}
              lines={[
                { text: `R ${previewInfo.rangeText}`, color: "#0f172a" },
                { text: `B ${previewInfo.bearingText}`, color: "#0f172a" },
              ]}
              accent={previewInfo.color}
              transparent
            />
          </g>
        )}

        {/* RBL Cursor overlay */}
        {tool === "rblcursor" && (
          <g pointerEvents="none">
            {rblRef && (
              <g>
                <circle cx={rblRef.x} cy={rblRef.y} r={7} fill="none" stroke="#ea580c" strokeWidth={1.5} />
                <line x1={rblRef.x - 8} y1={rblRef.y} x2={rblRef.x + 8} y2={rblRef.y} stroke="#ea580c" />
                <line x1={rblRef.x} y1={rblRef.y - 8} x2={rblRef.x} y2={rblRef.y + 8} stroke="#ea580c" />
                <text x={rblRef.x + 10} y={rblRef.y + 14} fontSize={9} fill="#ea580c" fontFamily="'JetBrains Mono', monospace">
                  RBL REF
                </text>
              </g>
            )}
            {hoverPos && rblReadout && (
              <>
                <line
                  x1={rblReadout.ref.x}
                  y1={rblReadout.ref.y}
                  x2={hoverPos.x}
                  y2={hoverPos.y}
                  stroke="#ea580c"
                  strokeWidth={1.2}
                  strokeDasharray="6 3"
                />
                <circle cx={hoverPos.x} cy={hoverPos.y} r={5} fill="none" stroke="#ea580c" strokeWidth={1.5} />
                <TooltipBadge
                  x={hoverPos.x + 12}
                  y={hoverPos.y - 34}
                  lines={[
                    {
                      text: rblReadout.hasCustomRef ? "RBL · from node" : "RBL · from origin",
                      color: "#ea580c",
                      small: true,
                    },
                    { text: `R ${rblReadout.range}`, color: "#0f172a" },
                    { text: `B ${rblReadout.bearing}`, color: "#0f172a" },
                  ]}
                  accent="#ea580c"
                  transparent
                />
              </>
            )}
          </g>
        )}

        {/* Simple hover crosshair */}
        {hoverPos && tool !== "rblcursor" && !previewInfo && (
          <g pointerEvents="none" opacity={0.4}>
            <circle cx={hoverPos.x} cy={hoverPos.y} r={3} fill="none" stroke="#0f172a" strokeWidth={1} />
          </g>
        )}

        {/* Quick "Add Turn" affordance at last node of active aircraft */}
        {activeAircraft && (tool === "flight" || tool === "select" || tool === "adjuster") && (() => {
          const end = pathEndState(activeAircraft.commands);
          if (!end.pos) return null;
          const bx = end.pos.x + 18;
          const by = end.pos.y - 18;
          return (
            <g
              data-testid={`quick-turn-${activeAircraft.callSign}`}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: "SET_MODAL",
                  modal: "turn",
                  ctx: {
                    aircraftId: activeAircraft.id,
                    independent: end.heading == null,
                    entryPoint: end.pos,
                  },
                });
              }}
            >
              <circle
                cx={bx}
                cy={by}
                r={9}
                fill={activeAircraft.color}
                stroke="#fff"
                strokeWidth={1.5}
                opacity={0.95}
              />
              {/* Simple circular-arrow glyph */}
              <path
                d={`M ${bx - 4} ${by - 1} a 4 4 0 1 0 4 -4`}
                fill="none"
                stroke="#fff"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
              <polygon
                points={`${bx + 4},${by - 5} ${bx + 6.5},${by - 2.5} ${bx + 1.5},${by - 2.5}`}
                fill="#fff"
              />
            </g>
          );
        })()}

        {/* Outer black border frame */}
        <rect
          x={BORDER_PAD}
          y={BORDER_PAD}
          width={size.w - BORDER_PAD * 2}
          height={size.h - BORDER_PAD * 2}
          fill="none"
          stroke="#000"
          strokeWidth={2}
          pointerEvents="none"
        />
        <rect
          x={BORDER_PAD - 4}
          y={BORDER_PAD - 4}
          width={size.w - (BORDER_PAD - 4) * 2}
          height={size.h - (BORDER_PAD - 4) * 2}
          fill="none"
          stroke="#000"
          strokeWidth={0.5}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}

// -------- Tooltip badge helper --------
function TooltipBadge({ x, y, lines, accent, transparent }) {
  const widest = Math.max(...lines.map((l) => l.text.length));
  const w = widest * 6.5 + 16;
  const h = lines.length * 14 + 8;
  return (
    <g>
      {!transparent && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3}
          fill="#fbfaf4"
          stroke={accent || "#0f172a"}
          strokeWidth={1}
          opacity={0.95}
        />
      )}
      {lines.map((l, i) => (
        <text
          key={i}
          x={x + 8}
          y={y + 13 + i * 14}
          fontSize={l.small ? 9 : 11}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={l.small ? 600 : 700}
          fill={l.color}
          style={
            transparent
              ? { paintOrder: "stroke", stroke: "#fbfaf4", strokeWidth: 3, strokeLinejoin: "round" }
              : undefined
          }
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

// -------- Zone render --------
function ZoneRender({ z, active, selected, tool, onSelect, onPtDown, onCircleDown, onCtx }) {
  const interactive = tool === "select" || tool === "adjuster";
  if (z.kind === "circle") {
    return (
      <g data-testid={`zone-circle-${z.id}`}>
        <circle
          cx={z.cx}
          cy={z.cy}
          r={z.r}
          fill={z.style.color}
          fillOpacity={0.05}
          stroke={z.style.color}
          strokeWidth={selected ? z.style.width + 1 : z.style.width}
          strokeDasharray={selected ? "6 3" : "0"}
          opacity={z.style.opacity}
          onClick={(e) => {
            if (interactive) {
              e.stopPropagation();
              onSelect();
            }
          }}
          style={{ cursor: interactive ? "pointer" : "crosshair" }}
        />
        <circle
          cx={z.cx}
          cy={z.cy}
          r={3}
          fill={z.style.color}
          stroke="#fff"
          strokeWidth={1}
          onMouseDown={(e) => {
            if (interactive) {
              e.stopPropagation();
              onCircleDown();
            }
          }}
          style={{ cursor: interactive ? "grab" : "crosshair" }}
        />
      </g>
    );
  }
  if (z.points.length === 0) return null;
  const pathD =
    "M " + z.points.map((p) => `${p.x} ${p.y}`).join(" L ") + (z.closed ? " Z" : "");
  return (
    <g data-testid={`zone-rbl-${z.id}`}>
      <path
        d={pathD}
        fill={z.closed ? z.style.color : "none"}
        fillOpacity={z.closed ? 0.06 : 0}
        stroke={z.style.color}
        strokeWidth={selected ? z.style.width + 1 : z.style.width}
        strokeDasharray={active ? "6 3" : selected ? "3 3" : "0"}
        opacity={z.style.opacity}
        strokeLinejoin="round"
        onClick={(e) => {
          if (interactive) {
            e.stopPropagation();
            onSelect();
          }
        }}
        style={{ cursor: interactive ? "pointer" : "crosshair" }}
      />
      {z.points.map((p, i) => (
        <rect
          key={i}
          x={p.x - HANDLE / 2}
          y={p.y - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          fill={z.style.color}
          stroke="#fff"
          strokeWidth={1}
          data-testid={`zone-handle-${z.id}-${i}`}
          onMouseDown={(e) => {
            if (interactive) {
              e.stopPropagation();
              onPtDown(i);
            }
          }}
          onContextMenu={(e) => onCtx(e, i)}
          style={{ cursor: interactive ? "grab" : "crosshair" }}
        />
      ))}
    </g>
  );
}

// -------- Aircraft path (with optional curly rendering) --------
function AircraftPath({
  ac,
  selected,
  selectedItem,
  waypoints,
  tool,
  pxToUnitStr,
  showLegLabels,
  showNodes,
  onNodeDrag,
  onWpDrag,
  onSelectAircraft,
  onSelectSegment,
  onWpContext,
}) {
  const segs = useMemo(() => buildPathSegments(ac.commands), [ac.commands]);
  const color = ac.color;
  const interactive = tool === "select" || tool === "adjuster";

  return (
    <g data-testid={`aircraft-path-${ac.callSign}`}>
      {segs.map((s, i) => {
        // s.index maps back to the command index in ac.commands
        const cmd = ac.commands[s.index];
        const isSegSelected =
          selectedItem?.kind === "segment" &&
          selectedItem.aircraftId === ac.id &&
          selectedItem.commandIndex === s.index;
        const segWidth = isSegSelected ? 4 : selected ? 3 : 2.5;
        if (s.type === "line") {
          const curlySeg = cmd && cmd.curly === true;
          const commonProps = {
            "data-testid": `ac-seg-${ac.callSign}-${s.index}`,
            stroke: color,
            strokeWidth: segWidth,
            strokeLinecap: "round",
            fill: "none",
            onClick: (e) => {
              if (interactive) {
                e.stopPropagation();
                onSelectSegment(s.index);
              }
            },
            style: { cursor: interactive ? "pointer" : "crosshair" },
          };
          if (curlySeg) {
            return <path key={i} d={zigzagPathD(s.a, s.b)} {...commonProps} strokeLinejoin="round" />;
          }
          return (
            <line
              key={i}
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              {...commonProps}
            />
          );
        }
        const t = s.turn;
        return (
          <path
            key={i}
            data-testid={`ac-seg-${ac.callSign}-${s.index}`}
            d={`M ${t.center.x + t.radius * Math.cos(t.entryAngle)} ${
              t.center.y + t.radius * Math.sin(t.entryAngle)
            } A ${t.radius} ${t.radius} 0 ${t.largeArc} ${t.sweepFlag} ${t.exit.x} ${t.exit.y}`}
            fill="none"
            stroke={color}
            strokeWidth={segWidth}
            strokeLinecap="round"
            onClick={(e) => {
              if (interactive) {
                e.stopPropagation();
                onSelectSegment(s.index);
              }
            }}
            style={{ cursor: interactive ? "pointer" : "crosshair" }}
          />
        );
      })}

      {/* Leg labels — only for turn arcs (radius/angle info). Line-leg distance tiles removed. */}
      {showLegLabels &&
        segs.map((s, i) => {
          if (s.type === "line") return null;
          const t = s.turn;
          const midT = pointOnArc(t, 0.5);
          const rLbl = `R ${pxToUnitStr(t.radius, 2)} · ${t.sweepDeg}°${t.side === "left" ? "L" : "R"}`;
          return (
            <g key={`lbl-${i}`} pointerEvents="none">
              <rect
                className="leg-badge"
                x={midT.x - rLbl.length * 3 - 4}
                y={midT.y - 8}
                width={rLbl.length * 6 + 8}
                height={14}
                rx={2}
              />
              <text className="leg-text" x={midT.x} y={midT.y + 3} textAnchor="middle">
                {rLbl}
              </text>
            </g>
          );
        })}

      {/* Nodes */}
      {showNodes &&
        ac.commands.map((c, i) => {
          if (c.type !== "start" && c.type !== "straight") return null;
          return (
            <circle
              key={i}
              data-testid={`ac-node-${ac.callSign}-${i}`}
              cx={c.x}
              cy={c.y}
              r={selected ? 4 : 3}
              fill={color}
              stroke="#fff"
              strokeWidth={1.5}
              style={{ cursor: tool === "adjuster" || tool === "select" ? "grab" : "default" }}
              onMouseDown={(e) => {
                if (tool === "adjuster" || tool === "select") {
                  e.stopPropagation();
                  onNodeDrag(i);
                }
              }}
            />
          );
        })}

      {/* Aircraft label */}
      {ac.commands[0] && (
        <g pointerEvents="none">
          <rect
            x={(ac.commands[0].x ?? ac.commands[0].entry?.x ?? 0) + 8}
            y={(ac.commands[0].y ?? ac.commands[0].entry?.y ?? 0) - 20}
            width={ac.callSign.length * 8 + 12}
            height={16}
            fill={color}
            rx={2}
          />
          <text
            x={(ac.commands[0].x ?? ac.commands[0].entry?.x ?? 0) + 14}
            y={(ac.commands[0].y ?? ac.commands[0].entry?.y ?? 0) - 8}
            fill="#fff"
            fontSize="11"
            fontWeight="700"
            fontFamily="'JetBrains Mono', monospace"
          >
            {ac.callSign}
          </text>
        </g>
      )}

      {/* Waypoints */}
      {ac.showWaypoints !== false &&
        waypoints.map((wp) => {
          const seg = segs[wp.segmentIndex];
          if (!seg) return null;
          const pos =
            seg.type === "line" ? pointOnSegment(seg.a, seg.b, wp.t) : pointOnArc(seg.turn, wp.t);
          return (
            <g key={wp.id} data-testid={`waypoint-${wp.name}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={10}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => {
                  if (tool === "select" || tool === "adjuster") {
                    e.stopPropagation();
                    onWpDrag(wp.id);
                  }
                }}
                onContextMenu={(e) => onWpContext(e, wp)}
              />
              <text className="wp-label" x={pos.x} y={pos.y + 0.5} pointerEvents="none">
                {wp.name}
              </text>
            </g>
          );
        })}
    </g>
  );
}

// -------- Text Box (compact, semi-transparent, no header) --------
function TextBoxRender({ t, selected, tool, onSelect, onDrag }) {
  const interactive = tool === "select" || tool === "adjuster";
  const lines = (t.text || "").split(/\n/);
  const fontSize = t.fontSize || 12;
  const lineH = fontSize * 1.3;
  const padX = 6;
  const padY = 4;
  const shape = t.shape || "none";
  const shapeSize = fontSize * 1.4;
  const contentW = Math.max(
    ...lines.map((l) => l.length * (fontSize * 0.6)),
    shape !== "none" ? shapeSize + 8 : 0,
    30
  );
  const w = contentW + padX * 2;
  const h = padY * 2 + lines.length * lineH + (shape !== "none" ? shapeSize + 4 : 0);

  const borderColor = t.borderColor || "transparent";
  // 70% transparent background = 30% opacity fill
  const bg = t.bgColor && t.bgColor !== "transparent" ? t.bgColor : "#fbfaf4";
  const bgOpacity = t.bgColor === "transparent" ? 0 : 0.3;

  return (
    <g
      transform={`translate(${t.x} ${t.y}) rotate(${t.rotation || 0})`}
      data-testid={`textbox-${t.id}`}
      style={{ cursor: interactive ? "grab" : "crosshair" }}
    >
      {/* Compact frame with 70% transparency */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={bg}
        fillOpacity={bgOpacity}
        stroke={selected ? "#f59e0b" : borderColor}
        strokeWidth={selected ? 1.2 : t.borderWidth || 0}
        strokeDasharray={selected ? "3 2" : "0"}
        rx={2}
        onClick={(e) => {
          if (interactive) {
            e.stopPropagation();
            onSelect();
          }
        }}
        onMouseDown={(e) => {
          if (interactive) {
            e.stopPropagation();
            onSelect();
            onDrag();
          }
        }}
      />

      {/* Embedded shape */}
      {shape === "arrow-up" && (
        <g transform={`translate(0 ${-h / 2 + padY + shapeSize / 2})`} pointerEvents="none">
          <line
            x1={0}
            y1={-shapeSize / 2}
            x2={0}
            y2={shapeSize / 2}
            stroke={t.shapeColor || "#0f172a"}
            strokeWidth={1.2}
          />
          <polygon
            points={`0,${-shapeSize / 2 - 2} ${-shapeSize / 4},${-shapeSize / 4} ${shapeSize / 4},${-shapeSize / 4}`}
            fill={t.shapeColor || "#0f172a"}
          />
        </g>
      )}
      {shape === "circle" && (
        <circle
          cx={0}
          cy={-h / 2 + padY + shapeSize / 2}
          r={shapeSize / 2}
          fill="none"
          stroke={t.shapeColor || "#0f172a"}
          strokeWidth={1.2}
          pointerEvents="none"
        />
      )}

      {/* Text (multi-line) */}
      <g pointerEvents="none">
        {lines.map((ln, i) => (
          <text
            key={i}
            x={0}
            y={-h / 2 + padY + (shape !== "none" ? shapeSize + 4 : 0) + fontSize + i * lineH}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={fontSize}
            fill={t.textColor || "#0F172A"}
          >
            {ln}
          </text>
        ))}
      </g>
    </g>
  );
}

// -------- Projection helper --------
function projectPointOntoSegments(p, segs) {
  let best = null;
  segs.forEach((s, idx) => {
    if (s.type === "line") {
      const { a, b } = s;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 === 0) return;
      let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const pos = { x: a.x + abx * t, y: a.y + aby * t };
      const d = dist(pos, p);
      if (!best || d < best.dist) best = { segIdx: idx, t, dist: d, pos };
    } else if (s.type === "arc") {
      const t = s.turn;
      const dx = p.x - t.center.x;
      const dy = p.y - t.center.y;
      const angleP = Math.atan2(dy, dx);
      const a0 = t.entryAngle;
      const a1 = t.exitAngle;
      const sweep = a1 - a0;
      if (sweep === 0) return;
      const candidates = [
        (angleP - a0) / sweep,
        (angleP + 2 * Math.PI - a0) / sweep,
        (angleP - 2 * Math.PI - a0) / sweep,
      ];
      let bestCand = null;
      for (const c of candidates) {
        if (c >= 0 && c <= 1) {
          if (bestCand == null || Math.abs(c - 0.5) < Math.abs(bestCand - 0.5)) bestCand = c;
        }
      }
      if (bestCand == null) bestCand = Math.max(0, Math.min(1, (angleP - a0) / sweep));
      const pos = pointOnArc(t, bestCand);
      const d = dist(pos, p);
      if (!best || d < best.dist) best = { segIdx: idx, t: bestCand, dist: d, pos };
    }
  });
  return best;
}
