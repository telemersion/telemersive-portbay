# Telemersive Gateway NG

Electron + Vue 3 desktop app — a drop-in replacement for the Max MSP "Telemersive Gateway". It joins a telemersive-bus room over MQTT and bridges local UltraGrid / OSC / NatNet devices into the shared session. The MQTT data plane is wire-compatible with the Max gateway, so mixed Max/NG rooms work.

See [docs/spec.md](docs/spec.md) for the protocol and design specification, and [CLAUDE.md](CLAUDE.md) for an architecture overview.

## Requirements

- **Node.js** 18+ and **npm**
- **macOS** (current target — process management and the UltraGrid bundle layout are macOS-specific)
- **UltraGrid** macOS build, if you want to use UG channels — see [Installing UltraGrid](#installing-ultragrid) below

## Install

```sh
npm install
```

## Run in development

```sh
npm run dev
```

This starts the electron-vite dev server with HMR for the renderer and live-reload for the main and preload processes. The app window opens automatically.

By default the app connects to the public telemersive-bus broker. Use the in-app session UI to pick a room and join.

## Build a production app

```sh
npm run build
```

The build output lands in `out/`, which `electron-builder` consumes (config in [electron-builder.yml](electron-builder.yml)) to package a distributable app.

## Installing UltraGrid

UltraGrid is not bundled. The runtime looks for it in this order (see [src/main/enumeration/spawnCli.ts](src/main/enumeration/spawnCli.ts)):

1. `$UG_PATH` — explicit override
2. `vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv` — repo-local
3. `/Applications/uv-qt.app/Contents/MacOS/uv` — system install

To install a repo-local copy:

1. Download a macOS build from <https://www.ultragrid.cz/>.
2. Place it under a version-named directory and symlink `active`:

   ```sh
   mkdir -p vendor/ultragrid/1.9.3
   mv ~/Downloads/uv-qt.app vendor/ultragrid/1.9.3/
   cd vendor/ultragrid && ln -sfn 1.9.3 active
   ```

3. Verify:

   ```sh
   vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv --version
   ```

UltraGrid CLI output changes between versions, so parsers are version-coupled. After upgrading UG, re-capture fixtures with `scripts/capture-uv-fixtures.sh` and run the parser tests. Full details in [vendor/ultragrid/README.md](vendor/ultragrid/README.md).

## Other commands

- `npm run typecheck` — type-check main + renderer (`vue-tsc --noEmit`)
- `npm test` — run the full vitest suite
- `npx vitest run tests/main/devices/OscDevice.test.ts` — run a single test file
- `npx vitest run tests/main/enumeration/parsers` — run only the UG parser tests

## Project layout

- [src/main/](src/main/) — Electron main process: MQTT client, device router, child-process handlers
- [src/renderer/](src/renderer/) — Vue 3 UI; reconstructs room state from the MQTT stream forwarded over IPC
- [src/preload/](src/preload/) — thin IPC bridge between main and renderer
- [src/shared/](src/shared/) — topic helpers and shared types
- [tests/](tests/) — vitest suite with golden UG fixtures
- [vendor/ultragrid/](vendor/ultragrid/) — per-version UG installs (gitignored except for the README)
