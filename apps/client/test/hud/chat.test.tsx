// In-game chat (openspec change in-game-chat): the chat tab built on shadcn Message / Bubble,
// the unread dot, and the store's cap and de-duplication. Lines are never persisted client-side.
import { CHAT_HISTORY, type ChatEntry } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ChatPanel } from "../../src/hud/ChatPanel.tsx";
import { addChatLine, markChatRead, setChatHistory, useChatStore } from "../../src/store/chat.ts";
import { click, mount, recordSession, resetAll, seatRoom, type Mounted } from "./helpers.tsx";

const line = (id: number, seat: number, text: string): ChatEntry => ({
  id,
  seat,
  name: ["Ana", "Ben", "Cy", "Dee"][seat] ?? "?",
  text,
  at: 1_700_000_000_000 + id,
});

let m: Mounted;
beforeEach(() => {
  resetAll();
  seatRoom(0);
});
afterEach(() => {
  m?.unmount();
  resetAll();
});
const q = (id: string) => m.container.querySelector(`[data-testid="${id}"]`);

describe("chat store", () => {
  it("counts only other players' lines as unread, ignores repeats and caps the history", () => {
    addChatLine(line(0, 0, "mine"), 0);
    addChatLine(line(1, 1, "theirs"), 0);
    addChatLine(line(1, 1, "theirs"), 0);
    expect(useChatStore.getState().unread).toBe(1);
    expect(useChatStore.getState().entries).toHaveLength(2);
    markChatRead();
    expect(useChatStore.getState().unread).toBe(0);
    setChatHistory(Array.from({ length: CHAT_HISTORY + 10 }, (_, i) => line(i, 1, `m${i}`)));
    expect(useChatStore.getState().entries).toHaveLength(CHAT_HISTORY);
    expect(useChatStore.getState().entries[0]!.text).toBe("m10");
  });
});

describe("ChatPanel", () => {
  it("shows an empty hint, then lines aligned by sender, and marks them read", () => {
    m = mount(<ChatPanel />);
    expect(q("chat-empty")).not.toBeNull();
    act(() => {
      addChatLine(line(0, 1, "hola"), 0);
      addChatLine(line(1, 0, "buenas"), 0);
    });
    const lines = [...m.container.querySelectorAll<HTMLElement>('[data-testid="chat-line"]')];
    expect(lines.map((l) => l.dataset.align)).toEqual(["start", "end"]);
    expect(lines[0]!.textContent).toContain("Ben");
    expect(lines[0]!.textContent).toContain("hola");
    expect(lines[1]!.textContent).not.toContain("Ana");
    expect(useChatStore.getState().unread).toBe(0);
  });

  it("sends the trimmed text through the session, clears the box, and blocks blank lines", () => {
    const calls = recordSession();
    m = mount(<ChatPanel />);
    const input = q("chat-input") as HTMLInputElement;
    const send = m.container.querySelector<HTMLButtonElement>('[data-testid="chat-form"] button')!;
    expect(send.disabled).toBe(true);
    act(() => {
      // React tracks the value setter, so write through the prototype like a real edit.
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      desc?.set?.call(input, "  hello  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(send.disabled).toBe(false);
    click(send);
    expect(calls.filter((c) => c.fn === "chat").map((c) => c.args[0])).toEqual(["hello"]);
    expect(input.value).toBe("");
  });
});
