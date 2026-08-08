import { useState, useEffect } from "react";
import { PlotterProvider, usePlotter } from "./store";
import TopBar from "./TopBar";
import ShapeManager from "./ShapeManager";
import Inspector from "./Inspector";
import StatusBar from "./StatusBar";
import Canvas from "./Canvas";
import AircraftModal from "./AircraftModal";
import TurnModal from "./TurnModal";

function ContextMenu() {
  const { state, dispatch } = usePlotter();
  const menu = state.ctxMenu;
  if (!menu) return null;

  const close = () => dispatch({ type: "SET_CTX_MENU", menu: null });

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 150 }}
        onClick={close}
        onContextMenu={(e) => {
          e.preventDefault();
          close();
        }}
      />
      <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} data-testid="context-menu">
        {menu.type === "waypoint" && (
          <>
            <div className="ctx-item" onClick={close} data-testid="ctx-move">
              Move (drag on canvas)
            </div>
            <div
              className="ctx-item"
              data-testid="ctx-toggle-wp"
              onClick={() => {
                const ac = state.aircraft.find((a) => a.id === menu.aircraftId);
                if (ac) {
                  dispatch({
                    type: "AIRCRAFT_UPDATE",
                    id: ac.id,
                    patch: { showWaypoints: !(ac.showWaypoints !== false) },
                  });
                }
                close();
              }}
            >
              Toggle waypoints for aircraft
            </div>
            <div
              className="ctx-item danger"
              data-testid="ctx-delete"
              onClick={() => {
                dispatch({ type: "WAYPOINT_DELETE", id: menu.id });
                close();
              }}
            >
              Delete Point
            </div>
          </>
        )}
        {menu.type === "zonept" && (
          <>
            <div
              className="ctx-item"
              onClick={() => {
                dispatch({
                  type: "ZONE_UPDATE",
                  id: menu.id,
                  patch: {
                    points: state.zones
                      .find((z) => z.id === menu.id)
                      .points.filter((_, i) => i !== menu.index),
                  },
                });
                close();
              }}
            >
              Remove Vertex
            </div>
            <div className="ctx-item" onClick={close}>
              Cancel
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Shell() {
  const [aircraftModal, setAircraftModal] = useState({ open: false, team: 1 });
  const [turnModal, setTurnModal] = useState({ open: false, ctx: null });
  const { state, dispatch } = usePlotter();

  useEffect(() => {
    if (state.modal === "turn") {
      setTurnModal({ open: true, ctx: state.modalCtx });
      dispatch({ type: "SET_MODAL", modal: null, ctx: state.modalCtx });
    }
  }, [state.modal, state.modalCtx, dispatch]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ShapeManager
          onOpenAircraftModal={(team) => setAircraftModal({ open: true, team })}
          onOpenTurnModal={(aircraftId) => {
            dispatch({ type: "AIRCRAFT_SELECT", id: aircraftId });
            const ac = state.aircraft.find((a) => a.id === aircraftId);
            const independent = !ac || ac.commands.length === 0;
            const entryPoint = independent
              ? { x: state.origin.x, y: state.origin.y }
              : null;
            dispatch({
              type: "SET_MODAL",
              modal: "turn",
              ctx: { aircraftId, independent, entryPoint },
            });
          }}
        />
        <Canvas />
        <Inspector />
      </div>
      <StatusBar />
      <AircraftModal
        open={aircraftModal.open}
        initialTeam={aircraftModal.team}
        onClose={() => setAircraftModal({ open: false, team: 1 })}
      />
      <TurnModal open={turnModal.open} ctx={turnModal.ctx} onClose={() => setTurnModal({ open: false, ctx: null })} />
      <ContextMenu />
    </div>
  );
}

export default function PlotterApp() {
  return (
    <PlotterProvider>
      <Shell />
    </PlotterProvider>
  );
}
