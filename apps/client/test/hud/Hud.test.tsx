import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { Connection } from "../../src/net/connection.ts";
import { getConnection, setConnectionFactory, useConnection } from "../../src/net/useConnection.ts";
import { initialConnectionState, useConnectionStore } from "../../src/store/connection.ts";
import { useBoardStyleStore } from "../../src/theme/style.ts";
import { FakeClock, FakeSocket } from "../net/fakes.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useConnectionStore.setState({ ...initialConnectionState });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Hud", () => {
  it("shows status and ping latency", () => {
    act(() => root.render(<Hud />));
    expect(container.querySelector('[data-testid="connection-status"]')?.textContent).toBe(
      "Connecting",
    );
    act(() => useConnectionStore.setState({ status: "open", latencyMs: 37.4 }));
    expect(container.querySelector('[data-testid="connection-status"]')?.textContent).toBe(
      "Connected",
    );
    expect(container.querySelector('[data-testid="connection-ping"]')?.textContent).toBe("37 ms");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows the reload banner on version mismatch", () => {
    act(() => root.render(<Hud />));
    act(() => useConnectionStore.setState({ status: "version_mismatch" }));
    const banner = container.querySelector('[role="alert"]');
    expect(banner?.textContent).toContain("A new version is available, please reload");
    expect(banner?.querySelector("button")?.textContent).toBe("Reload");
  });
});

describe("useConnection", () => {
  afterEach(() => setConnectionFactory());

  it("opens exactly one socket under StrictMode and closes it on unmount", async () => {
    FakeSocket.instances = [];
    const clock = new FakeClock();
    setConnectionFactory(
      () =>
        new Connection({
          serverUrl: "ws://x",
          clientVersion: "t",
          WebSocket: FakeSocket,
          timers: clock,
          now: clock.now,
        }),
    );
    function Probe() {
      useConnection();
      return null;
    }
    act(() =>
      root.render(
        <StrictMode>
          <Probe />
        </StrictMode>,
      ),
    );
    await new Promise((r) => setTimeout(r, 5));
    expect(FakeSocket.instances).toHaveLength(1);
    expect(getConnection()?.status).toBe("connecting");
    act(() => root.render(<div />));
    await new Promise((r) => setTimeout(r, 5));
    expect(getConnection()).toBeNull();
    expect(FakeSocket.instances[0]?.closedWith).toBe(1000);
  });

  it("switches the board style from the settings control", () => {
    const calls: string[] = [];
    const real = useBoardStyleStore.getState().setStyle;
    useBoardStyleStore.setState({
      style: "flat",
      setStyle: (s) => {
        calls.push(s);
        useBoardStyleStore.setState({ style: s });
      },
    });
    try {
      act(() => root.render(<Hud />));
      const options = [
        ...container.querySelectorAll<HTMLButtonElement>(
          '[role="radiogroup"][aria-label="Board style"] [role="radio"]',
        ),
      ];
      expect(options.map((o) => o.textContent)).toEqual(["Flat", "3D"]);
      expect(options[0]?.getAttribute("aria-checked")).toBe("true");
      act(() => options[1]?.click());
      expect(calls).toEqual(["3d"]);
      expect(options[1]?.getAttribute("aria-checked")).toBe("true");
      expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    } finally {
      useBoardStyleStore.setState({ setStyle: real });
    }
  });
});
