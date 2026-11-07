## Why

Players who enjoy the game have no way to support its upkeep. A single optional button covers it without ads.

## What Changes

- A "Buy me a coffee" button on the welcome screen and in Settings → About, linking to https://buymeacoffee.com/ayoubsaif.
- It opens in a new tab directly. An in-app dialog or embed was considered, but the Buy Me a Coffee page sends `X-Frame-Options: SAMEORIGIN`, so it cannot be embedded; a dialog would only add a click.
- The placeholder ad slots on the welcome and start screens are removed for now.

## Impact

- `apps/client/src/hud/SupportButton.tsx`, `Welcome.tsx`, `settings/sections/AboutSection.tsx`, i18n (en, es). No server change, no third-party script.
