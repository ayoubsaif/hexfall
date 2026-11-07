// Seat display names from the room store (fallback "Seat N").
import type { AvatarId, SeatInfo } from "@hexfall/protocol";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Names } from "../game/describe.ts";
import type { T } from "../i18n/index.ts";
import { useRoomStore } from "../store/room.ts";

export function namesFrom(seats: readonly SeatInfo[], t: T): Names {
  const bySeat = new Map(seats.map((s) => [s.seat, s.name]));
  return (seat) => bySeat.get(seat) ?? t("board.seat", { number: seat + 1 });
}

export function useNames(): Names {
  const seats = useRoomStore((s) => s.seats);
  const { t } = useTranslation();
  return useMemo(() => namesFrom(seats, t), [seats, t]);
}

/** Whether a seat is connected (true when the room store has no entry for it). */
export function useConnected(): (seat: number) => boolean {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const m = new Map(seats.map((s) => [s.seat, s.connected]));
    return (seat: number) => m.get(seat) ?? true;
  }, [seats]);
}

/** Whether a seat is open: its player left and a bot plays it until someone takes it over. */
export function useOpenSeat(): (seat: number) => boolean {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const open = new Set(seats.filter((s) => s.open === true).map((s) => s.seat));
    return (seat: number) => open.has(seat);
  }, [seats]);
}

/** Whether a seat is a bot that is not an open seat (open seats have their own badge). */
export function useBotSeat(): (seat: number) => boolean {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const bots = new Set(seats.filter((s) => s.bot && s.open !== true).map((s) => s.seat));
    return (seat: number) => bots.has(seat);
  }, [seats]);
}

/** Whether a seat is played by the server (a bot or an open seat). */
export function useServerSeat(): (seat: number) => boolean {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const bots = new Set(seats.filter((s) => s.bot).map((s) => s.seat));
    return (seat: number) => bots.has(seat);
  }, [seats]);
}

/** Human seats in the room (bots and open seats excluded). */
export function useHumanCount(): number {
  return useRoomStore((s) => s.seats.filter((x) => !x.bot).length);
}

/** A seat's avatar id from the room store (undefined when the seat is not listed). */
export function useAvatars(): (seat: number) => AvatarId | undefined {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const m = new Map(seats.map((s) => [s.seat, s.avatar]));
    return (seat: number) => m.get(seat);
  }, [seats]);
}
