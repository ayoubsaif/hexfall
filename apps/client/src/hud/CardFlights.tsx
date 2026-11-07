// Card flights overlay (openspec/changes/card-flight-animations, specs/card-flights): every card
// transfer in a live update draws small cards that fade in at the source, arc to the destination
// and fade out there. Sources and destinations are the bank (board center), a seat's player panel
// (`[data-seat]`) or the viewer's own hand slot. Snapshots, reduced motion and hidden tabs draw
// nothing; the layer never takes pointer input. Mount once while a game view is present.
import type { Seat } from "@hexfall/engine";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type Flight,
  type FlightEndpoint,
  type FlightFace,
  flightsForEvents,
} from "../game/cardFlights.ts";
import { prefersReducedMotion } from "../store/motion.ts";
import { useGameStore } from "../store/game.ts";
import { GameCard } from "./cards/GameCard.tsx";

const DURATION_MS = 700;

interface Point {
  x: number;
  y: number;
}

interface LiveFlight {
  id: number;
  face: FlightFace;
  from: Point;
  to: Point;
  delay: number;
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  // Hand cards are half below the screen edge: aim at their visible part.
  return { x: r.left + r.width / 2, y: Math.min(r.top + r.height / 2, window.innerHeight - 36) };
}

/** The board center stands for the bank. */
function bankPoint(): Point {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
}

function ownSlot(face: FlightFace): Element | null {
  const hand = document.querySelector('[data-testid="hand"]');
  if (!hand) return null;
  const slot =
    face.kind === "resource"
      ? hand.querySelector(`[data-resource="${face.resource}"]`)
      : face.kind === "dev"
        ? hand.querySelector(`li [data-card="${face.card}"]`)
        : null;
  return slot ?? hand.querySelector("ul") ?? hand;
}

function pointFor(end: FlightEndpoint, face: FlightFace, viewer: Seat | null): Point {
  if (end.kind === "bank") return bankPoint();
  const el =
    end.seat === viewer
      ? ownSlot(face)
      : document.querySelector(`[data-testid="player-panel"][data-seat="${end.seat}"]`);
  return el ? centerOf(el) : bankPoint();
}

function FlyingCard({ flight, onDone }: { flight: LiveFlight; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      onDone(flight.id);
      return;
    }
    const dx = flight.to.x - flight.from.x;
    const dy = flight.to.y - flight.from.y;
    // A gentle arc: the midpoint rises by a share of the distance.
    const lift = Math.min(80, Math.hypot(dx, dy) * 0.18);
    const at = (k: number, up: number, scale: number) =>
      `translate(-50%, -50%) translate(${dx * k}px, ${dy * k - up}px) scale(${scale})`;
    const anim = el.animate(
      [
        { offset: 0, opacity: 0, transform: at(0, 0, 0.7) },
        { offset: 0.15, opacity: 1, transform: at(0.02, 10, 1) },
        { offset: 0.55, opacity: 1, transform: at(0.5, lift, 0.95) },
        { offset: 0.8, opacity: 1, transform: at(0.92, 6, 0.8) },
        { offset: 1, opacity: 0, transform: at(1, 0, 0.6) },
      ],
      { duration: DURATION_MS, delay: flight.delay, easing: "ease-in-out", fill: "both" },
    );
    anim.onfinish = () => onDone(flight.id);
    return () => anim.cancel();
  }, [flight, onDone]);
  const { face } = flight;
  return (
    <div
      ref={ref}
      data-testid="card-flight"
      data-face={
        face.kind === "resource" ? face.resource : face.kind === "dev" ? face.card : "back"
      }
      className="absolute opacity-0 drop-shadow-[0_6px_8px_rgb(0_0_0/45%)]"
      style={{ left: flight.from.x, top: flight.from.y }}
    >
      {face.kind === "resource" ? (
        <GameCard size="md" layout="peek" hideName resource={face.resource} label="" />
      ) : face.kind === "dev" ? (
        <GameCard size="md" hideName dev={face.card} label="" />
      ) : (
        <span className="block aspect-[5/7] w-14 rounded-xl border-[3px] border-[#c9a04e]/70 bg-leather shadow-md shadow-black/30" />
      )}
    </div>
  );
}

export function CardFlights() {
  const [flights, setFlights] = useState<LiveFlight[]>([]);
  const nextId = useRef(0);
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.source !== "update" || s.lastEvents === prev.lastEvents || !s.view) return;
        if (prefersReducedMotion() || document.visibilityState === "hidden") return;
        const viewer = s.view.viewer;
        const fresh = flightsForEvents(s.lastEvents, viewer).map((f: Flight): LiveFlight => ({
          id: nextId.current++,
          face: f.face,
          from: pointFor(f.from, f.face, viewer),
          to: pointFor(f.to, f.face, viewer),
          delay: f.delay,
        }));
        if (fresh.length > 0) setFlights((list) => [...list, ...fresh]);
      }),
    [],
  );
  const [onDone] = useState(
    () => (id: number) => setFlights((list) => list.filter((f) => f.id !== id)),
  );
  if (flights.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {flights.map((f) => (
        <FlyingCard key={f.id} flight={f} onDone={onDone} />
      ))}
    </div>
  );
}
