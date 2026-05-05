# Telemersive Portbay

[![Latest release](https://img.shields.io/github/v/release/telemersion/telemersive-portbay)](https://github.com/telemersion/telemersive-portbay/releases/latest)

Telemersive Portbay is a desktop app for joining a telemersive-bus room — a shared MQTT-based session for routing video, audio, OSC, and motion-capture data between remote participants. It bridges local UltraGrid, OSC, and Motive devices into the room. It is a drop-in replacement for the Max MSP Telemersive Gateway and is wire-compatible, so mixed Max/Portbay rooms work.

See [docs/spec.md](docs/spec.md) for the protocol and design specification, and [CLAUDE.md](CLAUDE.md) for an architecture overview.

## Supported devices

- **UltraGrid** — video and audio relay (uses the UltraGrid CLI; located on first run)
- **OSC** — bidirectional OSC message relay
- **StageControl** — OSC variant for stage automation cues
- **Mocap** — Optitrack NatNet to OSC relay
- **Motive Bridge** — Optitrack NatNet protocol relay 


## Requirements

- **[Node.js]** 18+ and **[npm]**

### Linux and MacOS
link to download and install [Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

Once Node.js and npm are installed, you can verify the installation by running the following commands in your terminal:

```sh
node -v
npm -v
```

### Windows
link to download and install [nvm](https://github.com/coreybutler/nvm-windows/releases) -> nvm-setup.exe 

* restart Powershell

```
nvm install lts        # install latest LTS version
nvm use lts            # activate it
node --version         # verify
```

then set the execution policiy:

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
and confirm with [A]

```
 npm -v                 # verify
```

then follow the instructions below to install and run the app.

## Install and run

Inside the terminal, `cd` to a directory where you want to have your local folder for the project, then run the following commands:

```sh
git clone https://github.com/telemersion/telemersive-portbay.git
cd telemersive-portbay
npm install
npm run dev
```

This starts the electron-vite dev server with HMR for the renderer and live-reload for the main and preload processes. The app window opens automatically.

Use the in-app session UI to pick a room and join.

## First-run setup

On first launch, open the **Settings** view and find the **Tools & Compatibility** section. The app checks whether **UltraGrid** and **NatNetFour2OSC** (currently Windows only) are installed at compatible versions and shows the status of each. For any tool marked missing or version-mismatched, use **Download required build from official website ↗** to get the right version, then **Locate…** to point the app at the installed binary. The app validates the version and persists the path.

UltraGrid is needed for video/audio channels. [NatNetFour2OSC](https://github.com/immersive-arts/NatNetFour2OSC/releases) v1.2.0 is needed for NatNet and Motive channels. OSC and StageControl channels need no external tools.

## Project layout

- [src/main/](src/main/) — Electron main process: MQTT client, device router, child-process handlers
- [src/renderer/](src/renderer/) — Vue 3 UI; reconstructs room state from the MQTT stream forwarded over IPC
- [src/preload/](src/preload/) — thin IPC bridge between main and renderer
- [src/shared/](src/shared/) — topic helpers and shared types
- [tests/](tests/) — vitest suite with golden UG fixtures
- [vendor/ultragrid/](vendor/ultragrid/) — per-version UG installs (gitignored except for the README)

## Development

- `npm run typecheck` — type-check main + renderer (`vue-tsc --noEmit`)
- `npm test` — run the full vitest suite
- `npx vitest run tests/main/devices/OscDevice.test.ts` — run a single test file
- `npx vitest run tests/main/enumeration/parsers` — run only the UG parser tests
- `npm run build` — production build into `out/`
- `npm run preview` — launch the built app from `out/` without HMR

UltraGrid CLI output changes between versions, so the parsers in [src/main/enumeration/parsers/](src/main/enumeration/parsers/) are version-coupled. After upgrading the vendored UltraGrid, re-capture fixtures with `scripts/capture-uv-fixtures.sh` and run the parser tests. See [vendor/ultragrid/README.md](vendor/ultragrid/README.md) for vendor layout details.

## Issues

Bugs and feature requests: [GitHub Issues](../../issues).

## License

MIT. Copyright © 2024–2026 Martin Froehlich (maybites) for Immersive Art Space and Zürich University of the Arts (ZHdK). See [LICENSE](LICENSE).
