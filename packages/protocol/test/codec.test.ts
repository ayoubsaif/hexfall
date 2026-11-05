import { describe, expect, it } from "vite-plus/test";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClient,
  encodeServer,
  PROTOCOL_VERSION,
} from "../src/index.ts";

const frame = (obj: unknown) => JSON.stringify(obj);

describe("codec round-trip", () => {
  it("round-trips hello", () => {
    const r = decodeClientMessage(encodeClient("hello", { clientVersion: "0.0.0" }, 0));
    expect(r).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: "hello", seq: 0, payload: { clientVersion: "0.0.0" } },
    });
  });

  it("round-trips ping", () => {
    const r = decodeClientMessage(encodeClient("ping", { t: 1234.5 }, 3));
    expect(r).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: "ping", seq: 3, payload: { t: 1234.5 } },
    });
  });

  it("round-trips welcome", () => {
    const payload = { serverVersion: "0.0.0", protocolVersion: PROTOCOL_VERSION, pushKey: null };
    const r = decodeServerMessage(encodeServer("welcome", payload, 0, 0));
    expect(r).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: "welcome", seq: 0, re: 0, payload },
    });
  });

  it("round-trips pong", () => {
    const r = decodeServerMessage(encodeServer("pong", { t: 99 }, 4, 3));
    expect(r).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: "pong", seq: 4, re: 3, payload: { t: 99 } },
    });
  });

  it("round-trips error", () => {
    const payload = { code: "bad_frame", message: "nope" } as const;
    const r = decodeServerMessage(encodeServer("error", payload, 5));
    expect(r).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: "error", seq: 5, payload },
    });
  });

  it("preserves re, and omits it when not given", () => {
    const withRe = decodeServerMessage(encodeServer("pong", { t: 1 }, 10, 7));
    expect(withRe.ok && withRe.message.re).toBe(7);
    const encoded = JSON.parse(encodeClient("ping", { t: 1 }, 1)) as Record<string, unknown>;
    expect("re" in encoded).toBe(false);
    const withoutRe = decodeClientMessage(encodeClient("ping", { t: 1 }, 1));
    expect(withoutRe.ok && "re" in withoutRe.message).toBe(false);
  });
});

describe("codec rejects malformed frames", () => {
  const ping = { v: PROTOCOL_VERSION, type: "ping", seq: 1, payload: { t: 1 } };

  it("rejects non-JSON with bad_frame", () => {
    for (const raw of ["", "not json", "{", "{'v':1}"]) {
      expect(decodeClientMessage(raw)).toMatchObject({ ok: false, error: "bad_frame" });
      expect(decodeServerMessage(raw)).toMatchObject({ ok: false, error: "bad_frame" });
    }
  });

  it("rejects non-object JSON with bad_frame", () => {
    for (const raw of ["null", "42", '"hello"', "[]"]) {
      expect(decodeClientMessage(raw)).toMatchObject({ ok: false, error: "bad_frame" });
    }
  });

  it("rejects a wrong v with version_mismatch", () => {
    expect(decodeClientMessage(frame({ ...ping, v: PROTOCOL_VERSION + 1 }))).toMatchObject({
      ok: false,
      error: "version_mismatch",
    });
    expect(decodeServerMessage(frame({ ...ping, type: "pong", v: 0 }))).toMatchObject({
      ok: false,
      error: "version_mismatch",
    });
    expect(decodeClientMessage(frame({ ...ping, v: "1" }))).toMatchObject({
      ok: false,
      error: "version_mismatch",
    });
  });

  it("rejects a missing v with bad_frame", () => {
    const { v: _v, ...noV } = ping;
    expect(decodeClientMessage(frame(noV))).toMatchObject({ ok: false, error: "bad_frame" });
  });

  it("rejects an unknown type with bad_frame", () => {
    expect(decodeClientMessage(frame({ ...ping, type: "teleport" }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
    // Server-only types are not valid client messages, and vice versa.
    expect(decodeClientMessage(frame({ ...ping, type: "pong" }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
    expect(decodeServerMessage(frame(ping))).toMatchObject({ ok: false, error: "bad_frame" });
  });

  it("rejects a missing payload field with bad_frame", () => {
    expect(decodeClientMessage(frame({ ...ping, payload: {} }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
    const { payload: _p, ...noPayload } = ping;
    expect(decodeClientMessage(frame(noPayload))).toMatchObject({ ok: false, error: "bad_frame" });
    expect(
      decodeClientMessage(frame({ v: PROTOCOL_VERSION, type: "hello", seq: 0, payload: {} })),
    ).toMatchObject({ ok: false, error: "bad_frame" });
  });

  it("rejects a negative or non-integer seq with bad_frame", () => {
    expect(decodeClientMessage(frame({ ...ping, seq: -1 }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
    expect(decodeClientMessage(frame({ ...ping, seq: 1.5 }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
    expect(decodeClientMessage(frame({ ...ping, re: -1 }))).toMatchObject({
      ok: false,
      error: "bad_frame",
    });
  });

  it("rejects an unknown error code with bad_frame", () => {
    const err = {
      v: PROTOCOL_VERSION,
      type: "error",
      seq: 0,
      payload: { code: "oops", message: "x" },
    };
    expect(decodeServerMessage(frame(err))).toMatchObject({ ok: false, error: "bad_frame" });
  });
});
