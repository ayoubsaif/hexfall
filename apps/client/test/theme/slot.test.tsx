// Load-failure path for themed images/models (task 3.3). R3F hooks cannot run outside a
// <Canvas> in happy-dom, so this drives the shared ThemedSlot (the Suspense + error
// boundary + one-warning-per-URL wrapper that <Asset> puts around <FlatAsset> and
// <ThemedModel>) with DOM children that fail the way useTexture/useGLTF do: by throwing.
import { type ReactNode, act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { resolveForStyle } from "../../src/theme/Asset.tsx";
import type { AssetResolution } from "../../src/theme/resolve.ts";
import {
  ThemedSlot,
  effectiveResolution,
  hasLoadFailed,
  reportLoadFailure,
  resetLoadFailures,
} from "../../src/theme/slot.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL_HILLS = "/themes/diorama/tiles/hills.webp";

function FailingImage(): ReactNode {
  throw new Error(`Could not load ${URL_HILLS}: 404`);
}

function Loaded() {
  return <span data-testid="themed">themed</span>;
}

let container: HTMLDivElement;
let root: Root;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetLoadFailures();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  // React logs caught render errors; keep the output quiet.
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  warn.mockRestore();
  error.mockRestore();
});

function slot(child: ReactNode, url = URL_HILLS) {
  return (
    <ThemedSlot
      key={`${url}`}
      assetKey="tile.hills"
      themeId="diorama"
      fileKind="image"
      url={url}
      fallback={<span data-testid="fallback">fallback</span>}
    >
      {child}
    </ThemedSlot>
  );
}

const count = (id: string) => container.querySelectorAll(`[data-testid="${id}"]`).length;

describe("ThemedSlot", () => {
  it("renders the fallback and warns once, naming key, theme, URL and image", async () => {
    await act(async () => {
      root.render(
        <>
          <div>{slot(<FailingImage />)}</div>
          <div>{slot(<FailingImage />)}</div>
          <div>{slot(<Loaded />, "/themes/diorama/tiles/forest.webp")}</div>
        </>,
      );
    });
    expect(count("fallback")).toBe(2);
    // A failure for one key does not affect others.
    expect(count("themed")).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("tile.hills");
    expect(message).toContain('"diorama"');
    expect(message).toContain(URL_HILLS);
    expect(message).toContain("image");
    expect(hasLoadFailed(URL_HILLS)).toBe(true);
  });

  it("shows the fallback while loading, then the themed asset", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => {
      resolve = r;
    });
    let ready = false;
    function Image() {
      if (!ready) throw pending;
      return <Loaded />;
    }
    await act(async () => root.render(slot(<Image />)));
    expect(count("fallback")).toBe(1);
    expect(count("themed")).toBe(0);
    await act(async () => {
      ready = true;
      resolve();
      await pending;
    });
    expect(count("themed")).toBe(1);
    expect(count("fallback")).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("failure registry", () => {
  const image: AssetResolution = {
    kind: "image",
    key: "tile.hills",
    url: URL_HILLS,
    projection: "top",
  };

  it("warns only once per URL", () => {
    expect(reportLoadFailure("tile.hills", "diorama", "image", URL_HILLS, "404")).toBe(true);
    expect(reportLoadFailure("tile.hills", "diorama", "image", URL_HILLS, "404")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("later instances of a failed URL resolve straight to the fallback", () => {
    expect(effectiveResolution(image)).toBe(image);
    reportLoadFailure("tile.hills", "diorama", "image", URL_HILLS, "404");
    expect(effectiveResolution(image)).toEqual({
      kind: "fallback",
      key: "tile.hills",
      reason: "failed",
    });
  });
});

describe("board style resolution", () => {
  const image: AssetResolution = {
    kind: "image",
    key: "tile.hills",
    url: URL_HILLS,
    projection: "top",
  };
  const city: AssetResolution = {
    kind: "model",
    key: "piece.city",
    url: "/themes/diorama/city.glb",
    transform: undefined,
  };

  it("the flat style keeps themed images", () => {
    expect(resolveForStyle(image, "tile.hills", "flat")).toBe(image);
  });

  it("the 3d style ignores theme images for flat keys", () => {
    expect(resolveForStyle(image, "tile.hills", "3d").kind).toBe("fallback");
  });

  it("model keys are unaffected by the style", () => {
    expect(resolveForStyle(city, "piece.city", "3d")).toBe(city);
    expect(resolveForStyle(city, "piece.city", "flat")).toBe(city);
  });
});
