# Docs status & the screenshots still needed

The MkDocs site is built and the in-app screenshots are generated. What remains
is a list of photographs of things outside the Electron window, which no harness
can take.

Not part of the published site — `exclude_docs` in [mkdocs.yml](../mkdocs.yml)
keeps this file, `spec.md`, `deployment.md`, `upgrading-ultragrid.md`,
`design/`, `specs/`, `superpowers/`, `javascript/` and the old `wiki/` out of it.

## Done

| | |
| --- | --- |
| Site | MkDocs Material, 19 pages, `mkdocs build --strict` clean |
| Publishing | [.github/workflows/docs.yml](../.github/workflows/docs.yml) → GitHub Pages on push to `master` |
| Local build | `python3.12 -m venv .venv-docs && .venv-docs/bin/pip install -r requirements-docs.txt`, then `npm run docs:serve` |
| Screenshots | 28, generated from the live app by `npm run docs:screenshots` |
| Old wiki | content migrated; `docs/wiki/` is gitignored and can be deleted once you are happy |

The screenshot harness is documented in
[scripts/docs-screenshots/README.md](../scripts/docs-screenshots/README.md). It
drives the real app against a throwaway profile with a fictional three-peer room
injected over IPC — no broker, no router, no second machine, no video signal.

**Before publishing:** GitHub Pages needs enabling for the repo (Settings →
Pages → Source: GitHub Actions). The workflow will not deploy until it is.

## Two things I need from you in text, not pixels

1. **The exact process names the current build registers with the firewall.**
   The FAQ still describes `uv_tb0..uv_tb9` and `NatNetThree2OSC` from the Max
   era; I left a warning admonition in place of names I could not verify.
   Enable an UltraGrid device on a fresh machine and note what the prompt says.
2. **Whether Gatekeeper still prompts** on the signed and notarised macOS build.
   If it opens cleanly, say so and I will delete that step rather than document
   a dialog nobody sees.

## Optional follow-up

The app's **Help → Wiki** menu item still opens the GitHub wiki
([main/index.ts](../src/main/index.ts), in `setupMenu()`). Once Pages is live,
point it at the docs site instead. I left it alone deliberately — until the site
is published, changing it would send users to a 404.

## Manual screenshots

**14 of these already have a placeholder** in the built site — a *"Screenshot
pending"* admonition sitting exactly where the image goes, so the pages read
correctly without them and you can drop images in one at a time. Just add the
file under `docs/assets/screenshots/` and replace the admonition with an
`![alt](../assets/screenshots/<name>.png)`.

Three are marked **no placeholder**: the pages mention the situation in prose but
have no slot reserved. Send those and I will add the slot, or skip them.

### Conventions

- **Format** PNG. Retina/@2x is fine and preferred; long edge ≤ 2400px.
- **Naming** exactly the filename in the tables, lowercase, kebab-case.
- **Location** `docs/assets/screenshots/`.
- **Crop** to the window or dialog. No wallpaper, no dock, no menu bar unless the
  menu bar is the subject.
- **Redact** no real broker credentials, no room passwords, no account names, no
  colleagues' peer or machine names. The generated screenshots use `studio-a`,
  `demo-room`, `telemersion.example.org` and RFC 5737 documentation IPs — match
  that register.
- **Skip what no longer happens** and tell me, so I can remove the section rather
  than leave a gap.

### A — Install and first launch

*Referenced from [getting-started/install.md](getting-started/install.md).*

| # | Filename | What to capture |
| --- | --- | --- |
| M1 | `os-macos-dmg.png` | The mounted `.dmg`: app icon and Applications drop target, window chrome included. |
| M2 | `os-macos-gatekeeper.png` | The "developer cannot be verified" alert — **only if it still appears**. *(no placeholder)* |
| M3 | `os-windows-smartscreen.png` | "Windows protected your PC", **More info** already expanded so **Run anyway** shows. |
| M4 | `os-windows-installer.png` | The NSIS page where the install directory is chosen. *(no placeholder)* |

### B — Firewall

*Referenced from [faq.md](faq.md#firewall).*

| # | Filename | What to capture |
| --- | --- | --- |
| M6 | `os-macos-firewall-prompt.png` | The "accept incoming network connections?" alert, triggered by enabling an UltraGrid device the first time. |
| M7 | `os-macos-firewall-options.png` | System Settings → Network → Firewall → Options, scrolled to the entries, set to allow. |
| M8 | `os-windows-firewall-prompt.png` | Windows Defender "Allow access" dialog, executable name and Private/Public boxes visible. |
| M9 | `os-windows-firewall-allowed-apps.png` | Control Panel → Allowed apps, scrolled to the relevant entries. |

### C — Audio on macOS

*Referenced from [tutorials/audio-on-macos.md](tutorials/audio-on-macos.md).*

| # | Filename | What to capture |
| --- | --- | --- |
| M10 | `ext-macos-audio-midi-blackhole.png` | Audio MIDI Setup, BlackHole 16ch selected, channel list visible. |
| M11 | `ext-macos-audio-midi-aggregate.png` | The aggregate device with its sub-devices and channel offsets visible. |

### D — Reaper routing

*Referenced from [tutorials/audio-on-macos.md](tutorials/audio-on-macos.md).
Re-shoot rather than reuse the old `TG_device_ultragrid_Reaper_*` images — the
surrounding text changed and so did Reaper.*

| # | Filename | What to capture |
| --- | --- | --- |
| M13 | `ext-reaper-audio-device.png` | Preferences → Audio → Device with the aggregate selected. |
| M14 | `ext-reaper-input-track.png` | A track's input set to `Input 9 (BlackHole 16ch)`. |
| M15 | `ext-reaper-output-track.png` | A track routed to `1: Output 1 (BlackHole 16ch)`. |
| M16 | `ext-reaper-master-track.png` | Master track routed to the built-in output. |

### E — External video

*Referenced from [faq.md](faq.md). Use synthetic or clearly-yours footage — no
identifiable people.*

| # | Filename | What to capture |
| --- | --- | --- |
| M19 | `ext-spout-settings.png` | The SPOUTSETTINGS dialog (the "black texture" fix). |

### F — Open Stage Control

*Referenced from [devices/stage-control.md](devices/stage-control.md). This
replaces a hotlink to `openstagecontrol.ammd.net`, which showed their demo rather
than your room and would break when they reorganise their site.*

| # | Filename | What to capture |
| --- | --- | --- |
| M21 | `ext-open-stage-control-editor.png` | Browser at your room's URL, editor open, a handful of widgets placed. |

### G — Window chrome

Playwright captures web contents only, so no generated screenshot has a native
title bar. Optional, for the landing page.

| # | Filename | What to capture |
| --- | --- | --- |
| M22 | `os-app-window.png` | The whole app window including the title bar, joined, matrix visible. macOS preferred. *(no placeholder)* |

### Dropped from the original list

- **M5** (app in Applications), **M12** (Sound output), **M17/M18** (NDI Studio
  Monitor, Syphon client), **M20** (Max sender), **M23** (quit menu) — the pages
  they would have gone on do not need them. Nothing references them.
