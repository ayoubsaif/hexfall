# AGENTS.md — Catan Base Game App

You are building a digital implementation of **Catan (base game, 5th English edition, 2020 rulebook)** for 3–4 players, plus the **5–6 player extension** (§15) and a **selectable victory target** (§12). This file is the single source of truth for the game rules. The rules engine must implement **every rule below exactly as written**. Do not invent house rules, do not simplify, and do not skip edge cases. When UI and rules conflict, the rules win.

Treat the rules engine as a pure, deterministic state machine (seeded RNG for dice, deck shuffle and random steals) that is fully unit-testable without any UI. The UI is a thin client over that engine.

---

## 1. Components (the game state must model all of these)

| Component | Quantity | Details |
|---|---|---|
| Terrain hexes | 19 | 4 Forest (lumber), 4 Pasture (wool), 4 Fields (grain), 3 Hills (brick), 3 Mountains (ore), 1 Desert (nothing) |
| Sea frame | 6 pieces | Surrounds the island; defines coastal edges and the 9 harbor slots |
| Harbors | 9 | 4 generic **3:1**, 5 special **2:1** (exactly one each for brick, grain, lumber, ore, wool) |
| Number tokens | 18 | Values 2–12, **no 7**. One each of 2 and 12; two each of 3,4,5,6,8,9,10,11. Backs lettered A–R for variable setup |
| Resource cards | 95 | 19 each of brick, grain, lumber, ore, wool. The bank is finite |
| Development cards | 25 | 14 Knight, 6 Progress (2 Road Building, 2 Year of Plenty, 2 Monopoly), 5 Victory Point (Library, Market, Chapel, Great Hall, University) |
| Building Costs cards | 4 | Reference only |
| Special cards | 2 | Longest Road (2 VP), Largest Army (2 VP) |
| Settlements | 5 per player | 1 VP each |
| Cities | 4 per player | 2 VP each |
| Roads | 15 per player | 0 VP (only via Longest Road) |
| Dice | 2 six-sided | Sum 2–12 |
| Robber | 1 | Starts on the desert |

Players: 3 or 4 with the components above; 5 or 6 with the extension components in §15. Each player has exactly 5 settlements, 4 cities, 15 roads — **no more, no less**. A player can never build a piece type whose personal supply is empty.

### Board topology
- **Hex**: the 19 land tiles in the standard 3-4-5-4-3 hexagonal island layout.
- **Intersection (vertex)**: where 3 hexes meet, or where 1–2 hexes meet the sea frame (coastal). Settlements and cities go **only** on intersections. The island has 54 intersections.
- **Path (edge)**: border between 2 hexes, or between a hex and the frame. Roads go **only** on paths, **max 1 road per path**. The island has 72 paths.
- Each intersection touches up to 3 hexes and up to 3 paths; each path has exactly 2 intersections at its ends.
- A **harbor** is attached to a specific coastal path; a player "has" that harbor when they own a settlement or city on either intersection of that path.

---

## 2. Terrain → resource

| Terrain | Produces |
|---|---|
| Hills | Brick |
| Forest | Lumber |
| Mountains | Ore |
| Fields | Grain |
| Pasture | Wool |
| Desert | Nothing (never gets a number token; robber starts here) |

---

## 3. Building costs

| Item | Cost | VP |
|---|---|---|
| Road | 1 Brick + 1 Lumber | 0 |
| Settlement | 1 Brick + 1 Lumber + 1 Wool + 1 Grain | 1 |
| City (upgrade of own settlement) | 3 Ore + 2 Grain | 2 (replaces the settlement's 1) |
| Development card | 1 Ore + 1 Wool + 1 Grain | 0 (VP cards worth 1) |

Paid resources return to the bank.

---

## 4. Board setup

Support two modes.

### 4a. Beginner (fixed) setup
Hex layout by row (top to bottom, left to right), with number tokens:

```
Row 1 (3): Mountains 10 | Pasture 2   | Forest 9
Row 2 (4): Fields 12    | Hills 6     | Pasture 4  | Hills 10
Row 3 (5): Fields 9     | Forest 11   | Desert —   | Forest 3   | Mountains 8
Row 4 (4): Forest 8     | Mountains 3 | Fields 4   | Pasture 5
Row 5 (3): Hills 5      | Fields 6    | Pasture 11
```
- Robber starts on the desert.
- Harbors follow the fixed positions printed on the frame (standard arrangement, clockwise from top-left: 3:1, 2:1 grain, 2:1 ore, 3:1, 2:1 wool, 3:1, 3:1, 2:1 brick, 2:1 lumber). Verify against Illustration A of the rulebook if you have access to it.
- Each player starts with 2 settlements and 2 roads pre-placed as in the rulebook's Illustration A. One of each player's two settlements is marked with a star; the player receives 1 resource for each terrain hex adjacent to that starred settlement. If the beginner illustration is unavailable, let players place pieces using the normal setup phase (4c) instead; do not guess positions.
- In a 3-player game the red position is unused.
- **The oldest player goes first** (the app may ask for ages or let players pick; a user-selectable starting player is acceptable).

### 4b. Variable (random) setup
1. Shuffle the 19 terrain hexes and place them randomly in the 3-4-5-4-3 layout.
2. Place the 9 harbor pieces randomly on the 9 harbor slots of the frame (optionally also shuffle frame-piece order).
3. Number tokens: start at any corner hex of the island and place tokens in **alphabetical order A→R**, spiraling **counter-clockwise toward the center**, **skipping the desert**. Letter values: A=5, B=2, C=6, D=3, E=8, F=10, G=9, H=12, I=11, J=4, K=8, L=10, M=9, N=4, O=5, P=6, Q=3, R=11.
   - Alternative fully random placement is allowed, but then **6 and 8 ("red numbers") must never be on adjacent hexes**; swap tokens until that holds.
4. Robber starts on the desert.
5. Then run the setup phase (4c).

### 4c. Setup phase (initial placement, used with variable setup)
- Each player rolls both dice; highest roll is the **starting player**. (Re-roll ties.)
- **Round 1**: starting player, then clockwise. Each player places **1 settlement** on any free intersection (Distance Rule applies, see §7b) and then **1 road** on a path adjacent to that settlement. No road connectivity requirement in setup beyond touching the settlement just placed.
- **Round 2**: the player who placed **last** in round 1 goes first, then order proceeds **counter-clockwise** (reverse of round 1), so the starting player places last. Each places a second settlement (any free intersection respecting the Distance Rule; it need **not** connect to the first) and a road adjacent to **that second settlement**.
- **Starting resources**: immediately after placing their **second** settlement, each player takes 1 resource card for each terrain hex adjacent to that second settlement (desert gives nothing).
- The starting player (who placed their second settlement last) takes the first normal turn.

Common to both modes: resource cards sorted into 5 face-up bank stacks; development deck shuffled face down; Longest Road and Largest Army set aside unowned; each player starts with 2 VP (two settlements).

---

## 5. Turn structure

Turns go **clockwise**. On a turn the active player does, in order:

1. **Roll for resource production** (mandatory, exactly once, both dice). Result applies to **all** players.
2. **Trade** (optional): domestic trade with other players and/or maritime trade with the bank.
3. **Build** (optional): roads, settlements, cities, buy development cards.

Plus: the active player may play **one** development card at **any time during their turn**, including **before rolling the dice** (except VP cards, see §9c).

**Combined trade/build phase (recommended default for the app):** after the roll, trading and building may be interleaved in any order, any number of times (trade, build, trade again, build again…). A harbor gained by building a settlement this turn may be used in the same turn. Offer the strict separate-phase mode as an optional "beginner" toggle if desired, but the combined mode is the correct advanced rule.

After building, the player ends their turn and the player to their left takes the next turn.

---

## 6. Resource production (dice roll)

- Sum of both dice selects every hex bearing that number token.
- For each such hex **not currently occupied by the robber**: every player with a **settlement** on an adjacent intersection gets **1** card of that hex's resource; every **city** gets **2**. A player with multiple buildings on the same hex gets paid for each.
- The robber's hex produces nothing for anyone while the robber sits there.
- **Bank shortage rule**: if the bank does not have enough of a resource to pay everyone's full production of that resource this roll, then **nobody** receives any of that resource this roll. **Exception**: if the shortage affects only **one** player, that player receives whatever remains and the excess is lost. Other resource types are unaffected.
- Rolling a **7** produces nothing and triggers the robber (§8).

Dice probability (for UI hints): 2/12 = 1/36, 3/11 = 2/36, 4/10 = 3/36, 5/9 = 4/36, 6/8 = 5/36, 7 = 6/36.

---

## 7. Building rules

### 7a. Roads
- Cost: 1 brick + 1 lumber. Max 15 per player.
- Must be placed on an empty path.
- Must connect to one of the builder's **own** existing roads, settlements or cities (i.e., share an intersection with one of them).
- Connectivity is **blocked by opponents' buildings**: a road may not extend "through" an intersection occupied by another player's settlement or city. A path whose only connection to your network is via an intersection holding an opponent's building is not legal.
- Roads can be built along the coast (paths between a hex and the frame).
- Roads are never removed once built.

### 7b. Settlements
- Cost: 1 brick + 1 lumber + 1 wool + 1 grain. Max 5 per player (a settlement upgraded to a city returns to the player's supply and can be rebuilt).
- Must be on an empty intersection.
- Must connect to at least one of the builder's **own roads** (not required during the setup phase).
- **Distance Rule**: all intersections adjacent (one path away) to the target must be empty — no settlement or city of **any** player, **including the builder's own**. Applies during setup too.
- Worth 1 VP.

### 7c. Cities
- Cost: 3 ore + 2 grain. Max 4 per player.
- Can **only** be built by upgrading one of the builder's own existing settlements, on the same intersection. Never placed directly.
- The replaced settlement piece goes back to the player's supply.
- Produces 2 cards per adjacent producing hex. Worth 2 VP. Cities are never downgraded.

### 7d. Development cards
- Cost: 1 ore + 1 wool + 1 grain.
- Draw the top card of the face-down deck into the buyer's hidden hand.
- Cannot buy if the deck is empty. Played cards never return to the deck.
- Development cards can never be traded or given away.

A player may build as many items as they can afford and have pieces for, in any order, within one turn.

---

## 8. Robber: rolling a 7

When a 7 is rolled, in this order:

1. **Discard**: every player (including the roller) holding **more than 7** resource cards (8+) must discard **half, rounded down** (9 cards → discard 4; 8 → 4; 11 → 5). Each player chooses which cards to discard. Discards go to the bank. All discards happen before the robber moves.
2. **Move**: the roller **must** move the robber to a **different** hex — any land hex including the desert. Leaving it in place is illegal.
3. **Steal**: the roller takes **1 random** resource card from **one** opponent who has a settlement or city adjacent to the robber's new hex. If several opponents qualify, the roller chooses the victim. If the victim has 0 cards, nothing is stolen. If no opponent has a building there, no steal. The roller may not steal from themself.
4. The turn continues with trade/build.

While the robber sits on a hex, that hex produces nothing for anyone (§6). Players must truthfully report their hand size on request (the UI should always show each player's card count, never their card identities).

---

## 9. Development cards

### 9a. General
- At most **one** development card (Knight or Progress) may be played per turn. VP cards do not count toward this limit.
- May be played at any time during the owner's turn, **including before the dice roll**.
- A card **bought this turn cannot be played this turn** (exception: VP cards, §9c).
- Played Knights stay face-up in front of the player; played Progress cards are removed from the game.

### 9b. Knight (14 cards)
- Playing a Knight: immediately move the robber (must go to a different hex) and steal 1 random card from a qualifying opponent, exactly as steps 2–3 of §8. **No discard step** (discarding only happens on a rolled 7).
- Count of face-up Knights feeds Largest Army (§10b).
- Playing a Knight before the roll is a legal and common play (e.g., to move the robber off your hex before production).

### 9c. Victory Point cards (5 cards)
- Each is worth 1 VP and is kept hidden.
- They count toward the player's total **only when revealed**. A player may reveal any number of VP cards during their own turn **only** when doing so brings them to **the victory target or more** (i.e., to win; 10 VP by default, §12). They may be revealed on the same turn they are bought.
- They are revealed to everyone when the game ends.
- The engine must track **hidden VP** (for win detection) separately from **public VP** (shown to opponents).

### 9d. Progress cards (6 cards, green)
- **Road Building (×2)**: immediately place 2 roads for free, following all normal road rules (§7a). If the player has fewer than 2 roads left in supply, or no legal placement, they place what they can. The second road may connect to the first.
- **Year of Plenty (×2)**: take any 2 resource cards from the bank (same or different types). Limited by bank availability. Usable in the same turn.
- **Monopoly (×2)**: name 1 resource type. **Every** other player must hand over **all** cards of that type from their hand. Players with none give nothing.

---

## 10. Special cards

### 10a. Longest Road (2 VP)
- Awarded to the **first** player whose longest continuous road is **≥ 5 segments**.
- "Continuous road" = the longest trail of that player's road segments where consecutive segments share an intersection, **each road segment used at most once** (branches/forks count only along the single longest branch; loops are allowed as long as each segment is counted once).
- An opponent's settlement or city on an intersection **breaks** the road at that point: segments on either side cannot be chained through it. Your own buildings do not break your road.
- If another player later has a **strictly longer** road than the current holder, they immediately take the card (4-point swing).
- **Ties**: the current holder keeps the card if tied. If the holder's road is broken (e.g. by an opponent's settlement) so they no longer have the longest, and two or more other players are tied for the new longest (≥5), the card is **set aside, unowned**. Same if nobody has a 5+ road anymore. It is re-awarded when a single player uniquely has the longest road of ≥5.
- Recompute after **every** road placement and **every** settlement placement (settlements can break roads).

### 10b. Largest Army (2 VP)
- Awarded to the **first** player with **3** face-up played Knights.
- Taken immediately by any player who has **strictly more** played Knights than the current holder. Ties never move the card.
- Never set aside once awarded (knights can't be lost).

---

## 11. Trading

### 11a. Domestic trade (player ↔ player)
- Only during the active player's turn, and the **active player must be a party** to every trade. Non-active players may never trade among themselves.
- Any number of trades; any number of cards per side.
- Not allowed: giving cards away (a side giving nothing), trading like-for-like (e.g., 3 ore for 1 ore — the same resource type may not appear on both sides), trading development cards.
- Either side may propose; others may counter-offer. The app needs an offer/accept/reject/counter flow.

### 11b. Maritime trade (player ↔ bank)
- Only on the active player's turn, any number of times.
- **4:1** always available to everyone: 4 identical cards → 1 card of any other type.
- **3:1 generic harbor** (if owned): 3 identical cards → 1 of any other type.
- **2:1 special harbor** (if owned): 2 cards of **that harbor's resource** → 1 of any other type. A special harbor grants **no** improved rate for other resources (not even 3:1). Multiples allowed (e.g., 4 ore at an ore 2:1 harbor → 2 cards).
- The bank must have the requested card available.
- A harbor is usable the same turn its settlement is built (combined phase).

---

## 12. Victory points and ending the game

| Source | VP |
|---|---|
| Settlement | 1 |
| City | 2 |
| Longest Road | 2 |
| Largest Army | 2 |
| VP development card (revealed) | 1 |

- Target: **10 VP** by default. The host may choose a different **victory target** for any game (3–6 players) when starting it: an integer from **8 to 15**. Everything below that says "10 VP" means the game's victory target. The target is fixed for the whole game and visible to all players.
- The game ends **immediately** when the active player has **≥ the target during their own turn** (including hidden VP cards they choose to reveal). That player wins.
- A player who reaches the target during **another** player's turn (e.g., by receiving Longest Road via an opponent's settlement breaking a road… or simply by holding it), including during a Special Building Phase window (§15c), does **not** win yet; they must wait for their own turn, and the game continues until **any** player has the target on their own turn.
- Check for victory after every state change during the active player's turn (build, card reveal, special-card transfer), not only at end of turn.

---

## 13. Engine requirements and edge cases to implement and test

1. **Legal-move generation**: for the current state, enumerate legal road paths, settlement intersections, city targets, buyable items, playable cards, and legal robber hexes/victims. The UI must only offer legal moves.
2. **Setup order**: snake order (clockwise then counter-clockwise), resources granted only from the second settlement (variable setup) or from the starred settlement (beginner setup).
3. **Distance Rule** enforced in setup and in play, including against the builder's own buildings.
4. **Road connectivity blocked by opponent buildings**, for both normal builds and Road Building.
5. **Longest Road**: DFS/backtracking over road edges with per-segment reuse prohibition; handle loops, forks, breaks by opponent settlements, tie-keeping, and the set-aside state.
6. **Largest Army** transfers only on strictly-greater counts.
7. **7 handling**: discard threshold is **>7** (8 or more), discard amount floor(n/2), discards before robber move, robber must change hex, steal is random and hidden, no steal possible from an empty hand or when no qualifying opponent.
8. **Robber blocks production**; Knight moves robber without discards; Knight before roll allowed.
9. **One dev card per turn**; cards bought this turn unplayable this turn; VP cards exempt from both rules but only revealable to win.
10. **Bank limits**: finite 19-per-resource bank with the shortage rule; Year of Plenty and maritime trade limited by bank; development deck of 25 that can run out.
11. **Piece limits**: 15/5/4 per player; city upgrade returns the settlement to supply.
12. **Trade validation**: active player always involved, no gifts, no like-for-like, no dev cards.
13. **Win detection** only on the active player's own turn; hidden VP tracked separately from public VP.
14. **Determinism**: all randomness (dice, deck shuffle, hex/harbor/token shuffle, steal) flows from a single seeded RNG so games are replayable and tests are deterministic.
15. **Information hiding**: opponents see hand sizes and played Knights, never hand contents or unrevealed dev cards.
16. Provide an event log of every action (roll, production per player, trades, builds, card plays, robber moves, steals as "X stole a card from Y" without revealing the card, special-card transfers, victory).

Write unit tests for each numbered item above before considering the engine done.

---

## 14. Things that are NOT in the base rules (do not implement unless asked)
- No Seafarers/Cities & Knights content (the 5–6 player extension is in §15).
- No trading on other players' turns, no bank trades off-turn.
- No "friendly robber", no "no-7 on first two rounds", no card-stealing from the bank, no discard limit other than >7.
- No VP for roads other than Longest Road, no VP for Knights other than Largest Army.

---

## 15. 5–6 player extension

Games with **5 or 6 players** use the extension components and the Special Building Phase. Every other rule in §1–§12 applies unchanged. Games with 3 or 4 players never use anything in this section.

### 15a. Components (totals with the extension added)

| Component | Quantity | Details |
|---|---|---|
| Terrain hexes | 30 | 6 Forest, 6 Pasture, 6 Fields, 5 Hills, 5 Mountains, 2 Desert |
| Harbors | 11 | 5 generic **3:1**; **2:1**: 2 wool, 1 each of brick, grain, lumber, ore |
| Number tokens | 28 | Two each of 2 and 12; three each of 3, 4, 5, 6, 8, 9, 10, 11. No 7 |
| Resource cards | 120 | 24 of each resource. The bank is finite |
| Development cards | 34 | 20 Knight, 3 Road Building, 3 Year of Plenty, 3 Monopoly, 5 Victory Point |
| Player pieces | 6 colors | Each player still has exactly 15 roads, 5 settlements, 4 cities |
| Robber | 1 | Starts on a desert (the one with the lower hex id) |

The bank shortage rule (§6), Year of Plenty and maritime limits (§9d, §11b) apply to the 24-per-resource bank. Largest Army and Longest Road are unchanged.

### 15b. Large board and setup
- **Layout**: 30 land hexes in seven rows of **3-4-5-6-5-4-3** (pointy-top), with 80 intersections, 109 paths, 38 coastal paths and 11 harbor slots spaced around the coast. Neither desert gets a number token.
- **Variable setup only**: no verified beginner layout or pre-placed pieces exist for the large board, so 5–6 player games always use random setup. Shuffle the 30 terrains onto the hexes and the 11 harbors onto the slots.
- **Number tokens**: placed **randomly** (the fully random option of §4b), reshuffling until **no 6 or 8 is adjacent to another 6 or 8**. All randomness comes from the game's seeded RNG.
- Then run the normal setup phase (§4c) with all 5 or 6 players in snake order.

### 15c. Special Building Phase
- After the active player ends their turn, **each other player**, in clockwise order starting with the player to the left of the one who ended, gets one **building window** before the next turn starts. Then the player to the left of the one who ended takes their normal turn.
- In their window a player may **build roads, settlements and cities and buy development cards**, as many as they can afford, following every normal building rule (§7), and then pass.
- In a window a player may **not** trade with players, trade with the bank, play development cards or reveal VP cards.
- A development card bought in a window may be played from the buyer's **next own turn**.
- A player cannot win during a window (§12). If they still have the target when their own turn starts, they win then.
- Each window is logged, and with a turn timer each window has its own countdown; a window that times out passes with nothing built.
