## 1. Icons

- [x] 1.1 Add `tools/hud-icons-gen.mjs` (Gemini image API, existing gold icons as style refs, reuse exported `keyOutGreen`, 128 px transparent WebP, `--out`/`--force`/name args) with `resume`, `end-game` and `home` subjects; verify `node tools/hud-icons-gen.mjs --help` (or running it with no key) fails with a clear "GEMINI_API_KEY missing" message instead of a crash
- [x] 1.2 With the user's approval, generate `resume`, `end-game` and `home` candidates into a scratch `--out` folder, review them next to `pause`, `flag`, `leave` and `endturn`, then write the chosen ones to `apps/client/public/ui/icons/`; verify both files are 128×128 WebP with alpha
- [x] 1.3 Add `"resume"`, `"end-game"` and `"home"` to `GameIconName` in `apps/client/src/hud/GameIcon.tsx`; verify `pnpm run check` (including `tools/check-assets.mjs`) passes

## 2. Strings

- [x] 2.1 Add `pause.resumeHint` to `apps/client/src/i18n/locales/en/session.ts` and `es/session.ts`; verify the i18n key-parity test passes

## 3. Dialog layout

- [x] 3.1 Add `flex-wrap` to `DialogFooter` in `apps/client/src/components/ui/dialog.tsx`; verify existing dialog tests pass
- [x] 3.2 Extract an `ActionRow` (icon, label, hint, full width, wrapping hint text) in `GamePause.tsx` and use it for the `GameMenu` rows; verify `game-pause.test.tsx` still passes
- [x] 3.3 Replace the `PausedNotice` footer with a column of `ActionRow`s: Resume (primary, `resume` icon, host only), End (`end-game`, host only), Leave (`leave`, everyone); verify with new tests in `apps/client/test/hud/game-pause.test.tsx` for host order (three rows, Resume first) and non-host (one Leave row, no Resume)

- [x] 3.4 Add `pause.playAnother`/`pause.playAnotherHint` (en, es) and a `keepSeat` option to `backToStart` that clears only the last room; verify with a session test that the token survives, no `resumeRoom` is sent on the next welcome, and `continueGame` resumes the seat
- [x] 3.5 Add the "Play another game" row (`home` icon, everyone) above Leave in `PausedNotice`, calling `backToStart({ keepSeat: true })`; verify with notice tests for row order (host: resume, end-game, home, leave; non-host: home, leave) and the call

## 4. Verification

- [x] 4.1 Run the client in the browser, pause a game as host in Spanish at 320 px and 1280 px wide; verify all three rows sit inside the dialog clear of the corner plates and each opens its action or confirmation, and that the game menu still looks right
- [ ] 4.2 Run `pnpm test` and `pnpm run check`; verify both pass
