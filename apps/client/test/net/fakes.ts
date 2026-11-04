import type { SocketLike, Timers } from "../../src/net/connection.ts";

export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readonly url: string;
  readyState = 0;
  sent: string[] = [];
  closedWith: number | undefined;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }
  // ---- test drivers
  serverOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  serverSend(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === "string" ? frame : JSON.stringify(frame) });
  }
  serverClose(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code, reason: "" });
  }
  sentMessages(): { type: string; seq: number; payload: Record<string, unknown> }[] {
    return this.sent.map((s) => JSON.parse(s) as never);
  }
  static last(): FakeSocket {
    const s = FakeSocket.instances.at(-1);
    if (!s) throw new Error("no socket");
    return s;
  }
}

type Task = { at: number; fn: () => void; every?: number };

/** Manual clock and timers. `advance(ms)` fires due timers in order. */
export class FakeClock implements Timers {
  t = 1_000_000;
  private nextId = 1;
  private tasks = new Map<number, Task>();
  /** Every setTimeout delay requested, in order. */
  delays: number[] = [];

  now = (): number => this.t;
  setTimeout = (fn: () => void, ms: number) => {
    this.delays.push(ms);
    const id = this.nextId++;
    this.tasks.set(id, { at: this.t + ms, fn });
    return id as never;
  };
  setInterval = (fn: () => void, ms: number) => {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.t + ms, fn, every: ms });
    return id as never;
  };
  clearTimeout = (id: unknown): void => {
    this.tasks.delete(id as number);
  };
  clearInterval = (id: unknown): void => {
    this.tasks.delete(id as number);
  };
  pending(): number {
    return this.tasks.size;
  }
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      let next: [number, Task] | null = null;
      for (const entry of this.tasks) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      const [id, task] = next;
      this.t = task.at;
      if (task.every) task.at += task.every;
      else this.tasks.delete(id);
      task.fn();
    }
    this.t = end;
  }
}
