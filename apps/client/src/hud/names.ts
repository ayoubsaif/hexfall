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

/** A seat's avatar id from the room store (undefined when the seat is not listed). */
export function useAvatars(): (seat: number) => AvatarId | undefined {
  const seats = useRoomStore((s) => s.seats);
  return useMemo(() => {
    const m = new Map(seats.map((s) => [s.seat, s.avatar]));
    return (seat: number) => m.get(seat);
  }, [seats]);
}
