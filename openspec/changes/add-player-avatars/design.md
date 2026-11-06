## Context

Seats are `{ name, tokenHash, bot? }` on the server and `SeatInfo { seat, name, connected, bot }` on the wire. The client reads names and connection state through `useNames`/`useConnected` from the room store; player panels, the trade dialog and the offers tray all render a seat as a name plus a color swatch. Toasts come from `Toasts` in `hud/Feed.tsx`, mounted in a top-center container in `Hud.tsx`. The floating action buttons (Trade among them) sit bottom-right at `bottom: var(--hand-h) + 12px`. The supplied reference portrait is a 1024×1024 image with a baked stone ring and a village backdrop.

## Goals / Non-Goals

**Goals:**
- A fixed catalog of 12 commoner portraits, picked per seat before the game, visible to everyone.
- One `Avatar` component reused at every size, with the seat color ring.
- Toasts out of the board's way, anchored over the action buttons.

**Non-Goals:**
- Uploads, custom art, mid-game changes, animated avatars, spectator avatars.
- Changing game rules or the engine; avatars live in the room/seat layer only.

## Decisions

1. **Asset format: 500×500 WebP, no baked frame.** The reference has a stone ring; keeping it would fight the seat-color ring and add detail that is mush at 28 px. Crop the portrait to the circle interior (square image, subject inside the inscribed circle), export WebP q≈82 (~30–50 KB each). The ring is CSS (`rounded-full ring-2` in the seat color). Alternative: bake the frame per color (4× assets, rejected). A second 128 px size was considered; skipped because 12 small files cost less than a second pipeline, and the browser downscales fine.
2. **Catalog lives in `@hexfall/protocol`** as `AVATAR_IDS` (kebab-case ids such as `villager-beard`, `shepherd-woman`). Server validates against it without shipping images; the client maps id → `/avatars/<id>.webp`. Alternative: free-form URL/string (rejected: untrusted input, no uniqueness check). The reference image becomes the first entry.
3. **Avatar is a seat attribute**, sent as `SeatInfo.avatar` and stored as `StoredSeat.avatar`. Chosen at `createRoom`/`joinRoom` (optional) and changed with a new lobby-only `setAvatar`. Server rule: requested avatar if free, else `avatar_taken`; none requested → first free id in catalog order. Unique per room (4 seats, 12 avatars, always satisfiable). Alternative: let duplicates happen and disambiguate by ring color (rejected: confusing in toasts).
4. **Bots** take the first free avatar at add time. Humans keep their pick if free; if a human changes later the bot is not moved.
5. **Old saves:** `StoredSeat.avatar` is optional; on load a missing value maps to `AVATAR_IDS[seat]`, deduplicated by catalog order. No data migration.
6. **Remembered choice:** the client stores the last picked id in prefs and sends it on create/join; on `avatar_taken` the server's free pick wins and the client shows it.
7. **`Avatar` component:** props `seat`, `size` (`xs` 20, `sm` 28, `md` 40, `lg` 64). `<img>` with `alt=""` (name is already adjacent text), `loading="lazy"` except in the picker, ring from `seatColor(seat)`. If the image fails or the seat has none, render the name's first letter on the seat color. Data comes from a new `useAvatars()` next to `useNames()`.
8. **Toasts:** a toast event is now `{ text, tone, seat? }`. `toastFor` already knows the acting seat for most events; it adds `seat` so `Toasts` shows a `sm` avatar. The stack container moves from top-center to bottom-right: `right-3`, `bottom = var(--hand-h) + fab height + 20px`, `items-end`, max width `min(360px, 100% - 24px)`. The fab height reuses the cluster measurement already done in `useHudLayout` (new `--fab-h` var). On `max-sm`/portrait it stays right-aligned above the buttons and caps at 3 visible toasts (oldest dropped) so it never reaches the status pill. `Rejection` stays where it is. Alternative: bottom-left (rejected: collides with the offers tray and corner controls).
9. **Picker UI:** a grid of `lg` avatars (radio group semantics, keyboard arrows) in the start form (create/join) and in the lobby row for the player's own seat; taken avatars are `aria-disabled` with the owner's name as tooltip.
10. **Generation of art:** produce with the available image tools in one consistent prompt template (flat cel-shaded cartoon, thick dark outlines, muted earth palette, 10th-century peasant clothing, simple blurred village/forest backdrop, bust, centered), using the reference as style input. Review each image by eye; reject anything with crowns, armor-heavy or noble dress.

## Risks / Trade-offs

- [Style drift across generated images] → one prompt template, reference image on every call, review contact sheet before committing.
- [Wire break] → protocol version bump; client and server ship together as with prior changes.
- [Merge conflicts with `add-bots` in Lobby/room/messages] → apply after `add-bots` lands.
- [Toast stack covering the hand or buttons on small screens] → position from measured `--hand-h`/`--fab-h`, cap at 3, non-interactive except the dismiss button.
- [Payload size: 12 × ~40 KB] → lazy loading outside the picker; cached by the service worker on first use.

## Migration Plan

Ship client and server together (version bump). Old saved games load with default avatars. Rollback: revert the change; `StoredSeat.avatar` is ignored by older code.

## Open Questions

- "Century X" read as the 10th century (medieval commoners). If the 19th or another era was meant, only the art prompt (task 1) changes.
- Should the picker also offer a "random" choice? Default: no, first free is used when nothing is picked.
