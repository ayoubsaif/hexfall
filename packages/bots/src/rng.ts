// Bot-private RNG. Never touches the game's state.rng (replay contract).
import { createRng, nextInt, type RngSeed, type RngState } from "@hexfall/engine";

export class BotRng {
  private state: RngState;
  constructor(seed: RngSeed) {
    this.state = createRng(seed);
  }
  /** Integer in [0, n). */
  int(n: number): number {
    const [x, next] = nextInt(this.state, n);
    this.state = next;
    return x;
  }
  /** Small tie-break jitter in [0, 1). */
  jitter(): number {
    return this.int(1000) / 1000;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)] as T;
  }
}
