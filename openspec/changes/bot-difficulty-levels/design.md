## Context

Bots live in `packages/bots`: `chooseAction(view, legal, rng, { trade })` returns one legal action, `judgeOffer` decides offers, and every choice between options goes through one `best(xs, score, rng)` helper with a tiny jitter tie-break. The server (`apps/server/src/rooms/room.ts`, `botFire`) builds a fresh `BotRng` per move from the game seed, version and seat, so bot moves replay. Seats are stored in `RoomMeta.seats` (`StoredSeat`), sent to clients as `SeatInfo` in `roomState`. The latest judge (commit 038d76c) already scores a hand by its best build plus a share of other builds plus a little per card. See proposal.md for the why.

## Goals / Non-Goals

**Goals:** one `level` input that changes only the bot's choices; deterministic for the same seed; old stored rooms keep working without migration.

**Non-Goals:** smarter Hard play beyond picking its best option and leader targeting (no lookahead search); changing the level mid-game.

## Decisions

1. **Level type lives in two places with the same strings.** `packages/bots` exports `BotLevel = "easy" | "normal" | "hard"` and `BOT_LEVELS`; `packages/protocol` has a zod `BotLevel` enum with the same values. Protocol does not depend on bots today, and the server is the only place that joins them (TypeScript checks the two types are assignable). Alternative: bots imports protocol — rejected, it would pull zod into the pure bot package.

2. **Trade judge = one guard plus cumulative level rules.** Shared guard: can pay, no affordable build broken. Each level's rule is "the stricter level's rule OR my own looser rule", each with its own leader limit (Hard 8, Normal 9, Easy none). This makes Easy ⊇ Normal ⊇ Hard true by construction, which is what the spec promises and what a probe test checks.
   - Hard: worth = best-build progress + 0.01 per card, margin 0.05 (the rule before 038d76c), plus a surplus-only check: for each resource it pays, it must still hold the most any remaining target costs of it. The check only narrows Hard, so the nesting holds.
   - Normal: worth from 038d76c (side share 0.25, 0.06 per card), margin 0.05.
   - Easy: same shape with 0.25 per card, margin 0 (ties accepted).
   Alternative: separate hand-written rules per level — rejected, harder to keep monotone.

3. **Move choice: noise in `best`, not new heuristics.** `best` takes the level. Easy: with chance 1/3 (`rng.int(3) === 0`) it returns `rng.pick(xs)`, otherwise the best option. Normal: today's jitter tie-break. Hard: no jitter beyond a 1e-6 tie-break, so it always plays the top-scored option. The same `BotRng` is used, so it stays deterministic; Easy's extra draws change the stream but only for Easy seats. Forced single actions (roll, end turn, discard counts) are unchanged; only choices among options are affected. Alternative: Easy skips builds sometimes — rejected for now, it risks stalling bots-only games and makes the fuzz test slower.

4. **Robber by level.** Easy picks the hex through noisy `best` and the victim with `rng.pick`. Normal: unchanged. Hard: hex score adds a bonus for buildings of the public-VP leader among opponents (weight ×2), and the victim is the qualifying opponent with the most public VP (ties: more cards).

5. **Storage and fallback.** `StoredSeat.level?: BotLevel`, written whenever the host sets it, absent otherwise. Reading uses `botLevel(seat)` that returns the stored value if it is one of the three, else `normal`. New bot seats and seats left by a human store nothing (Normal). `SeatInfo.level` is set for bot seats only (always resolved, so the client never guesses).

6. **`setBotLevel` follows `removeBot`.** Same host/lobby/not-a-bot checks and error codes, saveMeta before broadcast, through `service.seated`. No new error codes. Client: `setBotLevel(seat, level)` in `net/actions.ts` like `removeBot` (fire and forget; room state confirms).

7. **Lobby control.** A small native `<select>` per bot seat for the host (accessible name "Level of {{name}}"), plain muted text for others. Native select matches the existing "Starting player" control and works on touch.

## Risks / Trade-offs

- [Easy noise makes bots-only games longer] → fuzz test runs fewer Easy seeds; noise does not touch roll/end turn, so games still finish.
- [Changing `best`'s signature touches every call site] → level passed once via a small closure in `chooseAction`.
- [Normal's leader limit moves from 8 to 9] → intended (Normal is friendlier); Hard keeps 8.

## Migration Plan

No data migration: absent `level` means Normal. Rolling back leaves an unused `level` field in stored seats, which older code ignores.
