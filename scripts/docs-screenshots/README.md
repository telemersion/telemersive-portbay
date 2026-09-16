# Documentation screenshot harness

Generates every in-app screenshot under `docs/assets/screenshots/` from the real
application. Run it whenever the UI changes and commit the result.

```bash
npm run docs:screenshots     # builds, then captures
```

## How it works

The renderer reconstructs the entire room from the raw MQTT stream forwarded
over IPC and never opens its own socket
([localPeer.ts](../../src/renderer/state/localPeer.ts)). So the harness can hand
it a complete, fictional room over the same channels the bus normally uses:

- **No broker, no router, no second machine, no video signal.** Bright "data is
  flowing" arrows and live FPS/volume readouts are injected as
  `device/gui/indicators` values, exactly as the UltraGrid parser would publish
  them.
- **Real components.** Nothing is mocked in the renderer — every pixel comes
  from the same Vue components users see.
- **Throwaway profile.** The app is launched with `--user-data-dir` pointing at
  a temp directory, so your own `settings.json` and `rack.json` are untouched.

`fixture.ts` holds the room; `capture.ts` drives it.

## Why the fixture is generated, not written by hand

The UltraGrid device subtree comes from the handler's own
`defaultUltraGridConfig()` / `snapshotTopics()`
([config.ts](../../src/main/devices/ultragrid/config.ts)), with overrides applied
through the handler's own `applyTopicChange()`. Those modules are import-pure —
no Electron, no side effects. A topic that stops existing therefore disappears
from the fixture automatically instead of producing a screenshot of a field the
app no longer has.

Port numbers come from [portAllocator.ts](../../src/main/portAllocator.ts) for
the same reason.

## Two things that will bite you

**`ELECTRON_RUN_AS_NODE`.** If this is set in your environment, Electron starts
as plain Node — no `app`, no window — and Playwright reports only
`Process failed to launch!`. `capture.ts` strips it from the child environment.

**Values that come from `ipcMain.handle`, not from events.** Those cannot be
injected the way events can, so `overrideHandlers()` replaces them in the main
process: `net:interfaces` (otherwise your real NIC and LAN address appear in the
Session screenshot) and `settings:get-path` (otherwise the temp profile path
appears in Settings). Views are captured *after* a route change so each one
remounts and re-invokes its handlers — capture a view that was already mounted
when the override landed and you get the pre-override value.

## Adding a screenshot

1. Add the state to `fixture.ts` if it needs new topics.
2. Add a `shot(page, 'name', selector?)` call in `capture.ts`, in the section it
   belongs to.
3. Use `shotMatrix()` for matrix views (clips away the empty channels) and
   `shotUnion()` for elements with no box of their own — `.peer-row` is
   `display: contents`.
4. Reference it from the relevant page under `docs/`.

Filenames are lowercase kebab-case and are referenced directly from the Markdown,
so renaming one means updating its page.

## What this cannot capture

OS dialogs and other applications — installers, Gatekeeper/SmartScreen, firewall
prompts, Audio MIDI Setup, Reaper, NDI Tools, Open Stage Control. Those are taken
by hand; the list lives in `docs/docs-migration-plan.md`.

Playwright captures web contents only, so no native title bar appears in any of
these images.
