import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
// Player trading in the HUD (openspec player-trading; specs/player-trade): the composer, the
// Trade with players button, the open offers tray and the new-offer toast.
import type { GameState } from "@hexfall/engine";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toastFor } from "../../src/game/describe.ts";
import { Toasts } from "../../src/hud/Feed.tsx";
import { FRESH_MS, OffersTray } from "../../src/hud/OffersTray.tsx";
import { TradePanel } from "../../src/hud/TradePanel.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { namesFrom } from "../../src/hud/names.ts";
import { fixedT, i18n } from "../../src/i18n/index.ts";
import { useGameStore } from "../../src/store/game.ts";
import { bindUiToGame, openTrade, useUiStore } from "../../src/store/ui.ts";
import { give, playState, seen, step } from "../game/fixtures.ts";
import {
  actions,
  byText,
  click,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Call,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
});
afterEach(async () => {
  m?.unmount();
  resetAll();
  vi.useRealTimers();
  await act(() => i18n.changeLanguage("en"));
});

const doc = () => document.body;
const btn = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const send = () => byText(doc(), "button", "Send offer")!;
const stepperValue = (r: string, side: "give" | "get") => {
  const cell = [...document.querySelectorAll(`[data-side="${side}"]`)].find((el) =>
    el.querySelector(`button[aria-label$=" ${cap(r)}"]`),
  );
  return cell?.querySelector("[data-stepper-value]")?.textContent;
};
const cap = (r: string) => r[0]!.toUpperCase() + r.slice(1);
const offers = () => [...document.querySelectorAll<HTMLElement>('[data-testid="offer"]')];
const recipient = (seat: number) =>
  document.querySelector<HTMLButtonElement>(`[role="checkbox"][data-seat="${seat}"]`);

/** Main turn of seat 0 after the roll, with cards in hands. */
function table(): GameState {
  const s = playState({ seat: 0 });
  give(s, 0, { ore: 2, wool: 1, brick: 1 });
  give(s, 1, { wool: 3 });
  give(s, 2, { wool: 1 });
  return s;
}

function openComposer(s: GameState, seat: number, to: number[]) {
  seatRoom(seat);
  showGame(s, seat);
  act(() => openTrade({ give: {}, get: {}, to }));
  m = mount(<TradePanel />);
}

describe("offer composer", () => {
  it("sends a valid offer to the chosen opponents and closes", () => {
    openComposer(table(), 0, [1, 2, 3]);
    click(btn("Give one more Ore"));
    click(btn("Give one more Ore"));
    click(btn("Ask for one more Wool"));
    click(recipient(3));
    expect(recipient(3)?.getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[data-testid="trade-summary"]')?.textContent).toBe(
      "You give 2 ore, you get 1 wool.",
    );
    click(send());
    expect(actions(calls)).toEqual([
      { type: "proposeTrade", give: { ore: 2 }, get: { wool: 1 }, to: [1, 2] },
    ]);
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it("blocks gifts and offers with no recipient", () => {
    openComposer(table(), 0, [1, 2, 3]);
    click(btn("Give one more Ore"));
    expect(send().disabled).toBe(true);
    click(btn("Ask for one more Grain"));
    expect(send().disabled).toBe(false);
    for (const seat of [1, 2, 3]) click(recipient(seat));
    expect(send().disabled).toBe(true);
    expect(doc().textContent).toContain("Pick at least one player.");
  });

  it("shows each player's avatar next to their name in the recipient choices", () => {
    openComposer(table(), 0, [1, 2, 3]);
    const shown = [1, 2, 3].map((seat) =>
      document
        .querySelector(`[role="checkbox"][data-seat="${seat}"] [data-testid="avatar"]`)
        ?.getAttribute("data-avatar"),
    );
    expect(shown).toEqual(AVATAR_IDS.slice(1, 4));
  });

  it("never puts a resource on both sides", () => {
    openComposer(table(), 0, [1, 2, 3]);
    click(btn("Give one more Ore"));
    expect(stepperValue("ore", "give")).toBe("1");
    click(btn("Ask for one more Ore"));
    expect(stepperValue("ore", "give")).toBe("0");
    expect(stepperValue("ore", "get")).toBe("1");
  });

  it("caps each give side at the hand", () => {
    openComposer(table(), 0, [1, 2, 3]);
    expect(btn("Give one more Grain").disabled).toBe(true);
    click(btn("Give one more Brick"));
    expect(btn("Give one more Brick").disabled).toBe(true);
    expect(btn("Ask for one more Brick").disabled).toBe(false);
  });

  it("fixes the recipient to the active player for others", () => {
    openComposer(table(), 1, [0]);
    expect(document.querySelector('[role="checkbox"]')).toBeNull();
    expect(document.querySelector('[data-testid="trade-recipient-fixed"]')?.textContent).toBe(
      "Offer to Ana",
    );
    click(btn("Give one more Wool"));
    click(btn("Ask for one more Ore"));
    click(send());
    expect(actions(calls)).toEqual([
      { type: "proposeTrade", give: { wool: 1 }, get: { ore: 1 }, to: [0] },
    ]);
  });

  it("closing sends nothing", () => {
    openComposer(table(), 0, [1, 2, 3]);
    click(btn("Give one more Ore"));
    click(byText(doc(), "button", "Close"));
    expect(actions(calls)).toEqual([]);
    expect(useUiStore.getState()).toMatchObject({ dialog: null, tradeDraft: null });
  });

  it("starts from a counter-offer prefill", () => {
    seatRoom(1);
    showGame(table(), 1);
    act(() => openTrade({ give: { wool: 2 }, get: { ore: 1 }, to: [0] }));
    m = mount(<TradePanel />);
    expect(stepperValue("wool", "give")).toBe("2");
    expect(stepperValue("ore", "get")).toBe("1");
  });
});

describe("Trade with players button", () => {
  const fab = () => btn("Trade with players");

  it("is visible but disabled before the roll", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<ActionButtons />);
    expect(fab()?.disabled).toBe(true);
  });

  it("is enabled after the roll and opens the composer for every opponent", () => {
    seatRoom(0);
    showGame(table(), 0);
    m = mount(<ActionButtons />);
    click(fab());
    expect(useUiStore.getState()).toMatchObject({
      dialog: "trade",
      tradeDraft: { give: {}, get: {}, to: [1, 2, 3] },
    });
  });

  it("is absent on another player's turn", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(<ActionButtons />);
    expect(fab()).toBeNull();
  });
});

describe("open offers tray", () => {
  /** Seat 0 (active) offers 1 ore for 1 wool to seats 1 and 2. */
  function withOffer(get = { wool: 1 }): GameState {
    return step(table(), { type: "proposeTrade", seat: 0, give: { ore: 1 }, get, to: [1, 2] });
  }

  function showTray(s: GameState, seat: number) {
    seatRoom(seat);
    showGame(s, seat);
    m = mount(<OffersTray />);
  }

  it("shows an incoming offer from the viewer's side with its answers", () => {
    showTray(withOffer(), 1);
    expect(offers()).toHaveLength(1);
    const entry = offers()[0]!;
    expect(entry.textContent).toContain("Ana offers");
    expect(entry.querySelector('[data-testid="offer-text"]')?.textContent).toBe(
      "You give 1 wool, you get 1 ore.",
    );
    for (const name of ["Accept", "Reject", "Counter"]) {
      expect(byText(entry, "button", name)?.disabled).toBe(false);
    }
  });

  it("disables Accept when the viewer lacks the asked cards", () => {
    showTray(withOffer({ wool: 2 }), 2);
    const entry = offers()[0]!;
    expect(byText(entry, "button", "Accept")?.disabled).toBe(true);
    expect(byText(entry, "button", "Reject")?.disabled).toBe(false);
    expect(entry.querySelector('[data-testid="offer-lacking"]')).not.toBeNull();
  });

  it("sends accept and reject with the offer id", () => {
    const s = withOffer();
    const id = s.offers[0]!.id;
    showTray(s, 1);
    click(byText(offers()[0]!, "button", "Accept"));
    click(byText(offers()[0]!, "button", "Reject"));
    expect(actions(calls)).toEqual([
      { type: "acceptTrade", offerId: id },
      { type: "rejectTrade", offerId: id },
    ]);
  });

  it("drops an offer the viewer declined, and shows the decline to the proposer", () => {
    const s = withOffer();
    const declined = step(s, { type: "rejectTrade", seat: 1, offerId: s.offers[0]!.id });
    showTray(declined, 1);
    expect(offers()).toHaveLength(0);
    m.unmount();
    showTray(declined, 0);
    const entry = offers()[0]!;
    expect(entry.textContent).toContain("Your offer");
    expect(entry.querySelector('[data-recipient="1"]')?.textContent).toBe("Ben: declined");
    expect(entry.querySelector('[data-recipient="2"]')?.textContent).toBe("Cy: deciding");
    click(byText(entry, "button", "Cancel"));
    expect(actions(calls)).toEqual([{ type: "cancelTrade", offerId: s.offers[0]!.id }]);
  });

  it("Counter opens the composer with the sides swapped, keeping the original", () => {
    const s = step(table(), {
      type: "proposeTrade",
      seat: 0,
      give: { ore: 1 },
      get: { wool: 2 },
      to: [1],
    });
    showTray(s, 1);
    click(byText(offers()[0]!, "button", "Counter"));
    expect(useUiStore.getState()).toMatchObject({
      dialog: "trade",
      tradeDraft: { give: { wool: 2 }, get: { ore: 1 }, to: [0] },
    });
    expect(offers()).toHaveLength(1);
  });

  it("hides offers between other players", () => {
    const s = step(table(), {
      type: "proposeTrade",
      seat: 2,
      give: { wool: 1 },
      get: { ore: 1 },
      to: [0],
    });
    seatRoom(1);
    showGame(s, 1);
    m = mount(<OffersTray />);
    expect(offers()).toHaveLength(0);
    // Seat 1 is not active: the tray still offers Make an offer.
    expect(document.querySelector('[data-testid="make-offer"]')?.textContent).toBe("Offer to Ana");
  });

  it("Make an offer opens the composer to the active player", () => {
    showTray(table(), 2);
    click(document.querySelector('[data-testid="make-offer"]'));
    expect(useUiStore.getState().tradeDraft).toMatchObject({ to: [0] });
  });

  it("empties when the turn ends and closes an open composer", () => {
    const unbind = bindUiToGame();
    const s = withOffer();
    seatRoom(1);
    showGame(s, 1);
    m = mount(
      <>
        <OffersTray />
        <TradePanel />
      </>,
    );
    click(byText(offers()[0]!, "button", "Counter"));
    expect(useUiStore.getState().dialog).toBe("trade");
    showGame(step(s, { type: "endTurn", seat: 0 }), 1);
    expect(offers()).toHaveLength(0);
    expect(useUiStore.getState().dialog).toBeNull();
    unbind();
  });

  it("is hidden for the active player with no offers", () => {
    showTray(table(), 0);
    expect(document.querySelector('[data-testid="offers-tray"]')).toBeNull();
  });

  it("highlights offers that arrive after mount only", () => {
    vi.useFakeTimers();
    const first = withOffer();
    showTray(first, 1);
    expect(offers()[0]!.dataset.fresh).toBeUndefined();
    const second = step(first, {
      type: "proposeTrade",
      seat: 0,
      give: { brick: 1 },
      get: { wool: 1 },
      to: [1],
    });
    showGame(second, 1);
    expect(offers()[1]!.dataset.fresh).toBe("true");
    act(() => {
      vi.advanceTimersByTime(FRESH_MS);
    });
    expect(offers()[1]!.dataset.fresh).toBeUndefined();
  });
});

describe("new offer toast", () => {
  const tEn = fixedT("en");
  const names = namesFrom(
    ["Ana", "Ben", "Cy"].map((name, seat) => ({
      seat,
      name,
      connected: true,
      bot: false,
      avatar: AVATAR_IDS[seat] as AvatarId,
    })),
    tEn,
  );
  const offered = {
    type: "tradeOffered" as const,
    offer: { id: 1, from: 0, to: [1], give: { ore: 1 }, get: { wool: 1 }, rejectedBy: [] },
  };

  it("toasts the recipients only", () => {
    expect(toastFor(offered, 1, names, tEn)).toEqual({
      text: "Ana made you a trade offer",
      tone: "info",
      seat: 0,
    });
    expect(toastFor(offered, 0, names, tEn)).toBeNull();
    expect(toastFor(offered, 2, names, tEn)).toBeNull();
  });

  it("raises one toast on an update, none on a resume snapshot", () => {
    const s = step(table(), {
      type: "proposeTrade",
      seat: 0,
      give: { ore: 1 },
      get: { wool: 1 },
      to: [1],
    });
    seatRoom(1);
    m = mount(<Toasts />);
    showGame(s, 1);
    expect(useUiStore.getState().toasts).toHaveLength(0);
    const { view } = seen(s, 1);
    act(() =>
      useGameStore.setState({
        source: "update",
        lastEvents: view.log.filter((e) => e.type === "tradeOffered"),
      }),
    );
    expect(useUiStore.getState().toasts.map((t) => t.text)).toEqual(["Ana made you a trade offer"]);
  });
});

describe("Spanish tray", () => {
  it("shows buttons, sides and status in Spanish", async () => {
    await act(() => i18n.changeLanguage("es"));
    const s = step(table(), {
      type: "proposeTrade",
      seat: 0,
      give: { ore: 1 },
      get: { wool: 1 },
      to: [1],
    });
    seatRoom(1);
    showGame(s, 1);
    m = mount(<OffersTray />);
    const entry = offers()[0]!;
    expect(entry.textContent).toContain("Ana ofrece");
    for (const name of ["Aceptar", "Rechazar", "Contraoferta"]) {
      expect(byText(entry, "button", name)).toBeDefined();
    }
    expect(entry.querySelector('[data-testid="offer-text"]')?.textContent).toMatch(
      /^Das .* y recibes /,
    );
  });
});
