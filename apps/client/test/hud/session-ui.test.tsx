import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Lobby, inviteLinkFor } from "../../src/hud/Lobby.tsx";
import { ReplacedNotice } from "../../src/hud/ReplacedNotice.tsx";
import { StartScreen, checkName } from "../../src/hud/StartScreen.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useRoomStore } from "../../src/store/room.ts";
import {
  byText,
  click,
  mount,
  recordSession,
  resetAll,
  type,
  type Call,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

describe("StartScreen", () => {
  it("creates a room with the trimmed name", () => {
    m = mount(<StartScreen />);
    const create = byText(m.container, "button", "Create room")!;
    expect(create.disabled).toBe(true);
    type(m.container.querySelector("input"), "  Ana ");
    expect(create.disabled).toBe(false);
    click(create);
    expect(calls).toEqual([{ fn: "createRoom", args: ["Ana"] }]);
  });

  it("a name over 20 characters keeps Create and Join disabled with a hint", () => {
    m = mount(<StartScreen />);
    const [name, code] = m.container.querySelectorAll("input");
    type(code, "k7qx2m");
    type(name, "x".repeat(25));
    expect(byText(m.container, "button", "Create room")!.disabled).toBe(true);
    expect(byText(m.container, "button", "Join room")!.disabled).toBe(true);
    expect(m.container.querySelector('[data-testid="name-hint"]')?.textContent).toContain(
      "at most 20",
    );
    expect(checkName(" a ")).toBe("a");
    expect(checkName("   ")).toBeNull();
  });

  it("joins with a code in any case", () => {
    m = mount(<StartScreen />);
    const [name, code] = m.container.querySelectorAll("input");
    type(name, "Ben");
    type(code, "k7qx2m");
    click(byText(m.container, "button", "Join room"));
    expect(calls).toEqual([{ fn: "joinRoom", args: ["k7qx2m", "Ben"] }]);
  });

  it("is disabled while offline", () => {
    act(() => useConnectionStore.setState({ status: "reconnecting" }));
    m = mount(<StartScreen />);
    type(m.container.querySelector("input"), "Ana");
    expect(byText(m.container, "button", "Create room")!.disabled).toBe(true);
  });

  it("an invite link prefills the code and asks only for a name", () => {
    act(() => useRoomStore.setState({ prefillRoom: "K7QX2M" }));
    m = mount(<StartScreen />);
    const inputs = m.container.querySelectorAll("input");
    expect(inputs[1]?.value).toBe("K7QX2M");
    expect(byText(m.container, "button", "Create room")).toBeUndefined();
    type(inputs[0], "Cy");
    click(byText(m.container, "button", "Join room"));
    expect(calls).toEqual([{ fn: "joinRoom", args: ["K7QX2M", "Cy"] }]);
  });

  it("shows server errors inline and keeps the inputs", () => {
    m = mount(<StartScreen />);
    const [name, code] = m.container.querySelectorAll("input");
    type(name, "Ben");
    type(code, "ABCDEF");
    act(() =>
      useRoomStore.setState({ error: { request: "join", code: "room_full", message: "full" } }),
    );
    expect(m.container.querySelector('[role="alert"]')?.textContent).toBe("That room is full.");
    expect(name!.value).toBe("Ben");
    expect(code!.value).toBe("ABCDEF");
    act(() =>
      useRoomStore.setState({ error: { request: "join", code: "bad_name", message: "x" } }),
    );
    expect(m.container.querySelector('[role="alert"]')?.textContent).toContain(
      "invalid or already taken",
    );
  });

  it("shows a notice", () => {
    act(() => useRoomStore.setState({ notice: "Your seat could not be restored." }));
    m = mount(<StartScreen />);
    expect(m.container.textContent).toContain("could not be restored");
  });
});

function lobby(seat: number, players: number) {
  act(() =>
    useRoomStore.setState({
      room: "K7QX2M",
      seat,
      host: 0,
      status: "lobby",
      seats: ["Ana", "Ben", "Cy", "Dee"].slice(0, players).map((name, i) => ({
        seat: i,
        name,
        connected: i !== 2,
      })),
    }),
  );
}

describe("Lobby", () => {
  it("lists seats with host, you and offline marks, and the invite link", () => {
    lobby(1, 3);
    m = mount(<Lobby inviteLink="http://x/?room=K7QX2M" />);
    const items = [...m.container.querySelectorAll('[data-testid="lobby-seat"]')].map(
      (li) => li.textContent,
    );
    expect(items).toEqual(["Anahost", "Benyou", "Cyoffline"]);
    expect(
      m.container.querySelector<HTMLInputElement>('input[aria-label="Invite link"]')?.value,
    ).toBe("http://x/?room=K7QX2M");
    expect(inviteLinkFor("K7QX2M", "http://h/game?room=OLD#x")).toBe("http://h/game?room=K7QX2M");
  });

  it("non-host sees no start controls", () => {
    lobby(1, 3);
    m = mount(<Lobby inviteLink="l" />);
    expect(byText(m.container, "button", "Start game")).toBeUndefined();
    expect(byText(m.container, "button", "Leave room")).toBeDefined();
  });

  it("host starts a beginner game with no starting player", () => {
    lobby(0, 3);
    m = mount(<Lobby inviteLink="l" />);
    const beginner = m.container.querySelector<HTMLInputElement>('input[value="beginner"]')!;
    click(beginner);
    click(byText(m.container, "button", "Start game"));
    expect(calls).toEqual([{ fn: "startGame", args: ["beginner", undefined, "standard"] }]);
  });

  it("start needs 3 or 4 players", () => {
    lobby(0, 2);
    m = mount(<Lobby inviteLink="l" />);
    expect(byText(m.container, "button", "Start game")!.disabled).toBe(true);
    expect(m.container.textContent).toContain("3 or 4 players are needed");
  });

  it("start controls follow a host change", () => {
    lobby(1, 3);
    m = mount(<Lobby inviteLink="l" />);
    expect(byText(m.container, "button", "Start game")).toBeUndefined();
    act(() => useRoomStore.setState({ host: 1 }));
    expect(byText(m.container, "button", "Start game")).toBeDefined();
  });

  it("leave sends leaveRoom", () => {
    lobby(1, 3);
    m = mount(<Lobby inviteLink="l" />);
    click(byText(m.container, "button", "Leave room"));
    expect(calls).toEqual([{ fn: "leaveRoom", args: [] }]);
  });
});

describe("ReplacedNotice", () => {
  it("offers Play here only when replaced", () => {
    m = mount(<ReplacedNotice />);
    expect(m.container.textContent).toBe("");
    act(() => useConnectionStore.setState({ status: "replaced" }));
    expect(m.container.textContent).toContain("open in another tab");
    click(byText(m.container, "button", "Play here"));
    expect(calls).toEqual([{ fn: "playHere", args: [] }]);
  });
});
