import { createContext, useContext, useReducer, useMemo, useEffect } from "react";
import { uid } from "@/lib/geometry";

const PlotterCtx = createContext(null);

const DEFAULT_STYLE = { color: "#1E293B", width: 2, opacity: 1 };

const initialState = {
  // Grid
  gridScale: { unit: "NM", unitsPerSquare: 5 },
  pxPerSquare: 48,

  // Tool + global style
  tool: "select", // select|adjuster|rblcursor|point|zone|circle|flight|turn|waypoint|textbox
  style: DEFAULT_STYLE,

  // Toggles
  showLegLabels: true,
  showNodes: true,

  // Cursor
  cursor: { x: 0, y: 0 },
  origin: { x: 0, y: 0 }, // canvas center reference (used only for default RBL if no user ref set)
  rblRef: null, // { x, y } user-selected RBL reference node

  // Unified zones (replaces exerciseBox+subZones)
  // { id, kind:'rbl'|'circle', points:[{x,y}], cx, cy, r, closed, style, name, visible }
  zones: [],
  activeZoneId: null, // currently being drawn (rbl)

  // Free points
  freePoints: [],

  // Aircraft / flight paths
  aircraft: [], // { id, team:1|2, callSign, type, color, commands:[], showWaypoints:true, visible:true }
  activeAircraftId: null,
  selectedAircraftId: null,

  // Tactical waypoints
  waypoints: [], // { id, aircraftId, team, name, segmentIndex, t }

  // Text notes
  textBoxes: [], // { id, x, y, text, fontSize, textColor, borderColor, rotation, name }

  // Map block (top-right pinned)
  mapBlock: {
    title: "TAC-01 · TOP-RIGHT MAP",
    subtitle: "Air Combat Exercise Chart",
  },

  // Selection (for retroactive edits)
  selectedItem: null, // { kind:'zone'|'aircraft'|'text'|'freepoint'|'waypoint', id }

  // Modal control
  modal: null,
  modalCtx: null,

  ctxMenu: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, tool: action.tool };
    case "SET_STYLE":
      return { ...state, style: { ...state.style, ...action.patch } };
    case "SET_GRID":
      return { ...state, gridScale: { ...state.gridScale, ...action.patch } };
    case "SET_PX_PER_SQUARE":
      return { ...state, pxPerSquare: action.value };
    case "SET_CURSOR":
      return { ...state, cursor: action.pos };
    case "SET_ORIGIN":
      return { ...state, origin: action.pos };
    case "SET_RBL_REF":
      return { ...state, rblRef: action.pos };
    case "TOGGLE":
      return { ...state, [action.key]: !state[action.key] };

    // Zones (unified)
    case "ZONE_START": {
      const id = uid();
      const n = state.zones.filter((z) => z.kind === "rbl").length + 1;
      return {
        ...state,
        zones: [
          ...state.zones,
          {
            id,
            kind: "rbl",
            points: [],
            closed: false,
            style: { ...state.style },
            name: `Zone ${n}`,
            visible: true,
          },
        ],
        activeZoneId: id,
      };
    }
    case "ZONE_ADD_POINT": {
      const id = action.id || state.activeZoneId;
      if (!id) return state;
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === id ? { ...z, points: [...z.points, action.pt] } : z
        ),
      };
    }
    case "ZONE_FINISH": {
      const id = action.id || state.activeZoneId;
      return {
        ...state,
        zones: state.zones.map((z) => (z.id === id ? { ...z, closed: !!action.closed } : z)),
        activeZoneId: null,
      };
    }
    case "ZONE_CANCEL": {
      const id = state.activeZoneId;
      if (!id) return state;
      return {
        ...state,
        zones: state.zones.filter((z) => z.id !== id || z.points.length >= 2),
        activeZoneId: null,
      };
    }
    case "ZONE_REMOVE_LAST_POINT": {
      const id = state.activeZoneId;
      if (!id) return state;
      const z = state.zones.find((x) => x.id === id);
      if (!z) return state;
      if (z.points.length <= 1) {
        // Nothing left — cancel entirely
        return { ...state, zones: state.zones.filter((x) => x.id !== id), activeZoneId: null };
      }
      return {
        ...state,
        zones: state.zones.map((x) =>
          x.id === id ? { ...x, points: x.points.slice(0, -1) } : x
        ),
      };
    }
    case "ZONE_DELETE":
      return { ...state, zones: state.zones.filter((z) => z.id !== action.id) };
    case "ZONE_UPDATE":
      return {
        ...state,
        zones: state.zones.map((z) => (z.id === action.id ? { ...z, ...action.patch } : z)),
      };
    case "ZONE_STYLE":
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === action.id ? { ...z, style: { ...z.style, ...action.patch } } : z
        ),
      };
    case "ZONE_POINT_UPDATE":
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === action.id
            ? { ...z, points: z.points.map((p, i) => (i === action.index ? action.pt : p)) }
            : z
        ),
      };
    case "CIRCLE_ZONE_ADD": {
      const n = state.zones.filter((z) => z.kind === "circle").length + 1;
      return {
        ...state,
        zones: [
          ...state.zones,
          {
            id: uid(),
            kind: "circle",
            cx: action.cx,
            cy: action.cy,
            r: action.r,
            style: { ...state.style },
            name: `Circle Zone ${n}`,
            visible: true,
          },
        ],
      };
    }

    // Free points
    case "POINT_ADD":
      return {
        ...state,
        freePoints: [
          ...state.freePoints,
          { id: uid(), x: action.pt.x, y: action.pt.y, style: { ...state.style } },
        ],
      };
    case "POINT_DELETE":
      return { ...state, freePoints: state.freePoints.filter((p) => p.id !== action.id) };

    // Aircraft
    case "AIRCRAFT_ADD": {
      const ac = {
        ...action.aircraft,
        id: action.aircraft.id || uid(),
        commands: [],
        showWaypoints: true,
        visible: true,
      };
      return {
        ...state,
        aircraft: [...state.aircraft, ac],
        activeAircraftId: ac.id,
        selectedAircraftId: ac.id,
      };
    }
    case "AIRCRAFT_DELETE":
      return {
        ...state,
        aircraft: state.aircraft.filter((a) => a.id !== action.id),
        waypoints: state.waypoints.filter((w) => w.aircraftId !== action.id),
        activeAircraftId: state.activeAircraftId === action.id ? null : state.activeAircraftId,
        selectedAircraftId: state.selectedAircraftId === action.id ? null : state.selectedAircraftId,
      };
    case "AIRCRAFT_SELECT":
      return { ...state, selectedAircraftId: action.id, activeAircraftId: action.id };
    case "AIRCRAFT_UPDATE":
      return {
        ...state,
        aircraft: state.aircraft.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case "AIRCRAFT_ADD_COMMAND":
      return {
        ...state,
        aircraft: state.aircraft.map((a) =>
          a.id === action.id ? { ...a, commands: [...a.commands, action.cmd] } : a
        ),
      };
    case "AIRCRAFT_UPDATE_COMMAND":
      return {
        ...state,
        aircraft: state.aircraft.map((a) => {
          if (a.id !== action.id) return a;
          const cmds = a.commands.slice();
          cmds[action.index] = { ...cmds[action.index], ...action.patch };
          return { ...a, commands: cmds };
        }),
      };
    case "AIRCRAFT_REMOVE_LAST":
      return {
        ...state,
        aircraft: state.aircraft.map((a) =>
          a.id === action.id ? { ...a, commands: a.commands.slice(0, -1) } : a
        ),
      };
    case "AIRCRAFT_CLEAR_PATH":
      return {
        ...state,
        aircraft: state.aircraft.map((a) => (a.id === action.id ? { ...a, commands: [] } : a)),
        waypoints: state.waypoints.filter((w) => w.aircraftId !== action.id),
      };

    // Waypoints
    case "WAYPOINT_ADD":
      return { ...state, waypoints: [...state.waypoints, action.wp] };
    case "WAYPOINT_UPDATE":
      return {
        ...state,
        waypoints: state.waypoints.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)),
      };
    case "WAYPOINT_DELETE":
      return { ...state, waypoints: state.waypoints.filter((w) => w.id !== action.id) };

    // Text boxes
    case "TEXT_ADD":
      return {
        ...state,
        textBoxes: [
          ...state.textBoxes,
          {
            id: uid(),
            x: action.pt.x,
            y: action.pt.y,
            text: action.text || "Note",
            fontSize: 11,
            textColor: "#0F172A",
            bgColor: "#fbfaf4",
            borderColor: "transparent",
            borderWidth: 0,
            rotation: 0,
            shape: "none",
            shapeColor: "#0F172A",
            name: `Note ${state.textBoxes.length + 1}`,
          },
        ],
      };
    case "TEXT_UPDATE":
      return {
        ...state,
        textBoxes: state.textBoxes.map((t) =>
          t.id === action.id ? { ...t, ...action.patch } : t
        ),
      };
    case "TEXT_DELETE":
      return { ...state, textBoxes: state.textBoxes.filter((t) => t.id !== action.id) };

    case "MAPBLOCK_UPDATE":
      return { ...state, mapBlock: { ...state.mapBlock, ...action.patch } };

    case "SELECT_ITEM":
      return { ...state, selectedItem: action.item };

    case "SET_MODAL":
      return { ...state, modal: action.modal, modalCtx: action.ctx || null };
    case "SET_CTX_MENU":
      return { ...state, ctxMenu: action.menu };

    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

const LS_KEY = "acp_plotter_state_v3";

function loadInitial() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return { ...initialState, ...parsed, modal: null, ctxMenu: null, selectedItem: parsed.selectedItem || null };
  } catch {
    return initialState;
  }
}

export function PlotterProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      const { modal, ctxMenu, cursor, ...persist } = state;
      localStorage.setItem(LS_KEY, JSON.stringify(persist));
    } catch {
      // ignore
    }
  }, [state]);

  const api = useMemo(() => ({ state, dispatch }), [state]);
  return <PlotterCtx.Provider value={api}>{children}</PlotterCtx.Provider>;
}

export const usePlotter = () => {
  const v = useContext(PlotterCtx);
  if (!v) throw new Error("usePlotter must be used within PlotterProvider");
  return v;
};
