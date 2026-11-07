## Decisions

- Memory only: chat lives in the `Room` object (array capped at 50). It is not part of the room meta or action log, so it adds no Redis commands and survives reconnects but not restarts.
- Server cleans text (control characters, repeated spaces, trim, 300 characters) and stamps sender seat, name and time; the client never sets them. Existing per-connection rate limiting applies.
- History is replayed on create, join and resume. Late joiners see the last 50 lines.
- The unread count ignores the viewer's own lines and resets when the chat tab is on screen (the drawer content unmounts when closed, so mounted means visible).
- shadcn `message` and `bubble` are written locally in the project's parchment style (the shadcn registry components were not pulled in), reusing the existing seat avatar.
